-- =========================================================================
-- B7 VÍDEO — COMENTÁRIOS COM TIMECODE (Parte 2, complemento)
-- =========================================================================
-- Estende o Workspace de Vídeo (migration_video_workspace.sql) — aditivo,
-- não mexe em nada que já existe. Fica ligado à VERSÃO exata (não à
-- demanda em geral): comentário feito na V01 não aparece "solto" na V02.
--
-- IMPORTANTE — limitação real, não escondida: o player embutido é o
-- preview do próprio Google Drive (iframe cross-origin, sem API pública
-- documentada). Não dá pra capturar automaticamente "em que segundo o
-- vídeo está" nem pular o player pra um timecode ao clicar num
-- comentário. Por isso o timecode aqui é DIGITADO por quem comenta
-- (campo mm:ss), não capturado do player. Fica registrado, ordenado e
-- visível — só não pilota o player sozinho.
-- =========================================================================

create table if not exists public.video_comentarios (
  id            uuid primary key default gen_random_uuid(),
  versao_id     uuid not null references public.video_versoes(id) on delete cascade,
  demanda_id    uuid not null references public.demandas_edicao(id) on delete cascade,
  timecode_seg  int not null check (timecode_seg >= 0),
  texto         text not null,
  autor_id      uuid references public.perfis(id),
  created_at    timestamptz not null default now()
);
create index if not exists video_comentarios_versao on public.video_comentarios (versao_id, timecode_seg);

alter table public.video_comentarios enable row level security;
revoke insert, update, delete on public.video_comentarios from authenticated;
grant select on public.video_comentarios to authenticated;

-- Mesma regra de leitura de video_versoes: equipe vê tudo, videomaker
-- só vê o que é dele, cliente/portal não entra aqui (sou_equipe_interna()).
drop policy if exists "video_comentarios select" on public.video_comentarios;
create policy "video_comentarios select" on public.video_comentarios
  for select to authenticated
  using (exists (select 1 from public.demandas_edicao d
                  where d.id = demanda_id and d.deleted_at is null
                    and (public.sou_equipe() or d.videomaker_id = auth.uid())
                    and public.sou_equipe_interna()));

create or replace view public.video_comentarios_resumo
with (security_invoker = true) as
select vc.*, p.nome as autor_nome
  from public.video_comentarios vc
  left join public.perfis p on p.id = vc.autor_id;
grant select on public.video_comentarios_resumo to authenticated;

-- ---------------------------------------------------------------------
-- CRIAR COMENTÁRIO — mesma permissão de quem opera a demanda (equipe ou
-- o videomaker responsável): tanto faz quem comenta, o timecode e o
-- autor ficam registrados de verdade.
-- ---------------------------------------------------------------------
create or replace function public.video_criar_comentario(
  p_versao_id uuid, p_timecode_seg int, p_texto text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v public.video_versoes%rowtype; d public.demandas_edicao%rowtype; novo_id uuid;
begin
  select * into v from public.video_versoes where id = p_versao_id;
  if not found then raise exception 'Versão não encontrada.'; end if;

  select * into d from public.demandas_edicao where id = v.demanda_id and deleted_at is null;
  if not found then raise exception 'Demanda não encontrada.'; end if;

  if not (public.sou_equipe() or d.videomaker_id = auth.uid()) then
    raise exception 'Sem permissão para comentar nesta demanda.' using errcode = '42501';
  end if;

  if p_timecode_seg is null or p_timecode_seg < 0 then
    raise exception 'Timecode inválido.';
  end if;
  if p_texto is null or btrim(p_texto) = '' then
    raise exception 'Escreva o comentário.';
  end if;

  insert into public.video_comentarios (versao_id, demanda_id, timecode_seg, texto, autor_id)
  values (p_versao_id, v.demanda_id, p_timecode_seg, btrim(p_texto), auth.uid())
  returning id into novo_id;

  return novo_id;
end;
$$;
revoke all on function public.video_criar_comentario(uuid, int, text) from public;
grant execute on function public.video_criar_comentario(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- EXCLUIR COMENTÁRIO — quem escreveu, ou equipe (admin/coordenador).
-- Um videomaker não apaga comentário de outra pessoa.
-- ---------------------------------------------------------------------
create or replace function public.video_excluir_comentario(p_comentario_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.video_comentarios%rowtype;
begin
  select * into c from public.video_comentarios where id = p_comentario_id;
  if not found then raise exception 'Comentário não encontrado.'; end if;

  if not (public.sou_equipe() or c.autor_id = auth.uid()) then
    raise exception 'Sem permissão para excluir este comentário.' using errcode = '42501';
  end if;

  delete from public.video_comentarios where id = p_comentario_id;
end;
$$;
revoke all on function public.video_excluir_comentario(uuid) from public;
grant execute on function public.video_excluir_comentario(uuid) to authenticated;
