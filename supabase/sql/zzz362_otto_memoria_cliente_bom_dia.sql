-- 4.70.0: memória por cliente, aprender com correções e bom dia da equipe.
--   wa_otto_memoria.cliente_id : a lembrança é sobre este cliente (null = vale para tudo)
--   wa_otto_memoria.origem     : 'pedido' (pediram para lembrar) | 'correcao' (alguém corrigiu o Otto) | 'tela'
--   wa_assistente.bom_dia_*    : bom dia da equipe no grupo interno (dias úteis, a partir da hora)
alter table public.wa_otto_memoria add column if not exists cliente_id uuid references public.clientes(id) on delete cascade;
alter table public.wa_otto_memoria add column if not exists origem text not null default 'pedido';
create index if not exists wa_otto_memoria_cliente_idx on public.wa_otto_memoria (cliente_id) where ativo;
alter table public.wa_assistente add column if not exists bom_dia_ligado boolean not null default true;
alter table public.wa_assistente add column if not exists bom_dia_hora text not null default '08:00';
alter table public.wa_assistente add column if not exists bom_dia_ultimo date;
