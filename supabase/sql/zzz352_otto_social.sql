-- 4.59.2: o Otto reage, manda figurinha e conversa com outras IAs do grupo.
-- Figurinhas que o Otto conhece: uma por arquivo (fileSha256), com a
-- descrição que a IA de visão fez — é por ela que ele escolhe qual mandar.
create table if not exists public.wa_figurinhas (
  sha text primary key,
  msg_id text not null,
  descricao text,
  usos integer not null default 0,
  criada_em timestamptz not null default now()
);
alter table public.wa_figurinhas enable row level security;
drop policy if exists wa_figurinhas_admin_le on public.wa_figurinhas;
create policy wa_figurinhas_admin_le on public.wa_figurinhas for select to authenticated using (public.sou_admin());

-- outras IAs no grupo da equipe (o Otto conversa com elas, com limite)
alter table public.wa_assistente add column if not exists bots jsonb not null default '[]'::jsonb;
update public.wa_assistente
   set bots = '[{"jid":"61512991383626@lid","nome":"Gabriel Martins","sobre":"a IA do comercial da Núcleo 7; ainda está aprendendo e costuma responder no automático, como se tudo fosse um pedido de cliente"}]'::jsonb
 where id = 1 and bots = '[]'::jsonb;
