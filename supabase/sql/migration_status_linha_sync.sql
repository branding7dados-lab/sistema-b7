-- =====================================================================
-- STATUS SEMANAL ↔ LINHA EDITORIAL — vínculo automático de situação
--
-- Hoje a situação de uma demanda do Status Semanal criada a partir de
-- um conteúdo da Linha Editorial nasce sempre num estado neutro (ex.:
-- "A produzir") e nunca mais acompanha o que acontece com o conteúdo —
-- a equipe muda o status na Linha Editorial (Em criação → Em revisão →
-- Aprovado → Programado → Publicado) e o card do Status Semanal fica
-- para trás, sem ninguém perceber. Esta migration liga as duas pontas:
--
--   1. `situacao_auto` (novo, default true): enquanto ninguém mexer na
--      situação de um card À MÃO, ela segue sozinha o status do
--      conteúdo vinculado — traduzido pro vocabulário do FORMATO da
--      demanda (Card/Story/Carrossel/Reel têm vocabulários próprios,
--      ver ESTAGIOS em js/doc-semana.js). Escolher a situação à mão no
--      card (select "SITUAÇÃO" aberto, ou o atalho "situações a
--      revisar") desliga o automático só PARA AQUELE card — é a saída
--      consciente, nunca um efeito colateral.
--   2. `mapa_situacao_de_conteudo`: mesma tradução de
--      `situacaoDeConteudo()` em js/doc-semana.js, do lado do banco —
--      usada pelo gatilho abaixo.
--   3. `conteudos_sync_status_itens`: gatilho em `conteudos.status` que
--      empurra a tradução pros `status_itens` vinculados (content_id)
--      que ainda estão em modo automático. Cobre TANTO uma edição
--      manual do status na Linha Editorial QUANTO a auto-publicação
--      por data (Programado + data de postagem já passada → Publicado,
--      ver `verificarPostagensAutomaticas` em js/linha.js e
--      `sincronizarComLinhaEditorial` em js/semana.js) — as duas
--      passam por uma atualização de `conteudos.status`, então só
--      existe UM lugar fazendo a ligação de verdade.
--
-- Aditiva e idempotente. Rode depois de migration_semana.sql e de
-- qualquer migration que já tenha criado `public.conteudos` (ex.:
-- migration_vcontent.sql) — as duas tabelas já existem em qualquer
-- banco de produção deste sistema a esta altura.
-- =====================================================================

alter table public.status_itens add column if not exists situacao_auto boolean not null default true;

comment on column public.status_itens.situacao_auto is
  'true = a situação deste item segue sozinha o status do conteúdo vinculado (conteudos.status via content_id), traduzida pro vocabulário do formato por mapa_situacao_de_conteudo(). Vira false quando alguém escolhe a situação à mão no card (js/semana.js) — dali em diante o card para de seguir a Linha Editorial até alguém religar manualmente.';

-- ---------------------------------------------------------------------
-- TRADUÇÃO conteudos.status -> situação do formato
-- Espelha situacaoDeConteudo() de js/doc-semana.js: "Ideia" e "Em
-- criação" mudam por formato (Card, Story, Carrossel, Reel — os únicos
-- valores de conteudos.tipo, ver FORMATOS em conteudo.js); "Em
-- revisão", "Aprovado", "Programado" e "Publicado" são o MESMO rótulo
-- nos quatro formatos (ver ESTAGIOS em js/doc-semana.js).
-- ---------------------------------------------------------------------
create or replace function public.mapa_situacao_de_conteudo(p_status text, p_formato text)
returns text language sql immutable as $$
  select case
    when p_status = 'Ideia' then
      case p_formato when 'Carrossel' then 'A estruturar' when 'Reel' then 'Escrevendo roteiro' else 'A produzir' end
    when p_status = 'Em criação' then
      case p_formato when 'Reel' then 'A gravar' else 'Criando arte' end
    when p_status = 'Em revisão'  then 'Revisão interna'
    when p_status = 'Aprovado'    then 'Aprovado pelo cliente'
    when p_status = 'Programado'  then 'Programado para postagem'
    when p_status = 'Publicado'   then 'Postado'
    else null
  end
$$;

-- ---------------------------------------------------------------------
-- GATILHO: conteudos.status mudou -> propaga pros status_itens
-- vinculados que ainda estão em modo automático. `security definer`
-- porque quem edita a Linha Editorial nem sempre tem RLS de escrita em
-- status_itens (a política de status_itens é só-equipe; o gatilho
-- precisa valer também quando quem mudou o status foi o próprio
-- designer/roteirista, sem direito de escrita nessa tabela).
-- ---------------------------------------------------------------------
create or replace function public.status_itens_sync_conteudo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    update public.status_itens si
       set situacao = public.mapa_situacao_de_conteudo(new.status, si.formato)
     where si.content_id = new.id
       and si.situacao_auto is true
       and si.deleted_at is null
       and public.mapa_situacao_de_conteudo(new.status, si.formato) is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists conteudos_sync_status_itens on public.conteudos;
create trigger conteudos_sync_status_itens
  after update of status on public.conteudos
  for each row execute function public.status_itens_sync_conteudo();
