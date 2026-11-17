-- 4.67.4: regras fixas da EQUIPE no Otto + modo restrito + nível máximo de zoação.
--   regras_equipe : regras que valem quando ele fala com a equipe (grupo interno e privado de quem é da equipe)
--   modo_restrito : ligado = nada de palavrão/xingamento em lugar nenhum; desligado = zoação liberada com a equipe
--   zoacao_nivel  : até onde a zoação pode ir — 'leve' | 'medio' | 'pesado' (ele mede pelo tom de quem pediu, até esse teto)
alter table public.wa_assistente add column if not exists regras_equipe text not null default '';
alter table public.wa_assistente add column if not exists modo_restrito boolean not null default false;
alter table public.wa_assistente add column if not exists zoacao_nivel text not null default 'medio';
alter table public.wa_assistente drop constraint if exists wa_assistente_zoacao_nivel_chk;
alter table public.wa_assistente add constraint wa_assistente_zoacao_nivel_chk check (zoacao_nivel in ('leve', 'medio', 'pesado'));
