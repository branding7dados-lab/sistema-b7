-- zzz296: "Esqueci minha senha" + e-mail de recuperação.
-- seguranca_2fa.email_recuperacao: e-mail confirmado (com código) só para
-- recuperar a senha — não liga a verificação em 2 etapas.
-- seguranca_codigos: dois tipos novos de código ('senha' e 'cadastro_rec').
alter table public.seguranca_2fa add column if not exists email_recuperacao text;
alter table public.seguranca_codigos
  drop constraint if exists seguranca_codigos_finalidade_check,
  add constraint seguranca_codigos_finalidade_check
    check (finalidade = any (array['login', 'cadastro_email', 'transferir_supremo', 'senha', 'cadastro_rec']));
