// =====================================================================
// AUTENTICAÇÃO B7 — camada server-side
//
// O frontend está no GitHub Pages: nada de service role, nada de segredo.
// Tudo que cria conta, troca papel ou traduz username passa por aqui.
//
// Por que o login não acontece direto no frontend:
// o Supabase Auth identifica por e-mail, e o cliente não tem e-mail. Cada
// usuário recebe uma identidade técnica <uuid>@b7.local, gerada aqui,
// nunca exibida e nunca usada para enviar mensagem. Se o frontend
// pudesse traduzir username → identidade, qualquer visitante descobriria
// quais usernames existem. Por isso a tradução mora nesta função.
//
// Deploy:
//   supabase functions deploy b7-auth
//   supabase secrets set B7_BOOTSTRAP_TOKEN=<segredo longo>   (só na 1ª vez)
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já são injetados pela
// plataforma; não precisam ser configurados à mão.
// =====================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { comCors, iguais } from '../_shared/cors.ts';
import * as DF from './dois_fatores.ts';

/* Aparece na resposta do ping: dá para conferir qual versão está no ar
   sem precisar abrir o código publicado. */
const VERSAO = '2026-10-23-papeis';

const CORS = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const admin = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);


// =====================================================================
// FOTO DE PERFIL — grava a imagem no Storage
// O navegador manda um data URL JPEG já reduzido (512×512). Aqui o
// arquivo entra no bucket público `avatars` com a chave de serviço, e a
// URL pública vai para perfis.avatar_url. Foto anterior é apagada.
// =====================================================================
const BUCKET_AVATAR = 'avatars';
const MAX_AVATAR = 600 * 1024;   // 512² em JPEG 0.88 fica bem abaixo disso

async function garantirBucket(sb: ReturnType<typeof admin>) {
  const { data } = await sb.storage.getBucket(BUCKET_AVATAR);
  if (data) return;
  await sb.storage.createBucket(BUCKET_AVATAR, {
    public: true, fileSizeLimit: MAX_AVATAR,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  });
}

function decodificarDataUrl(dataUrl: string): { bytes: Uint8Array; tipo: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, tipo: m[1] };
}

/* Resolve o que vai para avatar_url: uma imagem enviada (sobe e devolve
   a URL pública), null (remove) ou a URL antiga (nada muda). Devolve
   { url } ou { erro }. */
async function resolverAvatar(sb: ReturnType<typeof admin>, perfilId: string,
                              corpo: Record<string, unknown>, atual: string | null) {
  if (typeof corpo.imagem === 'string' && corpo.imagem) {
    const dec = decodificarDataUrl(corpo.imagem);
    if (!dec) return { erro: 'Imagem inválida. Use PNG, JPG ou WEBP.' };
    if (dec.bytes.length > MAX_AVATAR) return { erro: 'Imagem grande demais.' };
    await garantirBucket(sb);
    const ext = dec.tipo === 'image/png' ? 'png' : dec.tipo === 'image/webp' ? 'webp' : 'jpg';
    const caminho = perfilId + '/' + Date.now() + '.' + ext;
    const { error } = await sb.storage.from(BUCKET_AVATAR)
      .upload(caminho, dec.bytes, { contentType: dec.tipo, upsert: false });
    if (error) return { erro: 'Não foi possível guardar a imagem: ' + error.message };
    const { data } = sb.storage.from(BUCKET_AVATAR).getPublicUrl(caminho);
    await apagarAvatarAntigo(sb, atual);
    return { url: data.publicUrl };
  }
  if (corpo.avatar_url === null || corpo.imagem === null) {
    await apagarAvatarAntigo(sb, atual);
    return { url: null };
  }
  /* compatibilidade: link externo continua aceito, mas a interface não
     oferece mais esse caminho */
  const url = String(corpo.avatar_url || '');
  if (url && !/^https?:\/\//i.test(url)) return { erro: 'Endereço de imagem inválido.' };
  return { url: url || null };
}

async function apagarAvatarAntigo(sb: ReturnType<typeof admin>, url: string | null) {
  if (!url) return;
  const i = url.indexOf('/' + BUCKET_AVATAR + '/');
  if (i < 0) return;                                  // era link externo
  const caminho = decodeURIComponent(url.slice(i + BUCKET_AVATAR.length + 2).split('?')[0]);
  try { await sb.storage.from(BUCKET_AVATAR).remove([caminho]); } catch (_) { /* melhor esforço */ }
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' }
  });

/* Mensagem única para usuário inexistente, senha errada e conta
   desativada. Distinguir os casos entregaria uma lista de usernames
   válidos a quem estiver tentando adivinhar. */
const ACESSO_NEGADO = 'Usuário ou senha inválidos.';

/* Freio simples contra tentativa em massa, na memória da instância.
   Não substitui o rate limit do provedor, mas encarece o ataque. */
const tentativas = new Map<string, { n: number; ate: number }>();
const JANELA = 15 * 60 * 1000, LIMITE = 8;

function bloqueado(chave: string) {
  const t = tentativas.get(chave);
  if (!t) return false;
  if (Date.now() > t.ate) { tentativas.delete(chave); return false; }
  return t.n >= LIMITE;
}
function registrarFalha(chave: string) {
  const t = tentativas.get(chave);
  if (!t || Date.now() > t.ate) tentativas.set(chave, { n: 1, ate: Date.now() + JANELA });
  else t.n++;
}

/* Token de bootstrap/recuperação: comparação em tempo constante e freio
   por endereço — 8 erros em 15 minutos bloqueiam aquele endereço. */
function tokenConfere(req: Request, recebido: unknown, esperado: string): boolean {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sem-ip';
  const chave = 'token:' + ip;
  if (bloqueado(chave)) return false;
  const ok = typeof recebido === 'string' && iguais(recebido, esperado);
  if (!ok) registrarFalha(chave);
  return ok;
}
const identidadeTecnica = (id: string) => `${id}@b7.local`;

/* Política mínima: 10 caracteres, com letra e número. Curta o bastante
   para a equipe ditar por telefone, longa o bastante para não ser trivial. */
function senhaFraca(senha: string): string | null {
  if (!senha || senha.length < 10) return 'A senha precisa de pelo menos 10 caracteres.';
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    return 'A senha precisa ter letras e números.';
  }
  return null;
}

/* Funções extras de produção (multi-função aditiva, B7 Vídeo Parte 1.1):
   hoje só "videomaker" é uma função combinável com qualquer papel
   principal interno. Cliente é externo — nunca ganha função extra
   interna, mesmo que alguém tente mandar isso no corpo da requisição.
   O mesmo valor do papel principal também não entra como "extra": não
   faz sentido um Videomaker ganhar a função extra "videomaker". */
/* 'coordenador' (Painel do Coordenador, 29/09): só faz sentido para o
   Administrador — ele já tem, no banco, as permissões de coordenação; a
   função só liga o Painel de coordenação. Em outro papel ela é
   descartada em silêncio (exigiria permissões que o papel não tem). */
/* 'designer' (Painel unificado, 30/09): só para Administrador e
   Coordenador de mídias — os dois já são "equipe" no banco (sou_equipe:
   leem e editam todas as peças de Design, e design_atribuir já aceita
   admin/coordenador como responsável). A função só faz a pessoa poder
   RECEBER peças e ganhar o Painel do Designer. Num Videomaker ou Cliente
   ela exigiria permissões que o papel não tem — então é descartada. */
const FUNCOES_EXTRA_VALIDAS = ['videomaker', 'coordenador', 'designer'];

/* =====================================================================
   FUNÇÕES E ACESSOS (zzz68) — modelo novo da equipe interna:
     administrador (sim/não) + UMA função principal + módulos.
   perfis.eh_admin / perfis.funcao são a fonte da verdade; o banco mantém
   perfis.papel e perfis_funcoes_extra como espelho (gatilhos em
   migration_funcoes_e_acessos.sql). Aqui só entram valores validados, e
   só administrador chega nestas ações (ACOES_ADMIN).
   ===================================================================== */
const FUNCOES_VALIDAS = ['coordenador', 'designer', 'videomaker'];
type Identidade = { ehAdmin: boolean; funcao: string | null; papel: string; erro?: string };
function identidadeInterna(ehAdminBruto: unknown, funcaoBruta: unknown): Identidade {
  const ehAdmin = ehAdminBruto === true;
  const funcao = funcaoBruta === null || funcaoBruta === undefined || funcaoBruta === '' ? null : String(funcaoBruta);
  if (funcao !== null && !FUNCOES_VALIDAS.includes(funcao)) {
    return { ehAdmin, funcao: null, papel: '', erro: 'Função inválida.' };
  }
  if (!ehAdmin && funcao === null) {
    return { ehAdmin, funcao, papel: '', erro: 'Quem não é administrador precisa ter uma função.' };
  }
  return { ehAdmin, funcao, papel: ehAdmin ? 'admin' : (funcao as string) };
}
/* exceções de módulo: { modulo: 'permitir' | 'negar' | 'ver' | 'editar' | 'total' } — só ids que existem.
   zzz215: 'ver'/'editar'/'total' = permitir com esse nível; 'negar' = sem acesso. */
const NIVEIS = ['ver', 'editar', 'total'];
// deno-lint-ignore no-explicit-any
async function normalizarExcecoes(sb: any, bruto: unknown): Promise<{ lista: { modulo: string; efeito: string; nivel?: string | null }[]; erro?: string }> {
  if (bruto === undefined || bruto === null) return { lista: [] };
  if (typeof bruto !== 'object' || Array.isArray(bruto)) return { lista: [], erro: 'Exceções de módulo inválidas.' };
  const { data: mods } = await sb.from('modulos').select('id');
  const validos = new Set((mods || []).map((m: { id: string }) => m.id));
  const lista: { modulo: string; efeito: string; nivel?: string | null }[] = [];
  for (const [modulo, efeito] of Object.entries(bruto as Record<string, unknown>)) {
    if (!validos.has(modulo)) return { lista: [], erro: 'Módulo inválido: ' + modulo + '.' };
    if (efeito !== 'permitir' && efeito !== 'negar' && !NIVEIS.includes(String(efeito))) return { lista: [], erro: 'Exceção inválida em ' + modulo + '.' };
    if (NIVEIS.includes(String(efeito))) lista.push({ modulo, efeito: 'permitir', nivel: String(efeito) });
    else lista.push({ modulo, efeito: String(efeito), nivel: null });
  }
  return { lista };
}
// deno-lint-ignore no-explicit-any
async function gravarExcecoes(sb: any, perfilId: string, lista: { modulo: string; efeito: string; nivel?: string | null }[], autorId: string) {
  await sb.from('perfil_modulos').delete().eq('perfil_id', perfilId);
  if (lista.length) {
    await sb.from('perfil_modulos').insert(lista.map((x) => ({
      perfil_id: perfilId, modulo: x.modulo, efeito: x.efeito, nivel: x.nivel || null, alterado_por: autorId })));
  }
}
/* zzz216: função personalizada ('p_...') = pacote de módulos apoiado numa função de base.
   perfis.funcao fica com a BASE (Painel, quem pode receber trabalho, espelho do papel);
   perfis.funcao_personalizada aponta o pacote. */
// deno-lint-ignore no-explicit-any
async function resolverFuncao(sb: any, bruta: unknown): Promise<{ funcao: string | null; personalizada: string | null; erro?: string }> {
  const f = bruta === null || bruta === undefined || bruta === '' ? null : String(bruta);
  if (!f || !f.startsWith('p_')) return { funcao: f, personalizada: null };
  const { data } = await sb.from('funcoes_personalizadas').select('id, base').eq('id', f).maybeSingle();
  if (!data) return { funcao: null, personalizada: null, erro: 'Função personalizada não encontrada.' };
  return { funcao: data.base, personalizada: data.id };
}
/* zzz216: funções secundárias { funcao: 'ver' | 'editar' | 'total' } — abrem o pacote da
   função até esse nível, sem mudar a função nem quem pode receber trabalho */
// deno-lint-ignore no-explicit-any
async function normalizarSecundarias(sb: any, bruto: unknown): Promise<{ lista: { funcao: string; nivel_max: string }[]; erro?: string }> {
  if (bruto === undefined || bruto === null) return { lista: [] };
  if (typeof bruto !== 'object' || Array.isArray(bruto)) return { lista: [], erro: 'Funções secundárias inválidas.' };
  const { data: pers } = await sb.from('funcoes_personalizadas').select('id');
  const validas = new Set([...FUNCOES_VALIDAS, ...((pers || []).map((p: { id: string }) => p.id))]);
  const lista: { funcao: string; nivel_max: string }[] = [];
  for (const [funcao, nivel] of Object.entries(bruto as Record<string, unknown>)) {
    if (!validas.has(funcao)) return { lista: [], erro: 'Função secundária inválida: ' + funcao + '.' };
    if (!NIVEIS.includes(String(nivel))) return { lista: [], erro: 'Nível inválido na função secundária.' };
    lista.push({ funcao, nivel_max: String(nivel) });
  }
  return { lista };
}
// deno-lint-ignore no-explicit-any
async function gravarSecundarias(sb: any, perfilId: string, lista: { funcao: string; nivel_max: string }[], autorId: string) {
  await sb.from('perfil_funcoes_secundarias').delete().eq('perfil_id', perfilId);
  if (lista.length) {
    await sb.from('perfil_funcoes_secundarias').insert(lista.map((x) => ({ perfil_id: perfilId, funcao: x.funcao, nivel_max: x.nivel_max, alterado_por: autorId })));
  }
}
/* zzz216: foto do acesso de uma pessoa, para o histórico mostrar o antes e o depois */
// deno-lint-ignore no-explicit-any
async function fotoAcesso(sb: any, perfilId: string) {
  try {
    const [{ data: p }, { data: niveis }, { data: sec }] = await Promise.all([
      sb.from('perfis').select('eh_admin, funcao, funcao_personalizada, estado, papel').eq('id', perfilId).maybeSingle(),
      sb.rpc('modulos_niveis', { p_id: perfilId }),
      sb.from('perfil_funcoes_secundarias').select('funcao, nivel_max').eq('perfil_id', perfilId)
    ]);
    if (!p) return null;
    return { eh_admin: !!p.eh_admin, funcao: p.funcao_personalizada || p.funcao, estado: p.estado, papel: p.papel,
             niveis: niveis || {}, secundarias: Object.fromEntries((sec || []).map((s: { funcao: string; nivel_max: string }) => [s.funcao, s.nivel_max])) };
  } catch (_e) { return null; }
}
const PAPEIS_COM_DESIGNER_EXTRA = ['admin', 'coordenador'];
function normalizarFuncoesExtra(bruto: unknown, papelFinal: string): { lista: string[]; erro?: string } {
  if (bruto === undefined || bruto === null) return { lista: [] };
  if (!Array.isArray(bruto)) return { lista: [], erro: 'Funções extras inválidas.' };
  const lista = [...new Set(bruto.map((f) => String(f)))];
  for (const f of lista) {
    if (!FUNCOES_EXTRA_VALIDAS.includes(f)) {
      return { lista: [], erro: 'Função extra inválida: ' + f + '.' };
    }
  }
  if (papelFinal === 'cliente' && lista.length) {
    return { lista: [], erro: 'Cliente é um perfil externo — não recebe função extra de produção.' };
  }
  return { lista: lista.filter((f) => f !== papelFinal &&
    !(f === 'coordenador' && papelFinal !== 'admin') &&
    !(f === 'designer' && !PAPEIS_COM_DESIGNER_EXTRA.includes(papelFinal))) };
}

/* Quem chamou? Valida o token da sessão e devolve o perfil real, lido do
   banco — nunca do que o cliente enviou. */
async function quemChamou(req: Request) {
  const cab = req.headers.get('authorization') || '';
  const token = cab.startsWith('Bearer ') ? cab.slice(7) : null;
  if (!token) return null;
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil } = await sb.from('perfis')
    .select('id, username, nome, papel, estado').eq('id', data.user.id).maybeSingle();
  if (!perfil || perfil.estado !== 'ativa') return null;
  return perfil;
}

/* =====================================================================
   SUPER ADMIN (zzz225) — limites dos administradores comuns e aprovação dupla.
   'livre' | 'aprovacao' | 'bloqueado' por ação (sistema_config.limites_admin;
   o padrão é o mesmo de public.limites_admin_padrao()). Super admin é sempre livre.
   ===================================================================== */
const LIMITES_PADRAO: Record<string, string> = { acessos: 'livre', excluir_conta: 'aprovacao', entrar_como: 'livre',
  excluir_cliente: 'aprovacao', seguranca: 'aprovacao', config_critica: 'bloqueado' };
// deno-lint-ignore no-explicit-any
async function nivelSuper(sb: any, id: string): Promise<string | null> {
  const { data } = await sb.from('perfis').select('superadmin, eh_admin').eq('id', id).maybeSingle();
  return data && data.eh_admin && data.superadmin ? String(data.superadmin) : null;
}
// deno-lint-ignore no-explicit-any
async function limiteDe(sb: any, autorId: string, chave: string): Promise<string> {
  if (await nivelSuper(sb, autorId)) return 'livre';
  const { data } = await sb.from('sistema_config').select('valor').eq('chave', 'limites_admin').maybeSingle();
  const v = data && data.valor && data.valor[chave];
  return typeof v === 'string' ? v : (LIMITES_PADRAO[chave] || 'livre');
}
// deno-lint-ignore no-explicit-any
async function pedirAprovacao(sb: any, autor: any, acao: string, corpo: Record<string, unknown>, alvo: { tipo: string; id: string | null; desc: string | null }, resumo: string) {
  const limpo: Record<string, unknown> = { ...corpo }; delete limpo.senha; delete limpo.aprovacao_id;
  const { data } = await sb.from('super_aprovacoes').insert({ acao, alvo_tipo: alvo.tipo, alvo_id: alvo.id, alvo_desc: alvo.desc,
    corpo: limpo, resumo: resumo.slice(0, 400), motivo: null, pedido_por: autor.id }).select('id').single();
  await sb.rpc('_super_avisar', { p_tipo: 'super.aprovacao', p_titulo: 'Aprovação pedida por ' + String(autor.nome || autor.username || 'alguém').split(' ')[0],
    p_msg: resumo.slice(0, 200), p_link: '#/super/aprovacoes', p_ref: data ? data.id : null });
  return json({ erro: 'Pedido enviado para um super admin aprovar. Você recebe um aviso com a resposta.', codigo: 'aguardando_aprovacao', aprovacao_id: data ? data.id : null }, 409);
}
/* aparelho novo de administrador: avisa os super admins (rede = começo do IP; nada de localização) */
// deno-lint-ignore no-explicit-any
async function alertaAparelho(sb: any, perfilId: string, req: Request) {
  const { data: p } = await sb.from('perfis').select('nome, username, eh_admin').eq('id', perfilId).maybeSingle();
  if (!p || !p.eh_admin) return;
  const ua = (req.headers.get('user-agent') || '').slice(0, 300);
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '').split(',')[0].trim();
  const rede = ip.includes(':') ? ip.split(':').slice(0, 3).join(':') : ip.split('.').slice(0, 2).join('.');
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Mac OS/.test(ua) ? 'Mac' : 'Aparelho';
  const nav = /Electron\//.test(ua) ? 'programa do B7' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
  const chave = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(so + '|' + nav + '|' + rede))))
    .map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  const descricao = so + ' · ' + nav + (rede ? ' · rede ' + rede + (ip.includes(':') ? ':…' : '.x.x') : '');
  const { data: ja } = await sb.from('acesso_aparelhos').select('chave').eq('perfil_id', perfilId).eq('chave', chave).maybeSingle();
  if (ja) { await sb.from('acesso_aparelhos').update({ ultimo_em: new Date().toISOString() }).eq('perfil_id', perfilId).eq('chave', chave); return; }
  const { count } = await sb.from('acesso_aparelhos').select('chave', { count: 'exact', head: true }).eq('perfil_id', perfilId);
  await sb.from('acesso_aparelhos').insert({ perfil_id: perfilId, chave, descricao });
  if ((count || 0) > 0) {
    await sb.rpc('_super_avisar', { p_tipo: 'super.acesso', p_titulo: 'Acesso de um aparelho novo: ' + String(p.nome || p.username).split(' ')[0],
      p_msg: descricao + '. Se não reconhecer, derrube as sessões dessa conta.', p_link: '#/super', p_ref: perfilId });
    await auditar(sb, { id: perfilId, username: p.username }, 'acesso_aparelho_novo', { tipo: 'perfil', id: perfilId, descricao: p.username }, { aparelho: descricao });
  }
}
/* o acesso de uma conta mudou de verdade? (o editor manda os campos mesmo sem mudar nada) */
// deno-lint-ignore no-explicit-any
async function mudaAcesso(sb: any, corpo: any): Promise<boolean> {
  const id = String(corpo.perfil_id || '');
  const [{ data: p }, { data: ex }, { data: sec }] = await Promise.all([
    sb.from('perfis').select('papel, estado, eh_admin, funcao, funcao_personalizada').eq('id', id).maybeSingle(),
    sb.from('perfil_modulos').select('modulo, efeito, nivel').eq('perfil_id', id),
    sb.from('perfil_funcoes_secundarias').select('funcao, nivel_max').eq('perfil_id', id)]);
  if (!p) return true;
  if (corpo.estado !== undefined && corpo.estado !== p.estado) return true;
  if (corpo.papel !== undefined && corpo.papel !== p.papel) return true;
  if (corpo.tipo === 'cliente' && p.papel !== 'cliente') return true;
  if (corpo.tipo === 'interno' && p.papel === 'cliente') return true;
  if (corpo.eh_admin !== undefined && !!corpo.eh_admin !== !!p.eh_admin) return true;
  if (corpo.funcao !== undefined && (corpo.funcao || null) !== ((p.funcao_personalizada || p.funcao) || null)) return true;
  const mapa = (o: Record<string, unknown>) => Object.keys(o || {}).sort().map((k) => k + ':' + o[k]).join();
  if (corpo.modulos !== undefined && corpo.modulos && typeof corpo.modulos === 'object' && !Array.isArray(corpo.modulos)) {
    const atual: Record<string, unknown> = {};
    (ex || []).forEach((e: { modulo: string; efeito: string; nivel: string | null }) => { atual[e.modulo] = e.efeito === 'negar' ? 'negar' : (e.nivel || 'permitir'); });
    if (mapa(corpo.modulos) !== mapa(atual)) return true;
  }
  if (corpo.secundarias !== undefined && corpo.secundarias && typeof corpo.secundarias === 'object') {
    const atual: Record<string, unknown> = {};
    (sec || []).forEach((x: { funcao: string; nivel_max: string }) => { atual[x.funcao] = x.nivel_max; });
    if (mapa(corpo.secundarias) !== mapa(atual)) return true;
  }
  return false;
}

async function auditar(sb: any, autor: any, acao: string, alvo: any, detalhe: any = {}) {
  await sb.from('auditoria').insert([{
    autor_id: autor?.id || null,
    autor_username: autor?.username || null,
    acao,
    alvo_tipo: alvo?.tipo || null,
    alvo_id: alvo?.id || null,
    alvo_descricao: alvo?.descricao || null,
    /* detalhe nunca recebe senha: quem chama passa só o que é seguro */
    detalhe
  }]);
}

Deno.serve(comCors(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  let corpo: any = {};
  try { corpo = await req.json(); } catch (e) { /* corpo vazio */ }
  const acao = corpo.acao;
  const sb = admin();

  try {
    // =================================================================
    // PING — diagnóstico, sem exigir sessão
    //
    // Responde 200 e diz o que está configurado, sem revelar segredo
    // nenhum: só se as peças existem, nunca os valores.
    // =================================================================
    if (acao === 'ping') {
      const { count } = await sb.from('perfis')
        .select('id', { count: 'exact', head: true })
        .eq('papel', 'admin').eq('estado', 'ativa');
      return json({
        ok: true,
        versao: VERSAO,
        bootstrap_disponivel: !!Deno.env.get('B7_BOOTSTRAP_TOKEN'),
        admin_existe: (count || 0) > 0,
        /* zzz218: o envio de código por e-mail está pronto? (ok | sem_chave | sem_remetente) */
        email_2fa: await DF.estadoEmail(),
        acoes: ['ping', 'login', 'login_2fa', 'login_2fa_reenviar', 'login_2fa_status', 'email_link', ...DF.ACOES_SEG, ...DF.ACOES_SEG_ADMIN, 'bootstrap', 'recuperar_admin', 'remover_admin',
                'criar_usuario', 'redefinir_senha', 'alterar_conta', 'listar_usuarios', 'entrar_como']
      });
    }

    // =================================================================
    // LOGIN
    // =================================================================
    if (acao === 'login') {
      const username = String(corpo.username || '').trim();
      const senha = String(corpo.senha || '');
      const chave = username.toLowerCase();

      if (!username || !senha) return json({ erro: ACESSO_NEGADO }, 400);
      if (bloqueado(chave)) {
        return json({ erro: 'Muitas tentativas. Tente de novo em alguns minutos.' }, 429);
      }

      const { data: achados } = await sb.rpc('resolver_login', { p_username: username });
      const perfil = achados && achados[0];

      /* conta inexistente, removida ou desativada: mesma resposta da
         senha errada, e com o mesmo custo de tempo */
      if (!perfil || perfil.estado !== 'ativa') {
        registrarFalha(chave);
        return json({ erro: ACESSO_NEGADO }, 401);
      }

      const { data: sessao, error } = await sb.auth.signInWithPassword({
        email: identidadeTecnica(perfil.perfil_id),
        password: senha
      });
      if (error || !sessao.session) {
        registrarFalha(chave);
        return json({ erro: ACESSO_NEGADO }, 401);
      }

      tentativas.delete(chave);
      /* last_login_at é a fonte (migration_presenca.sql); o trigger do banco
         mantém ultimo_acesso igual. Num banco sem a migration, a coluna não
         existe e o update falha — então cai para o campo antigo, e o login
         nunca deixa de ser registrado por causa disso. */
      const agora = new Date().toISOString();
      const { error: erroAcesso } = await sb.from('perfis')
        .update({ last_login_at: agora, last_seen_at: agora, ultimo_acesso: agora })
        .eq('id', perfil.perfil_id);
      if (erroAcesso) {
        await sb.from('perfis').update({ ultimo_acesso: agora }).eq('id', perfil.perfil_id);
      }
      /* zzz225: administrador entrando de um aparelho/rede novos avisa os super admins */
      try { await alertaAparelho(admin(), perfil.perfil_id, req); } catch (_e) { /* o aviso nunca impede de entrar */ }

      /* zzz218: verificação em 2 etapas. Com ela ligada, a sessão não sai
         daqui: fica guardada no desafio até o código conferir (login_2fa).
         Cliente novo de propósito — o `sb` agora fala como a pessoa. */
      let passo;
      try { passo = await DF.depoisDaSenha(admin(), perfil.perfil_id, sessao.session, corpo.aparelho); }
      catch (e) { return json({ erro: (e as Error).message || 'Não foi possível iniciar a verificação.' }, 503); }
      if (passo.pedir) return json(passo.pedir);

      /* devolve a sessão para o frontend assumir; a identidade técnica
         não vai junto */
      return json({
        access_token: sessao.session.access_token,
        refresh_token: sessao.session.refresh_token,
        expires_at: sessao.session.expires_at,
        ...passo.extra
      });
    }

    // =================================================================
    // BOOTSTRAP DO PRIMEIRO ADMIN
    //
    // Só funciona enquanto não existir nenhum admin ativo, e só com o
    // token de bootstrap configurado como secret. Depois do primeiro
    // uso, a própria condição desliga o mecanismo.
    // =================================================================
    if (acao === 'bootstrap') {
      const esperado = Deno.env.get('B7_BOOTSTRAP_TOKEN');
      if (!esperado) {
        return json({ erro: 'Bootstrap não está habilitado nesta instalação.' }, 403);
      }
      if (!tokenConfere(req, corpo.token, esperado)) {
        return json({ erro: 'Token de bootstrap inválido.' }, 403);
      }

      const { count } = await sb.from('perfis')
        .select('id', { count: 'exact', head: true })
        .eq('papel', 'admin').eq('estado', 'ativa');
      if ((count || 0) > 0) {
        return json({ erro: 'Já existe um administrador. O bootstrap está encerrado.' }, 409);
      }

      const username = String(corpo.username || '').trim();
      const nome = String(corpo.nome || '').trim() || username;
      const senha = String(corpo.senha || '');
      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
        return json({ erro: 'Username inválido. Use 3 a 32 letras, números, ponto, hífen ou _.' }, 400);
      }
      const fraca = senhaFraca(senha);
      if (fraca) return json({ erro: fraca }, 400);

      const criado = await criarConta(sb, { username, nome, senha, papel: 'admin' });
      if (criado.erro) return json({ erro: criado.erro }, 400);

      await auditar(sb, { id: criado.id, username }, 'bootstrap_admin',
        { tipo: 'perfil', id: criado.id, descricao: username });
      return json({ ok: true, username, papel: 'admin' });
    }

    // =================================================================
    // RECUPERAÇÃO DE ACESSO ADMINISTRATIVO
    //
    // O bootstrap se encerra quando existe um admin — mas se a senha
    // dele se perder, ninguém entra e a plataforma fica sem dono. Esta
    // ação resolve isso exigindo o mesmo B7_BOOTSTRAP_TOKEN: quem tem
    // acesso aos secrets do projeto já é, na prática, o administrador da
    // infraestrutura. Não é uma senha mestra: é uma redefinição
    // auditada, feita por quem controla o Supabase.
    //
    // Sem username, devolve a lista de admins ativos para você saber com
    // qual entrar. Com username e senha, redefine a senha daquele admin.
    // =================================================================
    if (acao === 'recuperar_admin') {
      const esperado = Deno.env.get('B7_BOOTSTRAP_TOKEN');
      if (!esperado) {
        return json({ erro: 'Configure o secret B7_BOOTSTRAP_TOKEN para usar a recuperação.' }, 403);
      }
      if (!tokenConfere(req, corpo.token, esperado)) {
        return json({ erro: 'Token inválido.' }, 403);
      }

      const { data: admins } = await sb.from('perfis')
        .select('id, username, nome, ultimo_acesso')
        .eq('papel', 'admin').eq('estado', 'ativa');

      if (!admins || !admins.length) {
        return json({ erro: 'Nenhum administrador ativo. Use a ação bootstrap.' }, 404);
      }

      /* sem username: só mostra quem existe, não mexe em nada */
      if (!corpo.username) {
        return json({
          administradores: admins.map((a: any) => ({
            username: a.username, nome: a.nome, ultimo_acesso: a.ultimo_acesso
          })),
          instrucao: 'Reenvie com "username" e "senha" para redefinir a senha desse administrador.'
        });
      }

      const alvo = admins.find((a: any) =>
        a.username.toLowerCase() === String(corpo.username).toLowerCase());
      if (!alvo) return json({ erro: 'Esse username não é de um administrador ativo.' }, 404);

      const fraca = senhaFraca(String(corpo.senha || ''));
      if (fraca) return json({ erro: fraca }, 400);

      const { error } = await sb.auth.admin
        .updateUserById(alvo.id, { password: String(corpo.senha) });
      if (error) return json({ erro: 'Não foi possível redefinir a senha.' }, 500);

      /* qualquer sessão anterior deixa de valer */
      await sb.auth.admin.signOut(alvo.id, 'global').catch(() => {});

      await auditar(sb, { id: alvo.id, username: alvo.username }, 'recuperar_admin',
        { tipo: 'perfil', id: alvo.id, descricao: alvo.username },
        { via: 'bootstrap_token' });

      return json({ ok: true, username: alvo.username });
    }

    // =================================================================
    // REMOVER UMA CONTA DE ADMINISTRADOR — recomeçar do zero
    //
    // Protegida pelo mesmo B7_BOOTSTRAP_TOKEN. Serve para desfazer um
    // bootstrap malfeito: apaga o perfil e a identidade de acesso, o que
    // libera o bootstrap para rodar de novo.
    //
    // Exige a confirmação explícita no corpo, porque é destrutivo: se a
    // conta apagada for a única de admin, ninguém entra até um novo
    // bootstrap. Nada além da conta é tocado — clientes, gravações,
    // roteiros e o histórico continuam onde estão.
    // =================================================================
    if (acao === 'remover_admin') {
      const esperado = Deno.env.get('B7_BOOTSTRAP_TOKEN');
      if (!esperado) {
        return json({ erro: 'Configure o secret B7_BOOTSTRAP_TOKEN para usar esta ação.' }, 403);
      }
      if (!tokenConfere(req, corpo.token, esperado)) return json({ erro: 'Token inválido.' }, 403);
      if (corpo.confirmar !== 'REMOVER') {
        return json({
          erro: 'Confirmação ausente. Reenvie com "confirmar": "REMOVER" para apagar a conta.'
        }, 400);
      }

      const username = String(corpo.username || '').trim();
      if (!username) return json({ erro: 'Informe o username da conta a remover.' }, 400);

      const { data: achados } = await sb.rpc('resolver_login', { p_username: username });
      const alvo = achados && achados[0];
      if (!alvo) return json({ erro: 'Conta não encontrada.' }, 404);

      /* a autoria em auditoria e histórico não some junto: o vínculo é
         por id, e o registro permanece mesmo sem a conta */
      await sb.from('perfil_clientes').delete().eq('perfil_id', alvo.perfil_id);
      const { error: erroPerfil } = await sb.from('perfis').delete().eq('id', alvo.perfil_id);
      if (erroPerfil) return json({ erro: 'Não foi possível remover o perfil.' }, 500);

      await sb.auth.admin.deleteUser(alvo.perfil_id).catch(() => {});

      await auditar(sb, { username: 'bootstrap' }, 'remover_admin',
        { tipo: 'perfil', id: alvo.perfil_id, descricao: username },
        { via: 'bootstrap_token' });

      const { count } = await sb.from('perfis')
        .select('id', { count: 'exact', head: true })
        .eq('papel', 'admin').eq('estado', 'ativa');

      return json({
        ok: true, removido: username,
        admins_restantes: count || 0,
        bootstrap_liberado: (count || 0) === 0
      });
    }

    // =================================================================
    // OPERAÇÕES ADMINISTRATIVAS
    // O papel vem do banco, nunca do corpo da requisição.
    // =================================================================
    /* Antes de exigir sessão, conferir se a ação existe. Sem isto, uma
       ação desconhecida — típica de função desatualizada — respondia
       "sessão inválida", mandando quem instala investigar o lugar
       errado. Foi exatamente o que aconteceu na primeira instalação. */
    // =================================================================
    // VERIFICAÇÃO EM 2 ETAPAS (zzz218) — dois_fatores.ts
    // =================================================================
    if (acao === 'email_link') {
      try { const r = await DF.acaoLink(admin(), corpo); return json(r.corpo, r.status); }
      catch (e) { return json({ erro: (e as Error).message || 'Falha ao confirmar.' }, 503); }
    }
    if (acao === 'login_2fa' || acao === 'login_2fa_reenviar' || acao === 'login_2fa_status') {
      try { const r = await DF.acaoLogin(admin(), acao, corpo); return json(r.corpo, r.status); }
      catch (e) { return json({ erro: (e as Error).message || 'Falha na verificação.' }, 503); }
    }
    if (DF.ACOES_SEG.includes(acao)) {
      const eu = await quemChamou(req);
      if (!eu) return json({ erro: 'Sessão inválida ou expirada.' }, 401);
      /* conferir a senha num cliente descartável (signIn troca a identidade do cliente) */
      const confere = async (senha: string) => {
        if (!senha) return false;
        const { error } = await admin().auth.signInWithPassword({ email: identidadeTecnica(eu.id), password: senha });
        return !error;
      };
      try {
        const r = await DF.acaoPropria(admin(), eu, acao, corpo, confere);
        if (r.status === 200 && ['seg_email_confirmar', 'seg_app_confirmar', 'seg_desligar'].includes(acao)) {
          await auditar(sb, eu, acao === 'seg_desligar' ? 'desligar_2fa' : 'ligar_2fa', { tipo: 'perfil', id: eu.id, descricao: eu.username },
            { metodo: (r.corpo as any).metodo || null });
        }
        return json(r.corpo, r.status);
      } catch (e) { return json({ erro: (e as Error).message || 'Não foi possível concluir.' }, 503); }
    }
    if (DF.ACOES_SEG_ADMIN.includes(acao)) {
      const eu = await quemChamou(req);
      if (!eu || eu.papel !== 'admin') return json({ erro: 'Só o administrador pode fazer isso.' }, 403);
      if (acao === 'seg_politica') {
        const lim = await limiteDe(admin(), eu.id, 'seguranca');
        if (lim === 'bloqueado') return json({ erro: 'A política de segurança está liberada só para super admin.' }, 403);
        if (lim === 'aprovacao') return await pedirAprovacao(admin(), eu, 'seguranca', corpo, { tipo: 'config', id: null, desc: 'Verificação em 2 etapas' },
          'Mudar a verificação em 2 etapas para: ' + ({ ninguem: 'opcional', gestao: 'obrigatória para a gestão', todos: 'obrigatória para todos' } as Record<string, string>)[String(corpo.exigir_2fa)] );
      }
      if (acao === 'seg_resetar' && corpo.perfil_id && corpo.perfil_id !== eu.id && (await nivelSuper(admin(), String(corpo.perfil_id))) && !(await nivelSuper(admin(), eu.id))) {
        return json({ erro: 'Esta conta é de um super admin: só um super admin mexe nela.' }, 403);
      }
      const r = await DF.acaoAdmin(admin(), acao, corpo);
      if (r.status === 200) await auditar(sb, eu, acao === 'seg_politica' ? 'politica_2fa' : 'resetar_2fa',
        { tipo: 'perfil', id: acao === 'seg_resetar' ? String(corpo.perfil_id || '') : eu.id, descricao: acao }, acao === 'seg_politica' ? { exigir_2fa: corpo.exigir_2fa } : {});
      return json(r.corpo, r.status);
    }

    /* Ações da própria conta: exigem sessão, mas não exigem ser admin.
       Só alteram o próprio registro — o id vem do token, nunca do corpo,
       então ninguém edita a conta de outra pessoa por aqui. */
    if (acao === 'meu_perfil' || acao === 'minha_senha') {
      const eu = await quemChamou(req);
      if (!eu) return json({ erro: 'Sessão inválida ou expirada.' }, 401);

      if (acao === 'meu_perfil') {
        const nome = String(corpo.nome || '').trim();
        if (!nome) return json({ erro: 'Informe um nome.' }, 400);
        if (nome.length > 80) return json({ erro: 'Nome muito longo.' }, 400);

        /* só o nome: papel, estado e username ficam fora de propósito */
        await sb.from('perfis').update({ nome }).eq('id', eu.id);
        await auditar(sb, eu, 'editar_proprio_perfil',
          { tipo: 'perfil', id: eu.id, descricao: eu.username });
        return json({ ok: true, nome });
      }

      /* trocar a própria senha exige provar que sabe a atual: uma sessão
         esquecida aberta não pode virar tomada de conta */
      const atual = String(corpo.senha_atual || '');
      const nova = String(corpo.senha_nova || '');
      const fraca = senhaFraca(nova);
      if (fraca) return json({ erro: fraca }, 400);

      const { error: erroConfere } = await sb.auth.signInWithPassword({
        email: identidadeTecnica(eu.id), password: atual
      });
      if (erroConfere) return json({ erro: 'A senha atual está incorreta.' }, 403);

      const { error } = await sb.auth.admin.updateUserById(eu.id, { password: nova });
      if (error) return json({ erro: 'Não foi possível trocar a senha.' }, 500);
      await sb.from('perfis').update({ senha_provisoria: false }).eq('id', eu.id);

      /* derruba as outras sessões; a atual segue com o token que já tem */
      await sb.auth.admin.signOut(eu.id, 'others').catch(() => {});

      await auditar(sb, eu, 'trocar_propria_senha',
        { tipo: 'perfil', id: eu.id, descricao: eu.username });
      return json({ ok: true });
    }

    const ACOES_ADMIN = ['criar_usuario', 'redefinir_senha',
                         'alterar_conta', 'listar_usuarios', 'excluir_conta',
                         'avatar_de', 'entrar_como', 'salvar_preset',
                         /* zzz225: só super admin (conferido abaixo) */
                         'super_derrubar_todos', 'super_derrubar', 'super_brevo', 'super_emergencia', 'super_rebaixar',
                         'super_transferir_iniciar', 'super_transferir_confirmar'];
    /* qualquer pessoa autenticada edita a própria conta */
    const ACOES_PROPRIAS = ['meu_perfil', 'meu_avatar'];
    /* zzz261: o dono da empresa cuida das pessoas dela (conferido abaixo) */
    const ACOES_DONO = ['cliente_convidar', 'cliente_remover', 'cliente_nova_senha'];
    if (!ACOES_ADMIN.includes(acao) && !ACOES_PROPRIAS.includes(acao) && !ACOES_DONO.includes(acao)) {
      return json({
        erro: 'Ação desconhecida: "' + String(acao || '(vazia)') + '". ' +
              'Se você esperava que ela existisse, a função publicada pode estar ' +
              'desatualizada — republique o b7-auth com a versão mais recente.',
        codigo: 'acao_desconhecida',
        acoes_disponiveis: ['ping', 'login', 'bootstrap', 'recuperar_admin',
                            'remover_admin', 'meu_perfil', 'minha_senha'].concat(ACOES_ADMIN, ACOES_DONO)
      }, 400);
    }

    /* Distinguir os casos importa para quem está instalando: "não entrei
       ainda" e "minha sessão venceu" pedem ações diferentes. A distinção
       não vaza nada — em ambos os casos o acesso é negado. */
    const cab = req.headers.get('authorization') || '';
    const temToken = cab.startsWith('Bearer ') && cab.length > 40;
    const autor = await quemChamou(req);
    if (!autor) {
      return json({
        erro: temToken
          ? 'Sessão inválida ou expirada. Entre novamente.'
          : 'Nenhuma sessão ativa. Entre com usuário e senha antes de usar esta área.',
        codigo: temToken ? 'sessao_invalida' : 'sem_sessao'
      }, 401);
    }
    // =================================================================
    // MINHA CONTA — nome e senha da própria pessoa
    //
    // O id vem sempre da sessão, nunca do corpo: assim ninguém edita a
    // conta de outra pessoa mandando outro id. Papel, estado e empresas
    // não entram aqui — quem muda isso é o administrador.
    // =================================================================
    if (acao === 'meu_perfil') {
      const patch: Record<string, unknown> = {};
      if (typeof corpo.nome === 'string' && corpo.nome.trim()) {
        patch.nome = corpo.nome.trim();
      }

      if (corpo.senha) {
        const fraca = senhaFraca(String(corpo.senha));
        if (fraca) return json({ erro: fraca }, 400);

        /* trocar a própria senha exige provar que sabe a atual: sem isso,
           quem pegasse a máquina destravada trocaria a senha e tomaria a
           conta */
        if (!corpo.senha_atual) {
          return json({ erro: 'Informe a senha atual para definir uma nova.' }, 400);
        }
        const conferir = await sb.auth.signInWithPassword({
          email: identidadeTecnica(autor.id),
          password: String(corpo.senha_atual)
        });
        if (conferir.error) return json({ erro: 'A senha atual não confere.' }, 403);

        const { error } = await sb.auth.admin
          .updateUserById(autor.id, { password: String(corpo.senha) });
        if (error) return json({ erro: 'Não foi possível alterar a senha.' }, 500);
        patch.senha_provisoria = false;
      }

      if (Object.keys(patch).length) {
        await sb.from('perfis').update(patch).eq('id', autor.id);
      }

      await auditar(sb, autor, 'meu_perfil',
        { tipo: 'perfil', id: autor.id, descricao: autor.username },
        { alterou_senha: !!corpo.senha, alterou_nome: !!patch.nome });

      return json({ ok: true });
    }

    // =================================================================
    // MINHA FOTO
    // O id vem da sessão. Mandar outro id no corpo não muda nada — é
    // assim que se impede alguém de trocar a foto de outra pessoa.
    // =================================================================
    if (acao === 'meu_avatar') {
      const { data: eu } = await sb.from('perfis').select('avatar_url').eq('id', autor.id).maybeSingle();
      const r = await resolverAvatar(sb, autor.id, corpo, (eu && eu.avatar_url) || null);
      if (r.erro) return json({ erro: r.erro }, 400);
      const url = r.url;
      const { error: erroAvatar } = await sb.from('perfis').update({
        avatar_url: url || null,
        avatar_em: url ? new Date().toISOString() : null
      }).eq('id', autor.id);
      if (erroAvatar) {
        return json({ erro: /column/i.test(erroAvatar.message)
          ? 'O banco ainda não tem o campo de foto. Rode migration_portal.sql no Supabase.'
          : 'Não foi possível salvar a foto.' }, 400);
      }
      await auditar(sb, autor, url ? 'avatar_definido' : 'avatar_removido',
        { tipo: 'perfil', id: autor.id, descricao: autor.username });
      return json({ ok: true });
    }

    // =================================================================
    // EQUIPE DA EMPRESA (zzz261) — o dono convida, troca a senha e tira
    // pessoas da empresa dele. A administração da B7 também pode.
    // Quem é dono é lido do banco (perfil_clientes), nunca do corpo.
    // Papel e remoção sem senha ficam no banco (cliente_definir_papel).
    // =================================================================
    if (ACOES_DONO.includes(acao)) {
      const clientId = String(corpo.client_id || '');
      const { data: cli } = await sb.from('clientes').select('id, nome, servico').eq('id', clientId).maybeSingle();
      if (!cli) return json({ erro: 'Empresa não encontrada.' }, 404);
      if (autor.papel !== 'admin') {
        const { data: v } = await sb.from('perfil_clientes').select('papel')
          .eq('perfil_id', autor.id).eq('client_id', clientId).maybeSingle();
        if (autor.papel !== 'cliente' || !v || v.papel !== 'dono') {
          return json({ erro: 'Só o dono da empresa cuida da equipe dela.' }, 403);
        }
        if ((cli.servico || 'ativo') !== 'ativo') return json({ erro: 'O serviço desta empresa está pausado.' }, 403);
      }
      const avisarB7 = async (titulo: string, msg: string) => {
        if (autor.papel === 'admin') return;
        await sb.rpc('_cliente_avisar_b7', { p_client: clientId, p_titulo: cli.nome + ': ' + titulo, p_msg: msg })
          .then(() => {}, () => {});
      };
      const PAPEL_NOME: Record<string, string> = { dono: 'Dono', gestor: 'Gestor', equipe: 'Equipe' };

      if (acao === 'cliente_convidar') {
        const nome = String(corpo.nome || '').trim().slice(0, 80);
        const papelEmp = String(corpo.papel || 'equipe');
        if (!nome) return json({ erro: 'Informe o nome da pessoa.' }, 400);
        if (!PAPEL_NOME[papelEmp]) return json({ erro: 'Papel inválido.' }, 400);
        const username = await usernameLivre(sb, nome);
        const senha = senhaProvisoria();
        const criado = await criarConta(sb, { username, nome, senha, papel: 'cliente',
          empresas: [{ client_id: clientId, papel: papelEmp }], criadoPor: autor.id, convidadoPor: autor.id });
        if (criado.erro) return json({ erro: criado.erro }, 400);
        await auditar(sb, autor, 'cliente_convidar', { tipo: 'perfil', id: criado.id, descricao: username },
          { client_id: clientId, papel: papelEmp });
        await avisarB7('nova pessoa no portal', autor.nome + ' convidou ' + nome + ' (' + PAPEL_NOME[papelEmp] + ').');
        return json({ ok: true, id: criado.id, username, senha, nome, papel: papelEmp });
      }

      /* as duas ações abaixo mexem numa pessoa que precisa ser desta empresa */
      const perfilId = String(corpo.perfil_id || '');
      const { data: alvo } = await sb.from('perfis').select('id, nome, username, papel').eq('id', perfilId).maybeSingle();
      const { data: vAlvo } = await sb.from('perfil_clientes').select('papel')
        .eq('perfil_id', perfilId).eq('client_id', clientId).maybeSingle();
      if (!alvo || !vAlvo || alvo.papel !== 'cliente') return json({ erro: 'Essa pessoa não é desta empresa.' }, 404);

      if (acao === 'cliente_nova_senha') {
        if (perfilId === autor.id) return json({ erro: 'Para trocar a sua senha, use Meu perfil.' }, 400);
        /* conta ligada a outras empresas: só a B7 mexe na senha */
        const { count } = await sb.from('perfil_clientes').select('client_id', { count: 'exact', head: true }).eq('perfil_id', perfilId);
        if (autor.papel !== 'admin' && (count || 0) > 1) {
          return json({ erro: 'Essa pessoa também acessa outra empresa. Peça a nova senha à B7.' }, 403);
        }
        const senha = senhaProvisoria();
        const { error } = await sb.auth.admin.updateUserById(perfilId, { password: senha });
        if (error) return json({ erro: 'Não foi possível gerar a nova senha.' }, 500);
        await sb.from('perfis').update({ senha_provisoria: true, estado: 'ativa' }).eq('id', perfilId);
        await sb.auth.admin.signOut(perfilId, 'global').catch(() => {});
        await auditar(sb, autor, 'cliente_nova_senha', { tipo: 'perfil', id: perfilId, descricao: alvo.username }, { client_id: clientId });
        return json({ ok: true, username: alvo.username, senha, nome: alvo.nome });
      }

      if (acao === 'cliente_remover') {
        if (vAlvo.papel === 'dono') {
          const { count } = await sb.from('perfil_clientes').select('perfil_id', { count: 'exact', head: true })
            .eq('client_id', clientId).eq('papel', 'dono');
          if ((count || 0) < 2) return json({ erro: 'A empresa precisa de pelo menos um dono.' }, 400);
        }
        await sb.from('perfil_clientes').delete().eq('perfil_id', perfilId).eq('client_id', clientId);
        const { count: resta } = await sb.from('perfil_clientes').select('client_id', { count: 'exact', head: true }).eq('perfil_id', perfilId);
        if (!resta) {
          await sb.from('perfis').update({ estado: 'desativada' }).eq('id', perfilId).eq('papel', 'cliente');
          await sb.auth.admin.signOut(perfilId, 'global').catch(() => {});
        }
        await auditar(sb, autor, 'cliente_remover', { tipo: 'perfil', id: perfilId, descricao: alvo.username },
          { client_id: clientId, papel: vAlvo.papel });
        await avisarB7('acesso removido', (alvo.nome || 'Alguém') + ' não acessa mais o portal da empresa.');
        return json({ ok: true });
      }
    }

    if (autor.papel !== 'admin') {
      return json({ erro: 'Ação restrita ao administrador.' }, 403);
    }

    // =================================================================
    // ENTRAR COMO — o administrador assume a conta de alguém da equipe
    //
    // Devolve uma sessão de verdade da pessoa escolhida: a partir dela,
    // o banco responde como ela (RLS, autoria, histórico), que é o que o
    // administrador pediu — cobrir o trabalho de alguém como se fosse a
    // própria pessoa. Não usa nem revela senha: a sessão nasce de um link
    // de acesso gerado e consumido aqui dentro, sem e-mail nenhum.
    //
    // Três travas:
    //   • só administrador (a checagem acima, com o papel lido do banco);
    //   • nunca conta de cliente: o que um cliente aprova é registro da
    //     decisão DELE, e uma aprovação feita pela agência em nome do
    //     cliente seria um registro falso. Para ver o Portal existe a
    //     prévia de cliente, que é só leitura;
    //   • toda entrada fica na auditoria (quem entrou, na conta de quem e
    //     quando). O histórico do sistema mostra a pessoa; este registro
    //     é o que permite, depois, saber que foi o administrador.
    //
    // Presença não é tocada: entrar na conta de alguém não pode fazê-lo
    // aparecer "online agora" nem mudar o "último acesso" dele.
    // =================================================================
    /* zzz225: AÇÕES DO SUPER ADMIN */
    if (acao.startsWith('super_')) {
      const nivel = await nivelSuper(sb, autor.id);
      if (!nivel) return json({ erro: 'Só super admin.' }, 403);
      const soSupremo = ['super_emergencia', 'super_rebaixar', 'super_transferir_iniciar', 'super_transferir_confirmar'].includes(acao);
      if (soSupremo && nivel !== 'supremo') return json({ erro: 'Só o admin supremo.' }, 403);
      if (acao === 'super_derrubar_todos' || acao === 'super_derrubar') {
        /* derruba as sessões (menos a de quem pediu); todos entram de novo com senha */
        let q = sb.from('perfis').select('id, superadmin').eq('estado', 'ativa').neq('id', autor.id);
        if (acao === 'super_derrubar') q = q.eq('id', String(corpo.perfil_id || ''));
        const { data: alvos } = await q;
        let n = 0;
        for (const a of (alvos || [])) {
          if (a.superadmin === 'supremo' && nivel !== 'supremo') continue;
          try { await sb.auth.admin.signOut(a.id, 'global'); n++; } catch (_e) { /* segue */ }
          await sb.from('seguranca_aparelhos').update({ revogado: true }).eq('perfil_id', a.id);
        }
        await auditar(sb, autor, acao, { tipo: 'sistema', id: acao === 'super_derrubar' ? String(corpo.perfil_id) : null, descricao: n + ' sessões' }, { contas: n });
        return json({ ok: true, contas: n });
      }
      if (acao === 'super_brevo') {
        const k = Deno.env.get('B7_BREVO_API_KEY');
        if (!k) return json({ ok: true, configurado: false });
        try {
          const r = await fetch('https://api.brevo.com/v3/account', { headers: { 'api-key': k, accept: 'application/json' } });
          const d = await r.json().catch(() => ({}));
          // deno-lint-ignore no-explicit-any
          return json({ ok: r.ok, configurado: true, plano: (d.plan || []).map((p: any) => ({ tipo: p.type, creditos: p.credits ?? null, unidade: p.creditsType || null })) });
        } catch (_e) { return json({ ok: false, configurado: true }); }
      }
      if (acao === 'super_emergencia') {
        /* congela o sistema para todos, menos os super admins */
        const ativo = corpo.ativo === true;
        const valor = ativo ? { ativo: true, emergencia: true, mensagem: String(corpo.mensagem || 'O sistema está temporariamente fora do ar.').slice(0, 300),
          inicio: new Date().toISOString(), fim: null, portal: true, agendada: false, por: autor.id } : { ativo: false, por: autor.id };
        await sb.from('sistema_config').upsert({ chave: 'manutencao', valor, atualizado_em: new Date().toISOString(), atualizado_por: autor.id }, { onConflict: 'chave' });
        await auditar(sb, autor, ativo ? 'emergencia_ligada' : 'emergencia_desligada', { tipo: 'sistema', id: null, descricao: 'emergência' }, {});
        return json({ ok: true, ativo });
      }
      if (acao === 'super_rebaixar') {
        /* tira o administrador (e o super admin) de alguém; a pessoa fica com uma função */
        const id = String(corpo.perfil_id || ''), fn = await resolverFuncao(sb, corpo.funcao);
        if (!id || id === autor.id) return json({ erro: 'Escolha outra pessoa.' }, 400);
        if (fn.erro || !fn.funcao) return json({ erro: fn.erro || 'Escolha a função que a pessoa passa a ter.' }, 400);
        const antes = await fotoAcesso(sb, id);
        const { error } = await sb.from('perfis').update({ superadmin: null, eh_admin: false, funcao: fn.funcao, funcao_personalizada: fn.personalizada }).eq('id', id);
        if (error) return json({ erro: 'Não foi possível: ' + error.message }, 400);
        await sb.auth.admin.signOut(id, 'global').catch(() => {});
        await auditar(sb, autor, 'super_rebaixou', { tipo: 'perfil', id }, { acesso: { antes, depois: await fotoAcesso(sb, id) } });
        return json({ ok: true });
      }
      if (acao === 'super_transferir_iniciar') {
        const r = await DF.transferirIniciar(sb, autor, String(corpo.para || ''));
        return json(r.corpo, r.status);
      }
      if (acao === 'super_transferir_confirmar') {
        const r = await DF.transferirConfirmar(sb, autor, corpo.codigo);
        if (r.status === 200) await auditar(sb, autor, 'supremo_transferido', { tipo: 'perfil', id: String(r.corpo.para || '') }, {});
        return json(r.corpo, r.status);
      }
    }

    /* zzz225: LIMITES DOS ADMINISTRADORES COMUNS (aprovação dupla) */
    if (acao === 'entrar_como' && (await limiteDe(sb, autor.id, 'entrar_como')) === 'bloqueado') {
      return json({ erro: 'Entrar na conta de outra pessoa está liberado só para super admin.' }, 403);
    }
    if (acao === 'excluir_conta') {
      const lim = await limiteDe(sb, autor.id, 'excluir_conta');
      if (lim === 'bloqueado') return json({ erro: 'Excluir contas está liberado só para super admin.' }, 403);
      if (lim === 'aprovacao') {
        const { data: alvo } = await sb.from('perfis').select('nome, username').eq('id', corpo.perfil_id).maybeSingle();
        return await pedirAprovacao(sb, autor, 'excluir_conta', corpo, { tipo: 'perfil', id: String(corpo.perfil_id || ''), desc: alvo ? alvo.nome : null },
          'Excluir a conta de ' + (alvo ? alvo.nome + ' (@' + alvo.username + ')' : 'alguém'));
      }
    }
    if (acao === 'criar_usuario' || acao === 'salvar_preset' || (acao === 'alterar_conta' && await mudaAcesso(sb, corpo))) {
      const lim = await limiteDe(sb, autor.id, 'acessos');
      if (lim === 'bloqueado' || (lim === 'aprovacao' && acao === 'criar_usuario')) return json({ erro: 'Criar contas e mudar acessos está liberado só para super admin.' }, 403);
      if (lim === 'aprovacao') {
        const { data: alvo } = acao === 'alterar_conta' ? await sb.from('perfis').select('nome, username').eq('id', corpo.perfil_id).maybeSingle() : { data: null };
        return await pedirAprovacao(sb, autor, 'acessos', corpo, { tipo: acao === 'salvar_preset' ? 'funcao' : 'perfil', id: acao === 'alterar_conta' ? String(corpo.perfil_id || '') : null,
          desc: alvo ? alvo.nome : String(corpo.funcao || '') },
          acao === 'salvar_preset' ? 'Mudar o padrão da função ' + String(corpo.funcao || '') : 'Mudar o acesso de ' + (alvo ? alvo.nome : 'alguém') +
            (corpo.estado === 'desativada' ? ' (desativar a conta)' : ''));
      }
    }

    /* zzz224: SUPER ADMIN. Administrador comum não mexe na conta de um super admin
       (senha, acesso, desativar, excluir, foto, entrar como); o admin supremo só
       ele mesmo. O cargo em si só muda pelo banco (gatilho _perfis_trava_super). */
    if (['alterar_conta', 'redefinir_senha', 'excluir_conta', 'entrar_como', 'avatar_de'].includes(acao) && corpo.perfil_id) {
      const [{ data: alvoSup }, { data: euSup }] = await Promise.all([
        sb.from('perfis').select('superadmin').eq('id', corpo.perfil_id).maybeSingle(),
        sb.from('perfis').select('superadmin').eq('id', autor.id).maybeSingle()]);
      const nivelAlvo = alvoSup && alvoSup.superadmin, nivelEu = euSup && euSup.superadmin;
      if (corpo.perfil_id !== autor.id && nivelAlvo === 'supremo') return json({ erro: 'Esta conta é do admin supremo: só ele mexe nela.' }, 403);
      if (corpo.perfil_id !== autor.id && nivelAlvo === 'super' && !nivelEu) return json({ erro: 'Esta conta é de um super admin: só um super admin mexe nela.' }, 403);
    }

    if (acao === 'entrar_como') {
      const { data: alvo } = await sb.from('perfis')
        .select('id, username, nome, papel, estado').eq('id', corpo.perfil_id).maybeSingle();
      if (!alvo) return json({ erro: 'Conta não encontrada.' }, 404);
      if (alvo.id === autor.id) return json({ erro: 'Você já está na sua conta.' }, 400);
      if (alvo.estado !== 'ativa') return json({ erro: 'Esta conta não está ativa.' }, 400);
      if (alvo.papel === 'cliente') {
        return json({ erro: 'Não é possível entrar na conta de um cliente. ' +
          'Use "Visualizar como" a empresa para ver o Portal.' }, 403);
      }

      const { data: link, error: erroLink } = await sb.auth.admin.generateLink({
        type: 'magiclink', email: identidadeTecnica(alvo.id)
      });
      const hash = link?.properties?.hashed_token;
      if (erroLink || !hash) return json({ erro: 'Não foi possível abrir a conta.' }, 500);

      /* cliente à parte: consumir o link num cliente com sessão em
         memória trocaria a identidade do `sb` de serviço usado abaixo */
      const publico = createClient(
        Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
        { auth: { autoRefreshToken: false, persistSession: false } });
      const { data: aberta, error: erroSessao } = await publico.auth.verifyOtp({ token_hash: hash, type: 'magiclink' });
      if (erroSessao || !aberta?.session) return json({ erro: 'Não foi possível abrir a conta.' }, 500);

      await auditar(sb, autor, 'entrar_como',
        { tipo: 'perfil', id: alvo.id, descricao: alvo.username }, { papel: alvo.papel });
      return json({
        access_token: aberta.session.access_token,
        refresh_token: aberta.session.refresh_token,
        alvo: { id: alvo.id, nome: alvo.nome, username: alvo.username, papel: alvo.papel }
      });
    }

    // =================================================================
    // FOTO DE OUTRA PESSOA — ação administrativa
    // O Admin não precisa da senha de ninguém para isso, mas a operação
    // fica registrada com o nome de quem fez.
    // =================================================================
    if (acao === 'avatar_de') {
      const { data: alvo } = await sb.from('perfis')
        .select('id, username, avatar_url').eq('id', corpo.perfil_id).maybeSingle();
      if (!alvo) return json({ erro: 'Conta não encontrada.' }, 404);
      const r = await resolverAvatar(sb, alvo.id, corpo, alvo.avatar_url || null);
      if (r.erro) return json({ erro: r.erro }, 400);
      const url = r.url;

      const { error: erroAv } = await sb.from('perfis').update({
        avatar_url: url || null,
        avatar_em: url ? new Date().toISOString() : null
      }).eq('id', alvo.id);
      if (erroAv) {
        return json({ erro: /column/i.test(erroAv.message)
          ? 'O banco ainda não tem o campo de foto. Rode migration_portal.sql no Supabase.'
          : 'Não foi possível salvar a foto.' }, 400);
      }
      await auditar(sb, autor, url ? 'avatar_definido_por_admin' : 'avatar_removido_por_admin',
        { tipo: 'perfil', id: alvo.id, descricao: alvo.username });
      return json({ ok: true });
    }

    // =================================================================
    // EXCLUIR CONTA
    //
    // Apaga a identidade de acesso e o perfil. NÃO apaga o que a pessoa
    // produziu: roteiros, comentários, aprovações e histórico continuam,
    // com a autoria preservada por id. Cancelar um acesso não pode
    // reescrever a história da produção.
    // =================================================================
    if (acao === 'excluir_conta') {
      if (corpo.confirmar !== 'EXCLUIR') {
        return json({ erro: 'Confirmação ausente.' }, 400);
      }
      const { data: alvo } = await sb.from('perfis')
        .select('id, username, papel').eq('id', corpo.perfil_id).maybeSingle();
      if (!alvo) return json({ erro: 'Conta não encontrada.' }, 404);

      if (alvo.id === autor.id) {
        return json({ erro: 'Você não pode excluir a própria conta.' }, 400);
      }

      /* Nunca deixar a plataforma sem administrador: se este for o
         último admin ativo, a exclusão é recusada. */
      if (alvo.papel === 'admin') {
        const { count } = await sb.from('perfis')
          .select('id', { count: 'exact', head: true })
          .eq('papel', 'admin').eq('estado', 'ativa');
        if ((count || 0) <= 1) {
          return json({ erro: 'Este é o último administrador ativo. ' +
            'Crie outro antes de excluir esta conta.' }, 400);
        }
      }

      await sb.from('perfil_clientes').delete().eq('perfil_id', alvo.id);
      await sb.from('perfis').delete().eq('id', alvo.id);
      await sb.auth.admin.deleteUser(alvo.id).catch(() => {});

      await auditar(sb, autor, 'excluir_conta',
        { tipo: 'perfil', id: alvo.id, descricao: alvo.username },
        { papel: alvo.papel });
      return json({ ok: true, removido: alvo.username });
    }

    if (acao === 'criar_usuario') {
      const username = String(corpo.username || '').trim();
      const nome = String(corpo.nome || '').trim();
      /* zzz68: conta interna chega como { tipo:'interno', eh_admin, funcao,
         modulos }. O formato antigo (papel + funcoes_extra) segue aceito. */
      const modeloNovo = corpo.tipo === 'interno';
      let ident: Identidade | null = null;
      const fnCriar = modeloNovo ? await resolverFuncao(sb, corpo.funcao) : { funcao: null, personalizada: null };
      if (fnCriar.erro) return json({ erro: fnCriar.erro }, 400);
      const secCriar = modeloNovo ? await normalizarSecundarias(sb, corpo.secundarias) : { lista: [] };
      if (secCriar.erro) return json({ erro: secCriar.erro }, 400);
      if (modeloNovo) {
        ident = identidadeInterna(corpo.eh_admin, fnCriar.funcao);
        if (ident.erro) return json({ erro: ident.erro }, 400);
      }
      const papel = ident ? ident.papel : String(corpo.papel || 'cliente');
      const senha = String(corpo.senha || '');
      const excecoes = modeloNovo ? await normalizarExcecoes(sb, corpo.modulos) : { lista: [] };
      if (excecoes.erro) return json({ erro: excecoes.erro }, 400);

      if (!['admin', 'coordenador', 'designer', 'videomaker', 'cliente'].includes(papel)) {
        return json({ erro: 'Perfil inválido.' }, 400);
      }
      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
        return json({ erro: 'Username inválido. Use 3 a 32 letras, números, ponto, hífen ou _.' }, 400);
      }
      if (!nome) return json({ erro: 'Informe o nome da pessoa.' }, 400);
      const fraca = senhaFraca(senha);
      if (fraca) return json({ erro: fraca }, 400);

      /* Funções extras (multi-função aditiva, Parte 1.1 do B7 Vídeo):
         uma pessoa continua com UM papel principal, mas pode acumular
         funções extras de produção (por ora, só "videomaker" — o mesmo
         valor do papel principal não conta como extra, e Cliente é
         externo, nunca combina com função interna). */
      const funcoesExtra = modeloNovo ? { lista: [] as string[] } : normalizarFuncoesExtra(corpo.funcoes_extra, papel);
      if (funcoesExtra.erro) return json({ erro: funcoesExtra.erro }, 400);

      const criado = await criarConta(sb, {
        username, nome, senha, papel,
        podeAprovar: !!corpo.pode_aprovar,
        empresas: normEmpresas(corpo.empresas, corpo.papel_cliente),
        criadoPor: autor.id
      });
      if (criado.erro) return json({ erro: criado.erro }, 400);

      if (ident) {
        /* o gatilho do banco deriva papel e o espelho de função extra */
        const { error: eId } = await sb.from('perfis')
          .update({ eh_admin: ident.ehAdmin, funcao: ident.funcao, funcao_personalizada: ident.funcao ? fnCriar.personalizada : null }).eq('id', criado.id);
        if (eId) return json({ erro: 'Conta criada, mas não foi possível gravar a função: ' + eId.message }, 500);
        if (!ident.ehAdmin) await gravarExcecoes(sb, criado.id, excecoes.lista, autor.id);
        if (!ident.ehAdmin && secCriar.lista.length) await gravarSecundarias(sb, criado.id, secCriar.lista, autor.id);
      } else if (funcoesExtra.lista.length) {
        await sb.from('perfis_funcoes_extra').insert(
          funcoesExtra.lista.map((f) => ({ perfil_id: criado.id, funcao: f, criado_por: autor.id })));
      }

      await auditar(sb, autor, 'criar_usuario',
        { tipo: 'perfil', id: criado.id, descricao: username },
        { papel, empresas: (corpo.empresas || []).length, funcoes_extra: funcoesExtra.lista,
          eh_admin: ident?.ehAdmin, funcao: fnCriar.personalizada || ident?.funcao, excecoes: excecoes.lista.length,
          acesso: { antes: null, depois: await fotoAcesso(sb, criado.id) } });
      return json({ ok: true, id: criado.id, username });
    }

    if (acao === 'redefinir_senha') {
      const senha = String(corpo.senha || '');
      const fraca = senhaFraca(senha);
      if (fraca) return json({ erro: fraca }, 400);

      const { data: alvo } = await sb.from('perfis')
        .select('id, username').eq('id', corpo.perfil_id).maybeSingle();
      if (!alvo) return json({ erro: 'Conta não encontrada.' }, 404);

      const { error } = await sb.auth.admin.updateUserById(alvo.id, { password: senha });
      if (error) return json({ erro: 'Não foi possível redefinir a senha.' }, 500);
      /* cliente que recebe senha nova é convidado a trocá-la no portal */
      await sb.from('perfis').update({ senha_provisoria: true }).eq('id', alvo.id).eq('papel', 'cliente');

      /* derruba as sessões abertas: quem estava logado precisa entrar de
         novo com a senha nova */
      await sb.auth.admin.signOut(alvo.id, 'global').catch(() => {});

      await auditar(sb, autor, 'redefinir_senha',
        { tipo: 'perfil', id: alvo.id, descricao: alvo.username });
      return json({ ok: true });
    }

    if (acao === 'alterar_conta') {
      const patch: Record<string, unknown> = {};
      if (corpo.papel) {
        if (!['admin', 'coordenador', 'designer', 'videomaker', 'cliente'].includes(corpo.papel)) {
          return json({ erro: 'Perfil inválido.' }, 400);
        }
        patch.papel = corpo.papel;
      }
      if (corpo.estado) {
        if (!['ativa', 'desativada', 'removida'].includes(corpo.estado)) {
          return json({ erro: 'Estado inválido.' }, 400);
        }
        patch.estado = corpo.estado;
      }
      if (corpo.nome) patch.nome = String(corpo.nome).trim();
      if (typeof corpo.pode_aprovar === 'boolean') patch.pode_aprovar = corpo.pode_aprovar;

      /* zzz68: modelo novo — { tipo:'interno', eh_admin, funcao, modulos }
         ou { tipo:'cliente' }. Tem precedência sobre o papel legado. */
      let identNova: Identidade | null = null;
      const antesAcesso = await fotoAcesso(sb, String(corpo.perfil_id));
      let secNovas: { lista: { funcao: string; nivel_max: string }[]; erro?: string } | null = null;
      if (corpo.tipo === 'interno') {
        const fnNova = await resolverFuncao(sb, corpo.funcao);
        if (fnNova.erro) return json({ erro: fnNova.erro }, 400);
        identNova = identidadeInterna(corpo.eh_admin, fnNova.funcao);
        if (identNova.erro) return json({ erro: identNova.erro }, 400);
        delete patch.papel;
        patch.eh_admin = identNova.ehAdmin; patch.funcao = identNova.funcao;
        patch.funcao_personalizada = identNova.funcao ? fnNova.personalizada : null;
        if (corpo.secundarias !== undefined) {
          secNovas = await normalizarSecundarias(sb, corpo.secundarias);
          if (secNovas.erro) return json({ erro: secNovas.erro }, 400);
        }
        if (corpo.perfil_id === autor.id && !identNova.ehAdmin) {
          return json({ erro: 'Você não pode alterar o próprio acesso de administrador.' }, 400);
        }
      } else if (corpo.tipo === 'cliente') {
        patch.papel = 'cliente';
      }
      let excecoesNovas: { lista: { modulo: string; efeito: string; nivel?: string | null }[]; erro?: string } | null = null;
      if (corpo.modulos !== undefined) {
        excecoesNovas = await normalizarExcecoes(sb, corpo.modulos);
        if (excecoesNovas.erro) return json({ erro: excecoesNovas.erro }, 400);
      }

      /* o admin não se desativa nem se rebaixa sozinho: seria a forma
         mais fácil de o sistema ficar sem nenhum administrador */
      if (corpo.perfil_id === autor.id &&
          (patch.papel && patch.papel !== 'admin' || patch.estado && patch.estado !== 'ativa')) {
        return json({ erro: 'Você não pode alterar o próprio acesso de administrador.' }, 400);
      }

      /* Funções extras: valida contra o papel FINAL (o que está sendo
         salvo agora, se mudou, senão o que a conta já tinha) — nunca
         contra o papel antigo, pra não aceitar "Cliente + Videomaker"
         de passagem numa troca de papel na mesma chamada. */
      let funcoesExtra: { lista: string[]; erro?: string } | null = null;
      if (corpo.funcoes_extra !== undefined) {
        let papelFinal = String(patch.papel || '');
        if (!papelFinal) {
          const { data: atual } = await sb.from('perfis').select('papel').eq('id', corpo.perfil_id).maybeSingle();
          papelFinal = atual?.papel || '';
        }
        funcoesExtra = normalizarFuncoesExtra(corpo.funcoes_extra, papelFinal);
        if (funcoesExtra.erro) return json({ erro: funcoesExtra.erro }, 400);
      }

      if (Object.keys(patch).length) {
        const { error: ePatch } = await sb.from('perfis').update(patch).eq('id', corpo.perfil_id);
        if (ePatch) return json({ erro: 'Não foi possível salvar a conta: ' + ePatch.message }, 400);
      }
      /* exceções de módulo: substitui o conjunto inteiro; {} = voltar ao
         padrão da função. Cliente e administrador não guardam exceção. */
      if (excecoesNovas || corpo.tipo === 'cliente' || (identNova && identNova.ehAdmin)) {
        const limpar = corpo.tipo === 'cliente' || (identNova && identNova.ehAdmin);
        await gravarExcecoes(sb, corpo.perfil_id, limpar ? [] : (excecoesNovas ? excecoesNovas.lista : []), autor.id);
      }
      if (secNovas || corpo.tipo === 'cliente' || (identNova && identNova.ehAdmin)) {
        const limparSec = corpo.tipo === 'cliente' || (identNova && identNova.ehAdmin);
        await gravarSecundarias(sb, corpo.perfil_id, limparSec ? [] : (secNovas ? secNovas.lista : []), autor.id);
      }

      /* vínculos com empresas, quando enviados */
      /* zzz261: cada empresa leva o papel da pessoa nela (dono, gestor,
         equipe); quem não manda papel mantém o que já tinha */
      if (Array.isArray(corpo.empresas)) {
        const { data: antes } = await sb.from('perfil_clientes').select('client_id, papel, convidado_por').eq('perfil_id', corpo.perfil_id);
        const velho = new Map((antes || []).map((v: { client_id: string }) => [v.client_id, v]));
        const novas = normEmpresas(corpo.empresas, corpo.papel_cliente, true).map((e) => {
          const v = velho.get(e.client_id) as { papel: string; convidado_por: string | null } | undefined;
          return { perfil_id: corpo.perfil_id, client_id: e.client_id, papel: e.papel || (v && v.papel) || 'gestor',
                   convidado_por: v ? v.convidado_por : null };
        });
        await sb.from('perfil_clientes').delete().eq('perfil_id', corpo.perfil_id);
        if (novas.length) await sb.from('perfil_clientes').insert(novas);
      }

      /* funções extras, quando enviadas (substitui o conjunto inteiro,
         mesmo padrão de perfil_clientes acima) */
      if (funcoesExtra && !identNova) {
        await sb.from('perfis_funcoes_extra').delete().eq('perfil_id', corpo.perfil_id);
        if (funcoesExtra.lista.length) {
          await sb.from('perfis_funcoes_extra').insert(
            funcoesExtra.lista.map((f) => ({ perfil_id: corpo.perfil_id, funcao: f, criado_por: autor.id })));
        }
      }

      if (patch.estado && patch.estado !== 'ativa') {
        await sb.auth.admin.signOut(corpo.perfil_id, 'global').catch(() => {});
      }

      await auditar(sb, autor, 'alterar_conta',
        { tipo: 'perfil', id: corpo.perfil_id },
        { ...patch, funcoes_extra: funcoesExtra?.lista, excecoes: excecoesNovas ? excecoesNovas.lista : undefined,
          acesso: { antes: antesAcesso, depois: await fotoAcesso(sb, String(corpo.perfil_id)) } });
      return json({ ok: true });
    }

    /* Padrão de módulos de UMA função. Afeta todo mundo que tem essa
       função e não tem exceção para o módulo. Valida tudo antes de
       gravar; se a gravação nova falhar, repõe o conjunto anterior. */
    if (acao === 'salvar_preset') {
      const funcao = String(corpo.funcao || '');
      if (!FUNCOES_VALIDAS.includes(funcao)) return json({ erro: 'Função inválida.' }, 400);
      /* aceita a lista antiga (tudo Total) ou { modulo: 'ver' | 'editar' | 'total' } (zzz215) */
      const bruto = corpo.modulos;
      if (!bruto || typeof bruto !== 'object') return json({ erro: 'Lista de módulos inválida.' }, 400);
      const { data: mods } = await sb.from('modulos').select('id');
      const validos = new Set((mods || []).map((m: { id: string }) => m.id));
      const pares: [string, string][] = Array.isArray(bruto)
        ? [...new Set((bruto as unknown[]).map((m) => String(m)))].map((m) => [m, 'total'])
        : Object.entries(bruto as Record<string, unknown>).map(([m, n]) => [m, String(n)]);
      for (const [m, n] of pares) {
        if (!validos.has(m)) return json({ erro: 'Módulo inválido: ' + m + '.' }, 400);
        if (!NIVEIS.includes(n)) return json({ erro: 'Nível inválido em ' + m + '.' }, 400);
      }
      const lista = pares.map(([m]) => m);

      const { data: antes } = await sb.from('funcao_modulos').select('modulo, nivel').eq('funcao', funcao);
      const antesObj = Object.fromEntries((antes || []).map((a: { modulo: string; nivel: string }) => [a.modulo, a.nivel || 'total']));
      const { error: eDel } = await sb.from('funcao_modulos').delete().eq('funcao', funcao);
      if (eDel) return json({ erro: 'Não foi possível salvar o padrão: ' + eDel.message }, 500);
      if (lista.length) {
        const { error: eIns } = await sb.from('funcao_modulos').insert(pares.map(([m, n]) => ({ funcao, modulo: m, nivel: n })));
        if (eIns) {
          if (antes && antes.length) {
            await sb.from('funcao_modulos').insert(antes.map((a: { modulo: string; nivel: string }) => ({ funcao, modulo: a.modulo, nivel: a.nivel || 'total' })));
          }
          return json({ erro: 'Não foi possível salvar o padrão: ' + eIns.message }, 500);
        }
      }
      await auditar(sb, autor, 'salvar_preset', { tipo: 'funcao', id: null, descricao: funcao }, { modulos: Object.fromEntries(pares), antes: antesObj, depois: Object.fromEntries(pares) });
      return json({ ok: true, funcao, modulos: lista });
    }

    if (acao === 'listar_usuarios') {
      /* Pedir colunas nomeadas quebra a lista inteira quando uma delas
         ainda não existe no banco — foi o que aconteceu com avatar_url
         antes do migration_portal.sql. Com `*`, cada instalação devolve
         o que tem, e a interface lida com o que faltar. Nenhuma coluna
         de perfis contém senha ou hash. */
      const { data, error } = await sb.from('perfis')
        .select('*')
        .neq('estado', 'removida')
        .order('created_at', { ascending: true });
      if (error) {
        return json({ erro: 'Não foi possível ler as contas: ' + error.message,
                      codigo: 'leitura_perfis' }, 500);
      }
      const { data: vinculos } = await sb.from('perfil_clientes')
        .select('perfil_id, client_id, papel, clientes(nome)');
      /* funções extras: tabela pode não existir ainda numa instalação
         que não rodou migration_video_producao.sql — falha em silêncio
         pra não derrubar a listagem inteira por causa de um recurso
         opcional/novo (mesmo espírito do try/catch de avatar_url acima). */
      let funcoesExtra: unknown[] = [];
      try {
        const { data } = await sb.from('perfis_funcoes_extra').select('perfil_id, funcao');
        funcoesExtra = data || [];
      } catch (_e) { /* tabela ainda não existe — segue sem funções extras */ }
      /* zzz68: registro de módulos, padrões por função e exceções por usuário */
      const [{ data: modulos }, { data: presets }, { data: excecoes }] = await Promise.all([
        sb.from('modulos').select('id, rotulo, ordem').order('ordem'),
        sb.from('funcao_modulos').select('funcao, modulo, nivel'),
        sb.from('perfil_modulos').select('perfil_id, modulo, efeito, nivel')
      ]);
      /* zzz216: funções personalizadas e secundárias (tabelas novas: falha em silêncio) */
      let personalizadas: unknown[] = [], secundarias: unknown[] = [];
      try {
        const [{ data: fp }, { data: sc }] = await Promise.all([
          sb.from('funcoes_personalizadas').select('id, rotulo, descricao, base').order('rotulo'),
          sb.from('perfil_funcoes_secundarias').select('perfil_id, funcao, nivel_max')
        ]);
        personalizadas = fp || []; secundarias = sc || [];
      } catch (_e) { /* segue sem */ }
      return json({ usuarios: data || [], vinculos: vinculos || [], funcoes_extra: funcoesExtra,
                    modulos: modulos || [], presets: presets || [], excecoes: excecoes || [],
                    personalizadas, secundarias });
    }

  } catch (e) {
    /* Mensagem genérica escondia a causa e travava a instalação. O detalhe
       técnico ajuda quem está configurando e não expõe dado de usuário:
       são erros de banco ou de chamada, nunca conteúdo de conta. */
    /* o detalhe técnico fica só no log da função: a resposta não expõe
       mensagem de banco/biblioteca a quem chamou */
    const detalhe = e instanceof Error ? e.message : String(e);
    console.error('b7-auth:', String(acao || '(vazia)'), detalhe);
    return json({
      erro: 'Falha ao processar a solicitação.',
      acao: acao || '(vazia)'
    }, 500);
  }
}));

/* Cria a identidade no Auth e o perfil público. Se o perfil falhar, a
   identidade é removida — não deixamos um usuário do Auth sem perfil,
   que seria um login capaz de entrar sem papel nenhum. */
async function criarConta(sb: any, dados: {
  username: string; nome: string; senha: string; papel: string;
  podeAprovar?: boolean; empresas?: { client_id: string; papel?: string | null }[]; criadoPor?: string; convidadoPor?: string;
}) {
  const { data: existente } = await sb.rpc('resolver_login', { p_username: dados.username });
  if (existente && existente.length) return { erro: 'Esse username já está em uso.' };

  const id = crypto.randomUUID();
  const { data: criado, error } = await sb.auth.admin.createUser({
    id,
    email: identidadeTecnica(id),
    password: dados.senha,
    email_confirm: true,            /* não há caixa de e-mail para confirmar */
    app_metadata: { papel: dados.papel, username: dados.username }
  });
  if (error || !criado.user) {
    return { erro: 'Não foi possível criar a identidade de acesso.' };
  }

  const { error: erroPerfil } = await sb.from('perfis').insert([{
    id: criado.user.id,
    username: dados.username,
    nome: dados.nome,
    papel: dados.papel,
    pode_aprovar: dados.papel === 'cliente' ? !!dados.podeAprovar : false,
    /* cliente entra com a senha que recebeu e é convidado a trocá-la */
    senha_provisoria: dados.papel === 'cliente',
    criado_por: dados.criadoPor || null
  }]);
  if (erroPerfil) {
    await sb.auth.admin.deleteUser(criado.user.id).catch(() => {});
    return { erro: 'Não foi possível criar o perfil. Nada foi salvo.' };
  }

  if (dados.empresas && dados.empresas.length) {
    await sb.from('perfil_clientes').insert(
      dados.empresas.map(e => ({ perfil_id: criado.user.id, client_id: e.client_id, papel: e.papel || 'gestor',
                                 convidado_por: dados.convidadoPor || null })));
  }
  return { id: criado.user.id };
}

/* Empresas de uma conta de cliente: aceita ['id', …] (formato antigo) ou
   [{ client_id, papel }, …]. Papel fora de dono/gestor/equipe vira o
   padrão; com manterVazio, fica null (alterar_conta mantém o que havia). */
const PAPEIS_CLIENTE = ['dono', 'gestor', 'equipe'];
function normEmpresas(lista: unknown, padrao?: unknown, manterVazio = false): { client_id: string; papel: string | null }[] {
  if (!Array.isArray(lista)) return [];
  const pad = PAPEIS_CLIENTE.includes(String(padrao)) ? String(padrao) : (manterVazio ? null : 'gestor');
  const vistos = new Set<string>();
  const saida: { client_id: string; papel: string | null }[] = [];
  for (const item of lista) {
    const id = typeof item === 'string' ? item : String((item as { client_id?: string })?.client_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id) || vistos.has(id)) continue;
    vistos.add(id);
    const p = typeof item === 'object' && item ? String((item as { papel?: string }).papel || '') : '';
    saida.push({ client_id: id, papel: PAPEIS_CLIENTE.includes(p) ? p : pad });
  }
  return saida;
}

/* Senha provisória para convite: 12 caracteres sem os que se confundem
   (0/O, 1/l/I), com letras e números — passa em senhaFraca. */
function senhaProvisoria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ', nums = '23456789', todos = letras + nums;
  const r = crypto.getRandomValues(new Uint32Array(12));
  const s = Array.from(r, (n, i) => (i === 0 ? letras : i === 1 ? nums : todos)[n % (i === 0 ? letras.length : i === 1 ? nums.length : todos.length)]);
  return s.slice(2).concat(s.slice(0, 2)).join('');
}

/* Username a partir do nome: "Maria da Silva" → maria.silva (ou maria.silva2…) */
// deno-lint-ignore no-explicit-any
async function usernameLivre(sb: any, nome: string): Promise<string> {
  const partes = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((p) => p && !['da', 'de', 'do', 'das', 'dos', 'e'].includes(p));
  let base = (partes.length > 1 ? partes[0] + '.' + partes[partes.length - 1] : (partes[0] || 'cliente')).slice(0, 28);
  if (base.length < 3) base = (base + '.b7').slice(0, 28);
  for (let i = 0; i < 50; i++) {
    const tentativa = i === 0 ? base : base + (i + 1);
    const { data } = await sb.rpc('resolver_login', { p_username: tentativa });
    if (!data || !data.length) return tentativa;
  }
  return base + '.' + crypto.randomUUID().slice(0, 4);
}
