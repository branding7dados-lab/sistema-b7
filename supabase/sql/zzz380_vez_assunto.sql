-- 4.82.0: de que assunto é a pendência da conversa (artes, video, gravacao...) — para marcar o responsável certo
alter table public.wa_conversas add column if not exists vez_assunto text;
