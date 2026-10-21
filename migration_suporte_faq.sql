-- =====================================================================
-- zzz217: PERGUNTAS FREQUENTES NO SUPORTE
--
-- suporte_faq        respostas curtas e prontas (admin/coordenação cadastram)
-- suporte_autoajuda  o que aconteceu com cada dúvida antes de virar chamado:
--                    pergunta resolveu / não resolveu, assistente resolveu /
--                    não resolveu, virou chamado, busca sem resultado
--
-- Leitura das perguntas: toda a equipe interna (cliente do Portal não).
-- Escrita: só pelas funções abaixo. Nada é apagado: pergunta sai do ar
-- com ativo = false.
-- =====================================================================

create table if not exists public.suporte_faq (
  id uuid primary key default gen_random_uuid(),
  pergunta text not null check (length(btrim(pergunta)) between 3 and 200),
  resposta text not null check (length(btrim(resposta)) between 3 and 2000),
  termos text not null default '',
  tutorial_id text,
  ordem int not null default 100,
  ativo boolean not null default true,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.suporte_faq enable row level security;
drop policy if exists suporte_faq_ler on public.suporte_faq;
create policy suporte_faq_ler on public.suporte_faq for select to authenticated
  using (coalesce(public.meu_papel(), 'cliente') <> 'cliente' and (ativo or public.sou_equipe()));

create table if not exists public.suporte_autoajuda (
  id bigint generated always as identity primary key,
  perfil_id uuid not null default auth.uid(),
  texto text not null default '',
  desfecho text not null check (desfecho in ('faq_sim', 'faq_nao', 'ia_sim', 'ia_nao', 'chamado', 'sem_resultado')),
  faq_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists suporte_autoajuda_quando on public.suporte_autoajuda (created_at desc);
alter table public.suporte_autoajuda enable row level security;
-- sem políticas: só as funções leem e gravam

create or replace function public.suporte_faq_salvar(p_id uuid, p_pergunta text, p_resposta text, p_termos text, p_tutorial text, p_ordem int, p_ativo boolean)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v uuid;
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenação editam as perguntas frequentes.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_pergunta, ''))) < 3 then raise exception 'Escreva a pergunta.'; end if;
  if length(btrim(coalesce(p_resposta, ''))) < 3 then raise exception 'Escreva a resposta.'; end if;
  if p_id is null then
    insert into public.suporte_faq (pergunta, resposta, termos, tutorial_id, ordem, ativo, criado_por)
    values (btrim(left(p_pergunta, 200)), btrim(left(p_resposta, 2000)), btrim(left(coalesce(p_termos, ''), 400)),
      nullif(btrim(coalesce(p_tutorial, '')), ''), coalesce(p_ordem, 100), coalesce(p_ativo, true), auth.uid())
    returning id into v;
  else
    update public.suporte_faq set pergunta = btrim(left(p_pergunta, 200)), resposta = btrim(left(p_resposta, 2000)),
      termos = btrim(left(coalesce(p_termos, ''), 400)), tutorial_id = nullif(btrim(coalesce(p_tutorial, '')), ''),
      ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo), updated_at = now()
    where id = p_id returning id into v;
    if v is null then raise exception 'Pergunta não encontrada.'; end if;
  end if;
  return v;
end $$;

create or replace function public.suporte_autoajuda_registrar(p_texto text, p_desfecho text, p_faq uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or coalesce(public.meu_papel(), 'cliente') = 'cliente' then return; end if;
  if p_desfecho not in ('faq_sim', 'faq_nao', 'ia_sim', 'ia_nao', 'chamado', 'sem_resultado') then raise exception 'Desfecho inválido.'; end if;
  -- no máximo 60 registros por pessoa por hora (evita encher a tabela por engano)
  if (select count(*) from public.suporte_autoajuda where perfil_id = auth.uid() and created_at > now() - interval '1 hour') >= 60 then return; end if;
  insert into public.suporte_autoajuda (texto, desfecho, faq_id) values (btrim(left(coalesce(p_texto, ''), 300)), p_desfecho, p_faq);
end $$;

create or replace function public.suporte_autoajuda_resumo(p_dias int)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare d timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365)));
begin
  if not public.sou_equipe() then raise exception 'Só admin/coordenação veem o resumo.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'desfechos', coalesce((select jsonb_object_agg(desfecho, n) from (select desfecho, count(*) n from public.suporte_autoajuda where created_at > d group by desfecho) x), '{}'::jsonb),
    'por_faq', coalesce((select jsonb_agg(jsonb_build_object('faq_id', faq_id, 'sim', sim, 'nao', nao)) from (
      select faq_id, count(*) filter (where desfecho = 'faq_sim') sim, count(*) filter (where desfecho = 'faq_nao') nao
      from public.suporte_autoajuda where created_at > d and faq_id is not null group by faq_id) y), '[]'::jsonb),
    'sem_resultado', coalesce((select jsonb_agg(jsonb_build_object('texto', texto, 'n', n) order by n desc, ultimo desc) from (
      select min(texto) texto, count(*) n, max(created_at) ultimo from public.suporte_autoajuda
      where created_at > d and desfecho in ('sem_resultado', 'ia_nao', 'faq_nao') and texto <> ''
      group by lower(texto) order by count(*) desc, max(created_at) desc limit 15) z), '[]'::jsonb)
  );
end $$;
insert into public.suporte_faq (pergunta, resposta, termos, tutorial_id, ordem)
select v.pergunta, v.resposta, v.termos, v.tutorial_id, v.ordem from (values
 ('Como troco minha senha?', 'Clique na sua foto no topo → "Meu perfil" → aba "Segurança". Em "Trocar senha", escreva a senha atual, a nova (10 caracteres ou mais, com pelo menos uma letra e um número) e repita a nova. Clique em "Trocar senha". As outras sessões abertas da sua conta são encerradas.', 'mudar alterar trocar senha nova senha', 'meu-perfil', 10),
 ('Esqueci minha senha. E agora?', 'Peça ao administrador: ele usa "Redefinir senha" em Usuários e acessos e te passa uma senha nova. Depois de entrar, troque por uma sua em Meu perfil → aba "Segurança".', 'esqueci perdi recuperar redefinir senha não lembro não consigo entrar', 'meu-perfil', 20),
 ('Como mudo minha foto ou meu nome?', 'Clique na sua foto no topo → "Meu perfil" → aba "Conta". Em "Foto de perfil", escolha a imagem e clique em "Salvar foto". Em "Nome", ajuste e clique em "Salvar". O usuário e a função só o administrador muda.', 'foto nome perfil avatar imagem trocar foto', 'meu-perfil', 30),
 ('As notificações não chegam. O que faço?', 'Abra Meu perfil → aba "Notificações" e ligue "Push neste aparelho" (permita quando o aparelho pedir). Clique em "Enviar teste" para conferir. Cada aparelho precisa ligar o seu. No iPhone, só funciona com o B7 adicionado à tela de início. No programa de Windows, o aviso só chega com o programa aberto.', 'notificação notificações aviso push não chega sino som celular', 'notificacoes-e-avisos', 40),
 ('Como desligo um tipo de aviso?', 'Meu perfil → aba "Notificações" → em "O que te avisa", abra o grupo e desligue o que não quiser. Ele para de tocar e de mandar push, mas continua aparecendo no sino.', 'desligar silenciar parar aviso notificação muitos avisos', 'notificacoes-e-avisos', 50),
 ('Como instalo o app no celular?', 'No Android: abra o B7 no navegador do celular, entre na conta e toque em "Baixar o app" no convite (ou Configurações → "Geral" → "App para Android"). Abra o arquivo baixado e permita a instalação. Depois entre com seu usuário e senha. No iPhone não há app: use "Adicionar à tela de início" no navegador.', 'app aplicativo celular android iphone instalar baixar', 'aplicativo-no-celular-android-e-instalar-pelo-navegador', 60),
 ('Como instalo o programa no computador (Windows)?', 'Configurações → "Geral" → "App para Windows" (ou "Baixar para Windows" no convite). Abra o arquivo baixado. Se aparecer "O Windows protegeu o computador", clique em "Mais informações" → "Executar assim mesmo". Depois entre com seu usuário e senha.', 'windows programa computador pc instalar baixar notebook', 'aplicativo-para-windows', 70),
 ('Como deixo o sistema no modo escuro?', 'Configurações → aba "Aparência" → em "Tema", escolha "Claro", "Escuro" ou "Sistema" (segue o aparelho). Vale só para você. Na mesma aba dá para trocar a cor do sistema.', 'escuro claro tema dark cor aparência', 'modo-claro-escuro-e-aparencia', 80),
 ('O sistema está lento ou travando.', 'Configurações → aba "Aparência" → em "Desempenho", escolha "Leve" (e, se quiser, desligue "Animações"). Depois feche e abra o B7 de novo. Se continuar, abra um chamado de Problema com um print da tela.', 'lento travando travado pesado devagar demorando carregando', 'configuracoes', 90),
 ('Como entrego várias demandas de vídeo de uma vez?', 'Em Edição de vídeo, segure Ctrl (ou Cmd no Mac) e clique nos cartões, ou use "Selecionar todas". Clique com o botão direito em um deles → "Marcar N como entregues" e confirme. Atenção: a entrega em lote não passa pela aprovação do cliente.', 'entregar várias lote selecionar todas demandas entregue', 'edicao-de-video', 100),
 ('Como remarco uma gravação?', 'Abra a gravação e clique em "Remarcar" (quando a gravação já tem data, o botão "Marcar data" vira "Remarcar"). Escolha a nova data, escreva o motivo se quiser e clique em "Salvar nova data". A data antiga fica no histórico.', 'remarcar mudar data dia gravação adiar', 'gravacoes', 110),
 ('Apaguei algo sem querer. Dá para recuperar?', 'Logo depois de excluir, clique em "Desfazer" no aviso. Depois disso, gravações, roteiros e clientes ficam na "Lixeira", que o administrador abre e usa "Restaurar". Se você não é administrador, abra um chamado pedindo a restauração e diga o nome do que apagou.', 'apaguei excluí exclui recuperar desfazer lixeira voltar', 'lixeira', 120),
 ('Como acho algo rápido no sistema?', 'Aperte Ctrl + K (no Mac, ⌘ + K) ou clique em "Buscar no B7…" no topo e escreva o nome de um cliente, gravação ou demanda. No celular, use a lupa.', 'buscar procurar achar pesquisa pesquisar encontrar', 'busca-global-ctrl-k', 130),
 ('Como conecto o WhatsApp no sistema?', 'O WhatsApp dentro do B7 funciona só no programa de Windows: clique em "WhatsApp" na barra lateral e leia o QR Code com o celular, como no WhatsApp Web. No navegador, a tela só oferece abrir o WhatsApp Web numa aba.', 'whatsapp conectar qr code wpp zap', 'whatsapp', 140),
 ('Como saio da minha conta?', 'Configurações → no fim da aba "Geral", clique em "Sair da conta" (só neste aparelho). "Sair de todos os aparelhos" encerra a sua conta em todo celular e computador.', 'sair logout deslogar desconectar conta', 'configuracoes', 150)
) as v(pergunta, resposta, termos, tutorial_id, ordem)
where not exists (select 1 from public.suporte_faq f where f.pergunta = v.pergunta);
