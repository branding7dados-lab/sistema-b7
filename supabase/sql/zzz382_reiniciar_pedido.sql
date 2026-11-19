-- 4.83.3: o envio do Otto pede para o relógio reiniciar a conexão quando a sessão do Evolution morre ("Connection Closed")
alter table public.wa_assistente add column if not exists reiniciar_pedido boolean not null default false;
