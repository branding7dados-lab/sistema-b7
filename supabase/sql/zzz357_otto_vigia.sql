-- 4.65.0: "modo vigia" nos grupos de cliente (pedido do Yury): o Otto NÃO responde o cliente;
-- lê, entende o contexto e, se o cliente precisa de alguém e ninguém da equipe respondeu,
-- manda o print da conversa no grupo da equipe marcando o pessoal.
alter table public.wa_assistente add column if not exists modo_clientes text not null default 'vigia';  -- 'vigia' | 'atende'
alter table public.wa_assistente add column if not exists vigia_min integer not null default 20;          -- minutos sem resposta da equipe
alter table public.wa_assistente add column if not exists vigia_ultimo timestamptz;
update public.wa_assistente set modo_clientes = 'vigia' where id = 1;
