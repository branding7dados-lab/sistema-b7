-- 4.75.0: "Se apresentar como assistente virtual" — desligado (padrão): o Otto fala como gente da equipe.
alter table public.wa_assistente add column if not exists se_apresenta_ia boolean not null default false;
