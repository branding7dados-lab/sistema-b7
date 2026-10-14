-- zzz165: conteúdo de vídeo da linha editorial — "gravação e edição" ou "só edição".
-- Só edição já vira demanda de edição (aparece em Edição de vídeo); gravação segue o fluxo de hoje.
-- Meme/trend e o link de referência vão junto para a demanda.
alter table public.conteudos add column if not exists producao_video text not null default 'gravacao';
alter table public.conteudos add column if not exists formato_video text not null default '';
alter table public.conteudos add column if not exists referencia_link text not null default '';
alter table public.conteudos add constraint conteudos_producao_video_chk check (producao_video in ('gravacao','edicao'));
alter table public.conteudos add constraint conteudos_formato_video_chk check (formato_video in ('','meme','trend'));
alter table public.conteudos add constraint conteudos_referencia_link_seguro check (referencia_link = '' or referencia_link ~* '^https?://');

alter table public.demandas_edicao add column if not exists conteudo_id uuid references public.conteudos(id) on delete set null;
alter table public.demandas_edicao add column if not exists formato_video text not null default '';
alter table public.demandas_edicao add column if not exists referencia_link text not null default '';
alter table public.demandas_edicao add constraint demandas_edicao_referencia_segura check (referencia_link = '' or referencia_link ~* '^https?://');
create unique index if not exists demandas_edicao_conteudo_uni on public.demandas_edicao (conteudo_id) where conteudo_id is not null and deleted_at is null;
alter table public.demandas_edicao drop constraint demandas_edicao_origem_check;
alter table public.demandas_edicao add constraint demandas_edicao_origem_check check (origem in ('manual','importacao','linha'));

create or replace function public.conteudo_video_so_edicao() returns trigger
language plpgsql security definer set search_path = public as $$
declare d public.demandas_edicao%rowtype; l public.linhas_editoriais%rowtype; ator public.perfis%rowtype; novo uuid;
begin
  if new.tipo <> 'Reel' or new.deleted_at is not null or new.archived_at is not null then return new; end if;
  select * into d from public.demandas_edicao where conteudo_id = new.id and deleted_at is null limit 1;
  if found then
    -- a demanda acompanha o conteúdo: referência e formato sempre; título só enquanto ninguém começou
    update public.demandas_edicao set formato_video = new.formato_video, referencia_link = new.referencia_link,
      titulo = case when editing_status = 'pendente' and btrim(coalesce(new.titulo,'')) <> '' then new.titulo else titulo end,
      updated_at = now()
     where id = d.id and ((formato_video, referencia_link) is distinct from (new.formato_video, new.referencia_link)
        or (editing_status = 'pendente' and btrim(coalesce(new.titulo,'')) <> '' and titulo is distinct from new.titulo));
    return new;
  end if;
  if new.producao_video <> 'edicao' then return new; end if;
  select * into l from public.linhas_editoriais where id = new.linha_id;
  select * into ator from public.perfis where id = auth.uid();
  insert into public.demandas_edicao (client_id, competencia_ano, competencia_mes, codigo, titulo, prazo, observacoes, origem,
      criado_por, editing_status, prioridade, conteudo_id, formato_video, referencia_link)
  values (new.client_id, coalesce(l.ano, extract(year from now())::int), coalesce(l.mes, extract(month from now())::int), '',
      coalesce(nullif(btrim(new.titulo), ''), 'Vídeo da linha editorial'), new.data_postagem,
      coalesce(new.ideia_geral, ''), 'linha', auth.uid(), 'pendente', 'normal', new.id, new.formato_video, new.referencia_link)
  returning id into novo;
  insert into public.demandas_edicao_eventos (demanda_id, tipo, para_status, ator_id, ator_nome, ator_papel, mensagem)
  values (novo, 'criada', 'pendente', auth.uid(), ator.nome, ator.papel, 'Criada pela linha editorial (só edição)');
  return new;
end $$;
drop trigger if exists conteudo_video_so_edicao on public.conteudos;
create trigger conteudo_video_so_edicao after insert or update on public.conteudos
  for each row execute function public.conteudo_video_so_edicao();
