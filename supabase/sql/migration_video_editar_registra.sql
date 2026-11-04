-- =====================================================================
-- HISTÓRICO DE NOME E CÓDIGO DA DEMANDA DE VÍDEO (zzz89) — aplicada.
-- video_editar_demanda passa a gravar um evento "edicao" em
-- demandas_edicao_eventos quando o nome ou o código mudam de verdade
-- (quem mudou, de quê para quê). Permissão e demais campos: iguais.
-- =====================================================================
create or replace function public.video_editar_demanda(p_demanda_id uuid, p_titulo text default null, p_codigo text default null, p_pacote text default null, p_prazo date default null, p_tem_prazo boolean default false, p_observacoes text default null, p_gravacao_id uuid default null, p_tem_gravacao boolean default false, p_prioridade text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  antes record; quem record; partes text[] := '{}';
begin
  if not (public.sou_equipe() or public.sou_videomaker()) then
    raise exception 'Só a equipe edita os dados da demanda.' using errcode = '42501';
  end if;
  if p_tem_gravacao and p_gravacao_id is not null and not exists (select 1 from public.gravacoes where id = p_gravacao_id) then
    raise exception 'Gravação inválida.';
  end if;
  if p_prioridade is not null and p_prioridade not in ('normal', 'alta', 'urgente') then
    raise exception 'Prioridade inválida.';
  end if;

  select titulo, codigo into antes from public.demandas_edicao where id = p_demanda_id and deleted_at is null;

  update public.demandas_edicao set
    titulo = coalesce(p_titulo, titulo),
    codigo = coalesce(p_codigo, codigo),
    pacote = coalesce(p_pacote, pacote),
    prazo = case when p_tem_prazo then p_prazo else prazo end,
    observacoes = coalesce(p_observacoes, observacoes),
    gravacao_id = case when p_tem_gravacao then p_gravacao_id else gravacao_id end,
    prioridade = coalesce(p_prioridade, prioridade),
    updated_at = now()
  where id = p_demanda_id and deleted_at is null;

  /* trocar nome ou código deixa rastro no histórico da demanda */
  if found then
    if p_titulo is not null and p_titulo is distinct from antes.titulo then
      partes := partes || ('Nome: “' || coalesce(nullif(antes.titulo, ''), 'sem nome') || '” → “' || p_titulo || '”');
    end if;
    if p_codigo is not null and p_codigo is distinct from antes.codigo then
      partes := partes || ('Código: ' || coalesce(nullif(antes.codigo, ''), 'sem código') || ' → ' || coalesce(nullif(p_codigo, ''), 'sem código'));
    end if;
    if array_length(partes, 1) > 0 then
      select nome, papel into quem from public.perfis where id = auth.uid();
      insert into public.demandas_edicao_eventos (demanda_id, tipo, ator_id, ator_nome, ator_papel, mensagem)
      values (p_demanda_id, 'edicao', auth.uid(), quem.nome, quem.papel, array_to_string(partes, ' · '));
    end if;
  end if;
end;
$function$;
