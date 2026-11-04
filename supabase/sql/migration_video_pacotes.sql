-- =========================================================================
-- B7 VÍDEO — CATÁLOGO DE PACOTES PREDEFINIDOS
-- =========================================================================
-- Hoje o campo "Pacote" de cada demanda de edição é texto livre (ex.:
-- "Mensal 8 vídeos"). Isso continua existindo — NÃO vira obrigatório
-- nem trava quem quer digitar algo diferente. O que entra aqui é só um
-- catálogo de sugestões que admin/coordenador cadastra, pra não ter
-- que digitar o mesmo nome de pacote toda vez (e pra não ter "Mensal 8
-- vídeos", "mensal 8 videos", "Mensal - 8 vídeos" como três coisas
-- diferentes por causa de digitação).
--
-- Por isso NÃO é uma foreign key em demandas_edicao.pacote — é só uma
-- lista que alimenta um autocomplete (datalist) no formulário. Isso
-- evita qualquer risco de quebrar as demandas já existentes (que já
-- têm valores de "Pacote" livres, inclusive vindos de importação de
-- planilha).
-- =========================================================================

create table if not exists public.video_pacotes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  criado_por  uuid references public.perfis(id),
  created_at  timestamptz not null default now(),
  constraint video_pacotes_nome_unico unique (nome)
);

alter table public.video_pacotes enable row level security;
revoke insert, update, delete on public.video_pacotes from authenticated;
grant select on public.video_pacotes to authenticated;

-- Só quem monta demandas (admin/coordenador) precisa ver/gerenciar o
-- catálogo — o mesmo público que já vê o campo "Pacote" editável.
drop policy if exists "video_pacotes select" on public.video_pacotes;
create policy "video_pacotes select" on public.video_pacotes
  for select to authenticated
  using (public.sou_equipe() and public.sou_equipe_interna());

create or replace function public.video_criar_pacote(p_nome text)
returns uuid language plpgsql security definer set search_path = public as $$
declare novo_id uuid; nome_limpo text;
begin
  if not public.sou_equipe() then
    raise exception 'Sem permissão para gerenciar pacotes.' using errcode = '42501';
  end if;
  nome_limpo := btrim(coalesce(p_nome, ''));
  if nome_limpo = '' then
    raise exception 'Escreva o nome do pacote.';
  end if;
  begin
    insert into public.video_pacotes (nome, criado_por) values (nome_limpo, auth.uid())
    returning id into novo_id;
  exception when unique_violation then
    raise exception 'Já existe um pacote com esse nome.';
  end;
  return novo_id;
end;
$$;
revoke all on function public.video_criar_pacote(text) from public;
grant execute on function public.video_criar_pacote(text) to authenticated;

create or replace function public.video_excluir_pacote(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.sou_equipe() then
    raise exception 'Sem permissão para gerenciar pacotes.' using errcode = '42501';
  end if;
  delete from public.video_pacotes where id = p_id;
  -- Apagar do catálogo não mexe em nenhuma demanda existente: o texto
  -- que já está salvo em demandas_edicao.pacote continua exatamente
  -- como está, porque não há vínculo (FK) entre as duas tabelas.
end;
$$;
revoke all on function public.video_excluir_pacote(uuid) from public;
grant execute on function public.video_excluir_pacote(uuid) to authenticated;
