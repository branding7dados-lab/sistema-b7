-- 4.85.0 — DADOS DO GRUPO E PERFIL DO CONTATO
-- Na Central, clicar no topo da conversa abre os dados do grupo (membros, admins, descrição) ou o perfil do contato.
-- O que se sabe de cada grupo fica guardado aqui, para abrir na hora; o servidor atualiza ao abrir, quando o WhatsApp
-- avisa que alguém entrou/saiu (GROUP_PARTICIPANTS_UPDATE) e na atualização de contatos (a cada 6 h).
-- Quem lê: quem vê o número (como as mensagens do grupo). Quem escreve: só o servidor. Pode rodar mais de uma vez.

create table if not exists public.wa_grupo_membros (
  numero_id uuid not null references public.wa_numeros (id),
  grupo_jid text not null,
  membro_jid text not null,                  -- pode ser @lid
  telefone text,                             -- só dígitos, quando se sabe
  admin text check (admin in ('admin', 'superadmin')),
  atualizado_em timestamptz not null default now(),
  primary key (numero_id, grupo_jid, membro_jid)
);
create index if not exists wa_grupo_membros_tel_idx on public.wa_grupo_membros (numero_id, telefone);
create index if not exists wa_grupo_membros_membro_idx on public.wa_grupo_membros (membro_jid);
alter table public.wa_grupo_membros enable row level security;
drop policy if exists wa_grupo_membros_ler on public.wa_grupo_membros;
create policy wa_grupo_membros_ler on public.wa_grupo_membros for select to authenticated using (public.wa_pode_ver_numero(numero_id));
revoke insert, update, delete on public.wa_grupo_membros from anon, authenticated;
grant select on public.wa_grupo_membros to authenticated;

alter table public.wa_conversas
  add column if not exists descricao text,
  add column if not exists criado_wa timestamptz,
  add column if not exists dono_jid text,
  add column if not exists so_admins_enviam boolean,
  add column if not exists so_admins_editam boolean,
  add column if not exists membros_qtd int,
  add column if not exists membros_em timestamptz;

-- grupos em que um contato está, nos números que QUEM CHAMA pode ver.
-- Casa pelo jid (inclusive @lid) ou pelo telefone (todos os dígitos): o passado, o do jid @s.whatsapp.net ou o de wa_contatos.
create or replace function public.wa_grupos_em_comum(p_jid text, p_telefone text default null)
returns table (numero_id uuid, grupo_jid text, nome text, foto_url text)
language sql stable security definer set search_path to 'public'
as $$
  with tel as (
    select nullif(regexp_replace(coalesce(
      nullif(p_telefone, ''),
      case when p_jid like '%@s.whatsapp.net' then split_part(p_jid, '@', 1) end,
      (select c.numero from public.wa_contatos c where c.jid = p_jid)
    ), '\D', '', 'g'), '') as t
  )
  select distinct m.numero_id, m.grupo_jid, coalesce(v.nome, m.grupo_jid) as nome, v.foto_url
    from public.wa_grupo_membros m
    cross join tel
    left join public.wa_conversas v on v.numero_id = m.numero_id and v.jid = m.grupo_jid
   where (m.membro_jid = p_jid or (tel.t is not null and m.telefone = tel.t))
     and public.wa_pode_ver_numero(m.numero_id)
   order by 3
$$;
grant execute on function public.wa_grupos_em_comum(text, text) to authenticated;
