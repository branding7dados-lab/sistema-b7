-- =====================================================================
-- ADMIN: SAÚDE DO SISTEMA, MÉDICO, COMUNICADO E SESSÃO DERRUBADA (zzz139)
--
-- Tudo aqui é NOVO ou aditivo. Nenhuma regra de acesso (RLS) é alterada,
-- nenhuma tabela é apagada e nenhum dado existente é modificado.
--
--   1) sessao_valida(): a sessão deste aparelho ainda existe? Usada por
--      sistema_avisos() para derrubar o aparelho em até 1 minuto depois
--      de o administrador encerrar a sessão.
--   2) saude_sistema(): só leitura, só administrador — rotinas agendadas,
--      avisos (push), Google Agenda, espaço usado e a IA nas últimas 24 h.
--   3) medico_achados(): só leitura, só administrador — o que está
--      incompleto nos cadastros. Não corrige nada.
--   4) Comunicado pelo chat: chat_comunicados (tabela nova),
--      chat_mensagens.comunicado_id (coluna nova, opcional),
--      chat_comunicado(), chat_comunicado_lidos(), chat_comunicados_lista().
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Sessão derrubada na hora
-- ---------------------------------------------------------------------
create or replace function public.sessao_valida()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- sem identificador de sessão no acesso (ex.: acesso por programa), não derruba ninguém
  select case when coalesce(auth.jwt() ->> 'session_id', '') = '' then true
              else exists (select 1 from auth.sessions s where s.id::text = auth.jwt() ->> 'session_id') end;
$$;
revoke all on function public.sessao_valida() from public, anon;
grant execute on function public.sessao_valida() to authenticated;

-- a consulta que cada tela já faz a cada minuto ganha o campo "sessao"
create or replace function public.sistema_avisos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('agora', now(), 'sessao', public.sessao_valida(), 'manutencao', (
    select c.valor - 'por'
      from public.sistema_config c
     where c.chave = 'manutencao'
       and coalesce((c.valor ->> 'ativo')::boolean, false)
       and (c.valor ->> 'fim' is null or (c.valor ->> 'fim')::timestamptz > now())
       and (public.sou_equipe_interna() or coalesce((c.valor ->> 'portal')::boolean, false))
       and (public.sou_admin() or (c.valor ->> 'inicio')::timestamptz <= now() + interval '10 minutes')));
$$;
revoke all on function public.sistema_avisos() from public, anon;
grant execute on function public.sistema_avisos() to authenticated;

-- ---------------------------------------------------------------------
-- 2) Saúde do sistema (só leitura)
-- ---------------------------------------------------------------------
create or replace function public.saude_sistema()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rotinas jsonb;
  v_push jsonb;
  v_google jsonb;
  v_ia jsonb;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador vê a saúde do sistema.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nome', j.jobname, 'agenda', j.schedule, 'ativa', j.active,
           'ultima', d.start_time, 'status', d.status) order by j.jobid), '[]'::jsonb)
    into v_rotinas
    from cron.job j
    left join lateral (select start_time, status from cron.job_run_details r
                        where r.jobid = j.jobid order by start_time desc limit 1) d on true;

  select jsonb_build_object(
           'ok24', count(*) filter (where status_code between 200 and 299 and created > now() - interval '24 hours'),
           'falhas24', count(*) filter (where (status_code is null or status_code not between 200 and 299) and created > now() - interval '24 hours'),
           'ultimo', max(created))
    into v_push from net._http_response;
  v_push := coalesce(v_push, '{}'::jsonb) || jsonb_build_object('aparelhos', (select count(*) from public.push_subscricoes));

  select coalesce(jsonb_agg(jsonb_build_object('status', status, 'erro', left(coalesce(ultimo_erro, ''), 160),
                                               'ultima', ultima_sincronizacao)), '[]'::jsonb)
    into v_google from public.calendario_conexoes;

  select jsonb_build_object(
           'total24', count(*), 'erros24', count(*) filter (where status <> 'ok'),
           'ultimo', max(created_at))
    into v_ia from public.ia_uso where created_at > now() - interval '24 hours';

  return jsonb_build_object(
    'agora', now(),
    'rotinas', v_rotinas,
    'push', v_push,
    'google', v_google,
    'ia', v_ia,
    'banco_bytes', pg_database_size(current_database()),
    'arquivos_bytes', (select coalesce(sum(coalesce((metadata ->> 'size')::bigint, 0)), 0) from storage.objects),
    'arquivos_qtd', (select count(*) from storage.objects),
    'online', (select count(*) from public.perfis where estado = 'ativa' and last_seen_at > now() - interval '5 minutes'),
    'equipe', (select count(*) from public.perfis where estado = 'ativa' and papel <> 'cliente'));
end
$$;
revoke all on function public.saude_sistema() from public, anon;
grant execute on function public.saude_sistema() to authenticated;

-- ---------------------------------------------------------------------
-- 3) Médico do sistema (só leitura): o que está incompleto
-- ---------------------------------------------------------------------
create or replace function public.medico_achados()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb := '[]'::jsonb;
  r jsonb;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ano int := extract(year from (now() at time zone 'America/Sao_Paulo'))::int;
  v_mes int := extract(month from (now() at time zone 'America/Sao_Paulo'))::int;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador usa o médico do sistema.' using errcode = '42501';
  end if;

  -- 1) clientes sem logo
  select jsonb_build_object('id', 'sem_logo', 'titulo', 'Clientes sem logo', 'dica', 'A logo aparece no Painel de TV, nos cartões e nas mensagens.',
           'qtd', count(*), 'itens', coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'rota', '#/cliente/' || id) order by nome) filter (where rn <= 12), '[]'::jsonb))
    into r from (select c.id, c.nome, row_number() over (order by c.nome) rn from public.clientes c
                  where c.deleted_at is null and coalesce(c.logo_url, '') = '' and coalesce(c.logo_path, '') = '') t;
  if (r ->> 'qtd')::int > 0 then v := v || r; end if;

  -- 2) clientes sem linha editorial do mês
  select jsonb_build_object('id', 'sem_linha', 'titulo', 'Clientes sem linha editorial deste mês', 'dica', 'Sem linha, o cliente não aparece no andamento do mês.',
           'qtd', count(*), 'itens', coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'rota', '#/cliente/' || id) order by nome) filter (where rn <= 12), '[]'::jsonb))
    into r from (select c.id, c.nome, row_number() over (order by c.nome) rn from public.clientes c
                  where c.deleted_at is null
                    and not exists (select 1 from public.linhas_editoriais l
                                     where l.client_id = c.id and l.deleted_at is null and l.ano = v_ano and l.mes = v_mes)) t;
  if (r ->> 'qtd')::int > 0 then v := v || r; end if;

  -- 3) clientes sem Memória da IA
  select jsonb_build_object('id', 'sem_memoria', 'titulo', 'Clientes sem Memória da IA', 'dica', 'A IA escreve melhor quando conhece o tom, o público e o que evitar.',
           'qtd', count(*), 'itens', coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'rota', '#/cliente/' || id) order by nome) filter (where rn <= 12), '[]'::jsonb))
    into r from (select c.id, c.nome, row_number() over (order by c.nome) rn from public.clientes c
                  where c.deleted_at is null
                    and not exists (select 1 from public.cliente_inteligencia i
                                     where i.client_id = c.id
                                       and (coalesce(i.voz_tom, '') <> '' or coalesce(i.publico_principal, '') <> '' or coalesce(i.ia_notas, '') <> ''))) t;
  if (r ->> 'qtd')::int > 0 then v := v || r; end if;

  -- 4) demandas de vídeo abertas sem videomaker
  select jsonb_build_object('id', 'video_sem_resp', 'titulo', 'Demandas de vídeo abertas sem videomaker', 'dica', 'Ninguém é avisado de uma demanda sem responsável.',
           'qtd', count(*), 'itens', coalesce(jsonb_agg(jsonb_build_object('nome', coalesce(nullif(codigo, ''), '—') || ' · ' || coalesce(titulo, 'sem título') || ' (' || cliente || ')', 'rota', '#/video') order by cliente, codigo) filter (where rn <= 12), '[]'::jsonb))
    into r from (select d.codigo, d.titulo, c.nome cliente, row_number() over (order by c.nome, d.codigo) rn
                   from public.demandas_edicao d join public.clientes c on c.id = d.client_id
                  where d.deleted_at is null and d.entregue_em is null and d.videomaker_id is null) t;
  if (r ->> 'qtd')::int > 0 then v := v || r; end if;

  -- 5) demandas do Kanban abertas sem responsável
  select jsonb_build_object('id', 'kanban_sem_resp', 'titulo', 'Demandas do Kanban abertas sem responsável', 'dica', 'Ficam paradas porque ninguém as vê como suas.',
           'qtd', count(*), 'itens', coalesce(jsonb_agg(jsonb_build_object('nome', titulo, 'rota', '#/kanban') order by titulo) filter (where rn <= 12), '[]'::jsonb))
    into r from (select k.titulo, row_number() over (order by k.titulo) rn from public.kanban_demandas k
                  where k.deleted_at is null and k.arquivada_em is null and k.concluida_em is null and k.responsavel_id is null) t;
  if (r ->> 'qtd')::int > 0 then v := v || r; end if;

  -- 6) gravações marcadas daqui para frente sem videomaker
  select jsonb_build_object('id', 'grav_sem_video', 'titulo', 'Gravações marcadas sem videomaker', 'dica', 'Gravação sem videomaker não entra na agenda de ninguém.',
           'qtd', count(*), 'itens', coalesce(jsonb_agg(jsonb_build_object('nome', nome || ' (' || cliente || ')', 'rota', '#/gravacao/' || id) order by data_gravacao) filter (where rn <= 12), '[]'::jsonb))
    into r from (select g.id, g.nome, g.data_gravacao, c.nome cliente, row_number() over (order by g.data_gravacao) rn
                   from public.gravacoes g join public.clientes c on c.id = g.client_id
                  where g.deleted_at is null and g.archived_at is null and g.concluida_em is null
                    and g.data_gravacao >= v_hoje and g.videomaker_id is null) t;
  if (r ->> 'qtd')::int > 0 then v := v || r; end if;

  -- 7) pessoas da equipe sem função
  select jsonb_build_object('id', 'sem_funcao', 'titulo', 'Pessoas da equipe sem função definida', 'dica', 'A função define o que a pessoa vê e recebe.',
           'qtd', count(*), 'itens', coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'rota', '#/usuarios') order by nome) filter (where rn <= 12), '[]'::jsonb))
    into r from (select coalesce(p.nome, p.username) nome, row_number() over (order by coalesce(p.nome, p.username)) rn from public.perfis p
                  where p.estado = 'ativa' and p.papel <> 'cliente' and coalesce(p.funcao, '') = '') t;
  if (r ->> 'qtd')::int > 0 then v := v || r; end if;

  -- 8) Google Agenda com erro
  select jsonb_build_object('id', 'google_erro', 'titulo', 'Google Agenda com erro', 'dica', 'Enquanto estiver com erro, o que a equipe marca não chega à agenda.',
           'qtd', count(*), 'itens', coalesce(jsonb_agg(jsonb_build_object('nome', left(coalesce(nullif(ultimo_erro, ''), status), 100), 'rota', '#/config')), '[]'::jsonb))
    into r from public.calendario_conexoes where status is distinct from 'ativa';
  if (r ->> 'qtd')::int > 0 then v := v || r; end if;

  return jsonb_build_object('agora', now(), 'achados', v);
end
$$;
revoke all on function public.medico_achados() from public, anon;
grant execute on function public.medico_achados() to authenticated;

-- ---------------------------------------------------------------------
-- 4) Comunicado pelo chat
-- ---------------------------------------------------------------------
create table if not exists public.chat_comunicados (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid references public.perfis(id) on delete set null,
  texto text not null,
  destinos uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.chat_comunicados enable row level security;
revoke all on table public.chat_comunicados from anon, public, authenticated;
grant select on table public.chat_comunicados to authenticated;
drop policy if exists chat_comunicados_le on public.chat_comunicados;
create policy chat_comunicados_le on public.chat_comunicados
  for select to authenticated using (autor_id = auth.uid());

alter table public.chat_mensagens add column if not exists comunicado_id uuid references public.chat_comunicados(id) on delete set null;

-- Envia o mesmo texto, em uma mensagem de cada conversa direta com cada pessoa.
-- Cada pessoa continua vendo só a própria conversa com você.
create or replace function public.chat_comunicado(p_texto text, p_destinos uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  eu uuid := auth.uid();
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_ids uuid[];
  v_id uuid;
  v_dest uuid;
  v_conv uuid;
  v_msg public.chat_mensagens;
begin
  if not public.sou_admin() then
    raise exception 'Só administrador envia comunicado.' using errcode = '42501';
  end if;
  if v_texto is null then raise exception 'Escreva o comunicado.'; end if;
  if char_length(v_texto) > 2000 then raise exception 'Comunicado longo demais (máximo 2000 caracteres).'; end if;

  select coalesce(array_agg(p.id), '{}') into v_ids from public.perfis p
   where p.id = any(coalesce(p_destinos, '{}')) and p.id <> eu and p.estado = 'ativa' and p.papel <> 'cliente';
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'Escolha quem vai receber.'; end if;
  if array_length(v_ids, 1) > 30 then raise exception 'Muitos destinatários de uma vez (máximo 30).'; end if;

  insert into public.chat_comunicados (autor_id, texto, destinos) values (eu, v_texto, v_ids) returning id into v_id;
  foreach v_dest in array v_ids loop
    v_conv := public.chat_abrir_direta(v_dest);
    v_msg := public.chat_enviar(v_conv, 'texto', v_texto, null);
    update public.chat_mensagens set comunicado_id = v_id where id = v_msg.id;
  end loop;
  return v_id;
end
$$;
revoke all on function public.chat_comunicado(text, uuid[]) from public, anon;
grant execute on function public.chat_comunicado(text, uuid[]) to authenticated;

-- Quem já leu (só situação; o conteúdo das conversas continua privado)
create or replace function public.chat_comunicado_lidos(p_id uuid)
returns table (perfil_id uuid, nome text, entregue boolean, lida boolean, lida_em timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.chat_comunicados where id = p_id and autor_id = auth.uid()) then
    raise exception 'Comunicado não encontrado.' using errcode = '42501';
  end if;
  return query
    select m_dest.perfil, coalesce(nullif(btrim(p.nome), ''), p.username, 'Pessoa')::text,
           cp.entregue_ate >= m_dest.criada, cp.lida_ate >= m_dest.criada,
           case when cp.lida_ate >= m_dest.criada then cp.lida_ate end
      from (select cp2.perfil_id perfil, cp2.conversa_id conv, m.created_at criada
              from public.chat_mensagens m
              join public.chat_participantes cp2 on cp2.conversa_id = m.conversa_id and cp2.perfil_id <> m.autor_id
             where m.comunicado_id = p_id) m_dest
      join public.chat_participantes cp on cp.conversa_id = m_dest.conv and cp.perfil_id = m_dest.perfil
      join public.perfis p on p.id = m_dest.perfil
     order by 2;
end
$$;
revoke all on function public.chat_comunicado_lidos(uuid) from public, anon;
grant execute on function public.chat_comunicado_lidos(uuid) to authenticated;

-- Os comunicados que o administrador enviou, com quantos já leram
create or replace function public.chat_comunicados_lista()
returns table (id uuid, texto text, created_at timestamptz, total integer, lidos integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.texto, c.created_at,
         (select count(*)::int from public.chat_mensagens m where m.comunicado_id = c.id),
         (select count(*)::int from public.chat_mensagens m
            join public.chat_participantes cp on cp.conversa_id = m.conversa_id and cp.perfil_id <> m.autor_id
           where m.comunicado_id = c.id and cp.lida_ate >= m.created_at)
    from public.chat_comunicados c
   where c.autor_id = auth.uid()
   order by c.created_at desc
   limit 30;
$$;
revoke all on function public.chat_comunicados_lista() from public, anon;
grant execute on function public.chat_comunicados_lista() to authenticated;
