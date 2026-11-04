-- =====================================================================
-- REMOVE AS SOBRAS DO WHATSAPP (zzz85) — pedido do Kevin em 07/10/2026.
-- A zzz83 criou a tabela perfil_contatos e duas colunas em notificacoes;
-- a zzz84 retirou o recurso e deixou a estrutura vazia. Aqui ela sai.
-- Só apaga se estiver tudo vazio (se não estiver, para e não apaga nada).
-- Desfaz migration_whatsapp.sql.
-- =====================================================================
do $$
begin
  if exists (select 1 from public.perfil_contatos) then
    raise exception 'perfil_contatos tem linhas: nada foi apagado.';
  end if;
  if exists (select 1 from public.notificacoes where whatsapp_status is not null or whatsapp_em is not null) then
    raise exception 'há avisos com registro de WhatsApp: nada foi apagado.';
  end if;
end $$;

drop table public.perfil_contatos;
alter table public.notificacoes drop column whatsapp_status;
alter table public.notificacoes drop column whatsapp_em;
