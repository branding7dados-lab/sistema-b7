-- 4.78.0: aviso "estamos esperando retorno de cliente" no grupo da equipe (0 = desligado)
alter table public.wa_assistente add column if not exists esperando_cliente_h int not null default 24;
alter table public.wa_assistente add column if not exists cobrar_ultimo timestamptz;
alter table public.wa_assistente drop constraint if exists wa_assistente_esperando_cliente_chk;
alter table public.wa_assistente add constraint wa_assistente_esperando_cliente_chk check (esperando_cliente_h between 0 and 168);
