-- 4.84.0 — VÁRIOS NÚMEROS DE WHATSAPP NO B7
-- Até aqui o B7 tinha um número só (o dos videomakers, instância b7-piloto do Evolution).
-- Agora cada número da agência (Videomakers, Designers, Coordenação…) é cadastrado em wa_numeros,
-- e TODA conversa e TODA mensagem sabem por qual número passaram (numero_id).
--
-- Por que a chave muda: o mesmo grupo de cliente pode ter o número dos vídeos E o do design.
-- A mesma mensagem chega pelos dois com o mesmo id do WhatsApp — com a chave antiga (jid / id)
-- uma apagaria a outra. Chaves novas: wa_conversas (numero_id, jid), wa_mensagens (numero_id, id).
--
-- Compatível com o que já está no ar: numero_id tem default = número padrão, então as Edge
-- Functions antigas continuam gravando no número dos Videomakers até o deploy novo.
-- Quem vê: administrador vê todos; os demais, os números cujas equipes incluem o papel ou
-- uma função extra da pessoa. Pode rodar mais de uma vez.
-- Depois de aplicar: se o segredo EVOLUTION_INSTANCE não for 'b7-piloto',
--   update public.wa_numeros set instancia = '<valor>' where padrao;

-- ------------------------------------------------------------ cadastro
create table if not exists public.wa_numeros (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  instancia text not null unique,            -- nome da instância no Evolution
  cor text not null default '#1B8F6A',
  equipes text[] not null default '{}',      -- videomaker, designer, coordenador
  padrao boolean not null default false,     -- o número do Otto e das funções antigas
  numero text,                               -- telefone conectado (só dígitos)
  estado text,                               -- open, close, connecting… (último conferido)
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now(),
  constraint wa_numeros_equipes_ok check (equipes <@ array['videomaker', 'designer', 'coordenador']::text[])
);
create unique index if not exists wa_numeros_um_padrao on public.wa_numeros (padrao) where padrao;
insert into public.wa_numeros (nome, instancia, cor, equipes, padrao, ordem)
select 'Videomakers', 'b7-piloto', '#E8452C', '{videomaker}', true, 0
 where not exists (select 1 from public.wa_numeros where padrao)
on conflict (instancia) do nothing;

create or replace function public.wa_numero_padrao()
returns uuid language sql stable security definer set search_path to 'public'
as $$ select id from public.wa_numeros where padrao limit 1 $$;
grant execute on function public.wa_numero_padrao() to authenticated, service_role;

-- ------------------------------------------------------------ quem vê cada número
create or replace function public.wa_pode_ver_numero(p_numero uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select coalesce(public.sou_admin(), false) or exists (
    select 1 from public.wa_numeros n join public.perfis p on p.id = auth.uid()
     where n.id = p_numero and n.ativo and p.estado = 'ativa' and p.papel <> 'cliente'
       and (p.papel = any(n.equipes) or exists (select 1 from unnest(n.equipes) e where public.tenho_funcao_extra(e, p.id))))
$$;
grant execute on function public.wa_pode_ver_numero(uuid) to authenticated;

-- "vê o WhatsApp" = vê ao menos um número ativo (vale para contatos, configurações, mídia…)
create or replace function public.pode_ver_wa()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.wa_numeros n where n.ativo and public.wa_pode_ver_numero(n.id)) $$;
grant execute on function public.pode_ver_wa() to authenticated;

alter table public.wa_numeros enable row level security;
drop policy if exists wa_numeros_ler on public.wa_numeros;
create policy wa_numeros_ler on public.wa_numeros for select to authenticated
  using (coalesce(public.sou_admin(), false) or (ativo and public.wa_pode_ver_numero(id)));
revoke insert, update, delete on public.wa_numeros from anon, authenticated;
grant select on public.wa_numeros to authenticated;

-- ------------------------------------------------------------ numero_id nas conversas e mensagens
alter table public.wa_conversas add column if not exists numero_id uuid;
alter table public.wa_mensagens add column if not exists numero_id uuid;
update public.wa_conversas set numero_id = public.wa_numero_padrao() where numero_id is null;
update public.wa_mensagens set numero_id = public.wa_numero_padrao() where numero_id is null;
alter table public.wa_conversas alter column numero_id set default public.wa_numero_padrao(), alter column numero_id set not null;
alter table public.wa_mensagens alter column numero_id set default public.wa_numero_padrao(), alter column numero_id set not null;

do $$
declare r record;
begin
  -- 1) chaves estrangeiras que apontam para as chaves antigas (wa_mensagens → wa_conversas e quaisquer outras)
  for r in select c.conname, c.conrelid::regclass t from pg_constraint c
            where c.contype = 'f' and c.confrelid in ('public.wa_conversas'::regclass, 'public.wa_mensagens'::regclass)
              and c.conname <> 'wa_mensagens_conversa_fk' loop
    raise notice 'zzz383: tirando a chave estrangeira % de %', r.conname, r.t;
    execute format('alter table %s drop constraint %I', r.t, r.conname);
  end loop;
  -- 2) chave primária de wa_conversas → (numero_id, jid)
  select conname into r from pg_constraint where conrelid = 'public.wa_conversas'::regclass and contype = 'p';
  if r.conname is not null and pg_get_constraintdef((select oid from pg_constraint where conrelid = 'public.wa_conversas'::regclass and contype = 'p')) <> 'PRIMARY KEY (numero_id, jid)' then
    execute format('alter table public.wa_conversas drop constraint %I', r.conname);
    r := null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.wa_conversas'::regclass and contype = 'p') then
    alter table public.wa_conversas add constraint wa_conversas_pkey primary key (numero_id, jid);
  end if;
  -- 3) chave primária de wa_mensagens → (numero_id, id)
  select conname into r from pg_constraint where conrelid = 'public.wa_mensagens'::regclass and contype = 'p';
  if r.conname is not null and pg_get_constraintdef((select oid from pg_constraint where conrelid = 'public.wa_mensagens'::regclass and contype = 'p')) <> 'PRIMARY KEY (numero_id, id)' then
    execute format('alter table public.wa_mensagens drop constraint %I', r.conname);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.wa_mensagens'::regclass and contype = 'p') then
    alter table public.wa_mensagens add constraint wa_mensagens_pkey primary key (numero_id, id);
  end if;
  -- 4) mensagem pertence a uma conversa DO MESMO número; conversa pertence a um número cadastrado
  if not exists (select 1 from pg_constraint where conname = 'wa_mensagens_conversa_fk') then
    alter table public.wa_mensagens add constraint wa_mensagens_conversa_fk
      foreign key (numero_id, jid) references public.wa_conversas (numero_id, jid) on delete cascade on update cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'wa_conversas_numero_fk') then
    alter table public.wa_conversas add constraint wa_conversas_numero_fk foreign key (numero_id) references public.wa_numeros (id);
  end if;
end $$;
create index if not exists wa_mensagens_numero_conversa_idx on public.wa_mensagens (numero_id, jid, criada_em desc);
create index if not exists wa_mensagens_id_idx on public.wa_mensagens (id);
create index if not exists wa_conversas_numero_ultima_idx on public.wa_conversas (numero_id, ultima_em desc nulls last);

-- ------------------------------------------------------------ leitura por número
drop policy if exists wa_conversas_ler on public.wa_conversas;
create policy wa_conversas_ler on public.wa_conversas for select to authenticated using (public.wa_pode_ver_numero(numero_id));
drop policy if exists wa_mensagens_ler on public.wa_mensagens;
create policy wa_mensagens_ler on public.wa_mensagens for select to authenticated using (public.wa_pode_ver_numero(numero_id));

-- ------------------------------------------------------------ ações locais da Central, por número
drop function if exists public.wa_conversa_marcar(text, text, text);
create or replace function public.wa_conversa_marcar(p_jid text, p_campo text, p_valor text default null, p_numero uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare v text; nid uuid := coalesce(p_numero, public.wa_numero_padrao());
begin
  if not public.wa_pode_ver_numero(nid) then raise exception 'Sem acesso a este número.' using errcode = '42501'; end if;
  if p_campo = 'lida' then update public.wa_conversas set nao_lidas = 0 where numero_id = nid and jid = p_jid;
  elsif p_campo = 'arquivada' then update public.wa_conversas set arquivada = coalesce(p_valor, 'true')::boolean where numero_id = nid and jid = p_jid;
  elsif p_campo = 'fixada' then update public.wa_conversas set fixada = coalesce(p_valor, 'true')::boolean where numero_id = nid and jid = p_jid;
  elsif p_campo = 'cliente' then update public.wa_conversas set cliente_id = nullif(p_valor, '')::uuid where numero_id = nid and jid = p_jid;
  elsif p_campo = 'responsavel' then update public.wa_conversas set responsavel_id = nullif(p_valor, '')::uuid where numero_id = nid and jid = p_jid;
  elsif p_campo = 'sem_espera' then update public.wa_conversas set esperando_desde = null, aguardando_cliente_desde = null,
      vez = 'ninguem', vez_motivo = 'Marcado pela equipe como respondido', vez_avaliada_em = now() where numero_id = nid and jid = p_jid;
  elsif p_campo = 'nome' then
    v := left(btrim(coalesce(p_valor, '')), 80);
    if v = '' then
      update public.wa_conversas set nome_fixo = false, nome = split_part(jid, '@', 1) where numero_id = nid and jid = p_jid and tipo <> 'grupo';
      update public.wa_contatos set nome_fixo = false where jid = p_jid;
      update public.wa_conversas set nome_fixo = false where numero_id = nid and jid = p_jid and tipo = 'grupo';
    else
      update public.wa_conversas set nome = v, nome_fixo = true where numero_id = nid and jid = p_jid;
      -- contato: o nome vale para a pessoa (em qualquer número) e para as mensagens dela nos grupos
      if p_jid not like '%@g.us' then
        insert into public.wa_contatos(jid, nome, nome_fixo, atualizado_em) values (p_jid, v, true, now())
        on conflict (jid) do update set nome = excluded.nome, nome_fixo = true, atualizado_em = now();
        update public.wa_mensagens set autor_nome = v where autor_jid = p_jid and not de_mim;
      end if;
    end if;
  else raise exception 'Campo inválido.';
  end if;
end $function$;
grant execute on function public.wa_conversa_marcar(text, text, text, uuid) to authenticated;

drop function if exists public.wa_nota_interna(text, text);
create or replace function public.wa_nota_interna(p_jid text, p_texto text, p_numero uuid default null)
returns text language plpgsql security definer set search_path to 'public'
as $$
declare v_id text := 'nota_' || replace(gen_random_uuid()::text, '-', ''); v_nome text; nid uuid := coalesce(p_numero, public.wa_numero_padrao());
begin
  if not public.wa_pode_ver_numero(nid) then raise exception 'Sem acesso a este número.' using errcode = '42501'; end if;
  if coalesce(btrim(p_texto), '') = '' then raise exception 'Escreva a nota.'; end if;
  select coalesce(nullif(btrim(nome), ''), username) into v_nome from public.perfis where id = auth.uid();
  insert into public.wa_mensagens (numero_id, id, jid, de_mim, tipo, texto, nota, enviada_por, enviada_por_nome, criada_em)
  values (nid, v_id, p_jid, true, 'texto', left(p_texto, 4000), true, auth.uid(), v_nome, now());
  return v_id;
end $$;
grant execute on function public.wa_nota_interna(text, text, uuid) to authenticated;

-- ------------------------------------------------------------ juntar @lid ↔ número, dentro de cada número
create or replace function public.wa_unir_lids()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare r record; n int := 0; pn text;
begin
  -- aprende o número pelo nome único (contatos valem para todos os números)
  update wa_contatos l set numero = split_part(p.jid, '@', 1)
    from wa_conversas v
    join lateral (select jid from wa_conversas p2
                   where p2.numero_id = v.numero_id and p2.tipo <> 'grupo' and p2.jid like '%@s.whatsapp.net' and p2.nome = v.nome) p on true
   where l.jid = v.jid and v.jid like '%@lid' and l.numero is null
     and coalesce(v.nome,'') <> '' and v.nome !~ '^\+?[0-9]+$'
     and (select count(*) from wa_conversas p3 where p3.numero_id = v.numero_id and p3.tipo <> 'grupo' and p3.jid like '%@s.whatsapp.net' and p3.nome = v.nome) = 1;
  insert into wa_contatos(jid, numero, nome)
  select distinct on (v.jid) v.jid, split_part(p.jid, '@', 1), v.nome
    from wa_conversas v join wa_conversas p on p.numero_id = v.numero_id and p.nome = v.nome and p.tipo <> 'grupo' and p.jid like '%@s.whatsapp.net'
   where v.jid like '%@lid' and coalesce(v.nome,'') <> '' and v.nome !~ '^\+?[0-9]+$'
     and not exists (select 1 from wa_contatos c where c.jid = v.jid)
     and (select count(*) from wa_conversas p3 where p3.numero_id = v.numero_id and p3.tipo <> 'grupo' and p3.jid like '%@s.whatsapp.net' and p3.nome = v.nome) = 1
  on conflict (jid) do nothing;

  for r in select v.*, c.numero from wa_conversas v join wa_contatos c on c.jid = v.jid
            where v.jid like '%@lid' and v.tipo <> 'grupo' and c.numero ~ '^[0-9]{8,}$' loop
    pn := r.numero || '@s.whatsapp.net';
    if exists (select 1 from wa_conversas where numero_id = r.numero_id and jid = pn) then
      -- mensagem com o mesmo id já na conversa do número: fica a de lá
      delete from wa_mensagens m where m.numero_id = r.numero_id and m.jid = r.jid
         and exists (select 1 from wa_mensagens x where x.numero_id = r.numero_id and x.id = m.id and x.jid = pn);
      update wa_mensagens set jid = pn where numero_id = r.numero_id and jid = r.jid;
      update wa_conversas p set
        foto_url = coalesce(p.foto_url, r.foto_url),
        cliente_id = coalesce(p.cliente_id, r.cliente_id),
        responsavel_id = coalesce(p.responsavel_id, r.responsavel_id),
        fixada = p.fixada or coalesce(r.fixada, false),
        nao_lidas = coalesce(p.nao_lidas, 0) + coalesce(r.nao_lidas, 0),
        nome = case when p.nome ~ '^\+?[0-9]+$' and r.nome !~ '^\+?[0-9]+$' then r.nome else p.nome end,
        ultima_em = greatest(p.ultima_em, r.ultima_em),
        previa = case when r.ultima_em > coalesce(p.ultima_em, '-infinity') then r.previa else p.previa end,
        previa_autor = case when r.ultima_em > coalesce(p.ultima_em, '-infinity') then r.previa_autor else p.previa_autor end,
        previa_de_mim = case when r.ultima_em > coalesce(p.ultima_em, '-infinity') then r.previa_de_mim else p.previa_de_mim end,
        esperando_desde = case when r.ultima_em > coalesce(p.ultima_em, '-infinity') then r.esperando_desde else p.esperando_desde end,
        atualizado_em = now()
       where p.numero_id = r.numero_id and p.jid = pn;
      delete from wa_conversas where numero_id = r.numero_id and jid = r.jid;
    else
      -- a chave estrangeira acompanha a troca de jid (on update cascade): renomeia a conversa
      update wa_conversas set jid = pn, atualizado_em = now() where numero_id = r.numero_id and jid = r.jid;
    end if;
    n := n + 1;
  end loop;

  -- foto guardada no contato @lid vale para a conversa do número
  update wa_conversas v set foto_url = c.foto_url
    from wa_contatos c
   where c.jid like '%@lid' and c.numero is not null and v.jid = c.numero || '@s.whatsapp.net'
     and c.foto_url is not null and v.foto_url is null;
  return n;
end $$;
revoke all on function public.wa_unir_lids() from public, anon, authenticated;
