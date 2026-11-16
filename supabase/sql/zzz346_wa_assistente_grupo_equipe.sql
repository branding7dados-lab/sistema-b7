-- 4.56.0: grupo da equipe — pendências dos grupos de cliente e perguntas sobre qualquer cliente
alter table public.wa_assistente add column if not exists grupo_equipe text;
alter table public.wa_assistente add column if not exists resumo_horas int not null default 3;
alter table public.wa_assistente add column if not exists resumo_ultimo timestamptz;
alter table public.wa_assistente add column if not exists resumo_espera_min int not null default 30;
