-- =========================================================================
-- CORREÇÃO: duplicidade nos alertas de prazo de Vídeo ("atrasada" /
-- "atrasada há mais de 1 dia") — Parte 4 da auditoria (17/09/2026)
-- =========================================================================
-- Achado testando ao vivo + conferindo o banco: encontrei pares idênticos
-- de notificação "está atrasada há mais de 1 dia" para os mesmos 3
-- destinatários (Admin/Coordenador), a poucos minutos de diferença, ambas
-- não lidas.
--
-- Causa raiz: a chave de deduplicação de `video_verificar_alertas_prazo()`
-- (que impede o mesmo aviso de ser criado duas vezes) incluía a data exata
-- do prazo da demanda: 'video.atrasado_escalado:<demanda_id>:<prazo>'.
-- Isso funciona bem enquanto o prazo não muda — mas assim que alguém EDITA
-- o prazo de uma demanda já atrasada (por exemplo, corrigindo a data),
-- a chave muda junto, e o banco não reconhece mais como "o mesmo aviso":
-- gera um aviso novo, duplicado, pra toda a equipe de Admin/Coordenador —
-- mesmo a demanda continuando exatamente na mesma situação (atrasada).
-- Reproduzi exatamente isso nos dados reais: a demanda "CONSCIENTIZAÇÃO DO
-- TRÂNSITO" teve o prazo editado (16/06 → 19/06) enquanto já estava
-- atrasada há mais de 1 dia, e isso por si só disparou um segundo aviso
-- idêntico pros 3 Admins/Coordenadores, 4 minutos depois do primeiro.
--
-- Correção: pros dois avisos que vão pra equipe toda ("atrasada" e
-- "atrasada há mais de 1 dia"), a chave deixa de incluir o prazo — fica
-- só por demanda, então edições de prazo não geram um aviso novo enquanto
-- a demanda continuar atrasada. `video.prazo_amanha` (aviso individual,
-- só pro videomaker responsável, sem o efeito de "multiplicar" por vários
-- destinatários) mantém a chave como estava — o impacto de uma eventual
-- repetição ali é bem menor, e ela tem uma razão legítima de existir por
-- data (o "amanhã" muda de verdade quando o prazo muda).
-- =========================================================================

create or replace function public.video_verificar_alertas_prazo()
returns void language plpgsql security definer set search_path = public as $$
declare r record; evid uuid;
begin
  if not public.sou_equipe_interna() then return; end if;

  for r in
    select d.* from public.demandas_edicao d
    where d.deleted_at is null
      and d.editing_status not in ('entregue', 'descartado')
      and d.prazo is not null
      and (public.sou_equipe() or d.videomaker_id = auth.uid())
  loop
    if r.prazo = current_date + 1 and r.videomaker_id is not null then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.prazo_amanha', 'video.prazo_amanha:' || r.id || ':' || r.prazo::text,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo < current_date and r.videomaker_id is not null then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.atrasado', 'video.atrasado:' || r.id,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;

    if r.prazo <= current_date - 2 then
      begin
        insert into public.eventos_dominio (tipo, chave, alvo_tipo, alvo_id, client_id, payload)
        values ('video.atrasado_escalado', 'video.atrasado_escalado:' || r.id,
                'demanda_edicao', r.id, r.client_id, jsonb_build_object('titulo', r.titulo))
        returning id into evid;
        perform public.video_processar_evento(evid);
      exception when unique_violation then null;
      end;
    end if;
  end loop;
end;
$$;
revoke all on function public.video_verificar_alertas_prazo() from public;
grant execute on function public.video_verificar_alertas_prazo() to authenticated;

-- Limpeza dos 6 avisos duplicados já criados em produção pelo bug acima
-- (3 destinatários × 2 cada, mesmo texto, 4 minutos de diferença, nenhum
-- lido ainda) — mantém a cópia mais recente de cada par, remove a mais
-- antiga.
delete from public.notificacoes
where id in (
  '912d8dbb-8403-440b-b8c4-03c7b84eaeca',
  'a7713063-bb9d-469c-a99a-1ac4991e8f68',
  '330a8f34-0d48-4dc4-a37a-479b82d19b51'
);

-- Evento (eventos_dominio) correspondente ao aviso antigo removido acima —
-- apaga também, senão fica um evento "processado" órfão sem notificação
-- nenhuma associada.
delete from public.eventos_dominio where id = '84c3cd39-5dd1-43bd-aeb4-5277b3fae7b2';

-- Atualiza a chave do evento restante (e de qualquer outro igual que
-- exista, mesmo sem ter virado notificação duplicada ainda) pro formato
-- novo, sem a data — pra função de cima não gerar um evento A MAIS na
-- próxima verificação, achando (pela chave antiga) que "esse aqui ainda
-- não existe".
update public.eventos_dominio
   set chave = regexp_replace(chave, ':[0-9]{4}-[0-9]{2}-[0-9]{2}$', '')
 where tipo in ('video.atrasado', 'video.atrasado_escalado')
   and chave ~ ':[0-9]{4}-[0-9]{2}-[0-9]{2}$';
