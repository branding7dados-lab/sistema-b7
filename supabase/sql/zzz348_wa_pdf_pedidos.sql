-- 4.58.0: o Otto pede o PDF e um B7 aberto (programa do PC ou navegador da equipe) desenha
-- com o MESMO código do botão de exportar — o design da ficha não muda.
create table if not exists public.wa_pdf_pedidos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('roteiros','linha')),
  ref_id uuid not null,
  titulo text,
  destino text not null,          -- conversa do WhatsApp para onde vai o PDF
  citar jsonb,                    -- mensagem do pedido (para responder citando)
  pedido_por text,
  status text not null default 'aguardando',   -- aguardando | gerando | pronto | enviado | erro
  pego_por uuid,
  path text,                      -- wa-midia/envio/otto/...
  nome text,
  erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists wa_pdf_pedidos_abertos on public.wa_pdf_pedidos (criado_em) where status in ('aguardando','gerando');
alter table public.wa_pdf_pedidos enable row level security;
drop policy if exists wa_pdf_ver on public.wa_pdf_pedidos;
create policy wa_pdf_ver on public.wa_pdf_pedidos for select to authenticated using (public.pode_ver_wa());
drop policy if exists wa_pdf_pegar on public.wa_pdf_pedidos;
create policy wa_pdf_pegar on public.wa_pdf_pedidos for update to authenticated using (public.pode_ver_wa()) with check (public.pode_ver_wa());
grant select, update on public.wa_pdf_pedidos to authenticated;
alter publication supabase_realtime add table public.wa_pdf_pedidos;
