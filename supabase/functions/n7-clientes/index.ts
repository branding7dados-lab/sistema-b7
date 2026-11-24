// =====================================================================
// n7-clientes (4.89.0) — puxar o cadastro dos clientes do Núcleo 7.
//
// Só LÊ o Núcleo 7 (tabela clients), pelo mesmo canal da n7-sync:
//   N7_URL / N7_SERVICE_KEY (segredos do Supabase do B7 — nunca no código,
//   nunca na resposta, nunca no log).
// Quem pede é conferido no banco do B7 com o login da própria pessoa
// (cliente_cadastro_pode_puxar): um por vez = quem edita o cliente;
// todos de uma vez = administrador (inclui o Financeiro).
// Gravar no B7 NÃO é feito aqui: a tela grava pelo cliente_cadastro_salvar,
// com as validações de sempre e o login da pessoa.
//
// Ações:
//   { acao: 'buscar', cliente_id, n7_id? }  → casamento + proposta de um cliente
//   { acao: 'procurar', termo }             → clientes do Núcleo 7 pelo nome (escolher à mão)
//   { acao: 'todos' }                       → casamento + campos vazios de todos os clientes ativos
// Desenho: docs/superpowers/specs/2026-11-23-nucleo7-ligacao-design.md
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { comCors } from '../_shared/cors.ts';
import { sistemasDe } from '../_shared/sistemas-n7.ts';
import { COLUNAS_N7, colunaQueFalta, limpar, casar, buscar, proposta, corpoSalvar, resumo, type ClienteN7, type CadastroB7 } from '../_shared/n7-clientes.ts';

const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });
const SEM_CANAL = 'A ligação com o Núcleo 7 não está configurada no servidor do B7 (faltam os segredos N7_URL e N7_SERVICE_KEY).';

/* todos os clientes do Núcleo 7, só as colunas da lista; lido uma vez por pedido */
async function lerN7(): Promise<ClienteN7[]> {
  const base = (Deno.env.get('N7_URL') || '').replace(/\/$/, ''), chave = Deno.env.get('N7_SERVICE_KEY') || '';
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(base) || !chave) throw new Error(SEM_CANAL);
  const h = { apikey: chave, Authorization: 'Bearer ' + chave };
  const out: ClienteN7[] = [];
  let colunas = COLUNAS_N7.split(',');
  for (let de = 0; de < 20000; de += 1000) {
    const r = await fetch(base + '/rest/v1/clients?select=' + colunas.join(',') + '&order=name.asc', { headers: { ...h, Range: de + '-' + (de + 999), 'Range-Unit': 'items' } });
    if (!r.ok && r.status !== 206) {
      const corpo = (await r.text()).slice(0, 400);   // mensagem do PostgREST: nunca traz a chave
      /* 4.91.1: coluna que não existe no Núcleo 7 → segue sem ela (o campo vem vazio) */
      const falta = r.status === 400 ? colunaQueFalta(corpo, colunas) : null;
      if (falta) { console.warn('n7-clientes: coluna ausente no Núcleo 7, lendo sem ela:', falta); colunas = colunas.filter(c => c !== falta); de -= 1000; continue; }
      console.error('n7-clientes: Núcleo 7 respondeu', r.status, corpo);
      throw new Error('O Núcleo 7 não respondeu agora (' + r.status + '). Tente de novo em instantes.');
    }
    const linhas = await r.json();
    if (!Array.isArray(linhas)) break;
    for (const l of linhas) out.push(limpar(l));
    if (linhas.length < 1000) break;
  }
  return out;
}

Deno.serve(comCors(async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const cab = req.headers.get('authorization') || '';
  if (!cab.startsWith('Bearer ')) return json({ erro: 'Entre no B7 para puxar do Núcleo 7.' }, 401);
  /* o banco do B7 como a PRÓPRIA pessoa: as regras de acesso valem */
  const eu = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: cab } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: pode, error: ePode } = await eu.rpc('cliente_cadastro_pode_puxar');
  if (ePode || !pode) return json({ erro: 'Entre no B7 para puxar do Núcleo 7.' }, 401);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch (_e) { /* corpo vazio */ }
  const acao = String(corpo.acao || '');

  try {
    if (acao === 'buscar') {
      if (!pode.um) return json({ erro: 'Seu acesso não deixa editar o cadastro deste cliente.' }, 403);
      const id = String(corpo.cliente_id || '');
      const { data: cad, error } = await eu.rpc('cliente_cadastro', { p_cliente: id });
      if (error || !cad) return json({ erro: (error && error.message) || 'Cliente não encontrado.' }, 404);
      const lista = await lerN7();
      const escolhido = corpo.n7_id ? lista.find(x => x.id === String(corpo.n7_id)) : null;
      const r = escolhido ? { tipo: 'ligado' as const, cliente: escolhido } : casar({ nome: cad.cliente.nome, n7_id: cad.interno?.n7_cliente_id }, lista);
      if (r.tipo === 'nenhum') return json({ tipo: 'nenhum' });
      if (r.tipo === 'escolher') return json({ tipo: 'escolher', candidatos: r.candidatos.map(resumo) });
      const campos = proposta(cad as CadastroB7, r.cliente);
      return json({ tipo: r.tipo, n7: resumo(r.cliente), campos, ligado: cad.interno?.n7_cliente_id || null });
    }

    /* 4.90.0: a equipe do Núcleo 7 (nome e e-mail), para ligar as contas do B7 pelo nome.
       Só o administrador pleno (Pessoas e acessos é dele). Nada além de nome, e-mail e se está ativo. */
    /* 4.91.0: quais sistemas da casa a pessoa logada tem (para mostrar a Central dentro do B7).
       Acha a conta do Núcleo 7 pelo e-mail que a própria pessoa tem no B7 (perfis_email: cada um lê o seu).
       Devolve só os nomes dos sistemas; nada mais da conta de lá. Sem e-mail ou sem conta lá: lista vazia. */
    if (acao === 'meus_sistemas') {
      const central = (Deno.env.get('N7_CENTRAL_URL') || 'https://adm.nucleosete.com.br/central').trim();
      const { data: u } = await eu.auth.getUser();
      const { data: meu } = u?.user ? await eu.from('perfis_email').select('email').eq('perfil_id', u.user.id).maybeSingle() : { data: null };
      if (!meu?.email) return json({ sistemas: [], central });
      const base = (Deno.env.get('N7_URL') || '').replace(/\/$/, ''), chave = Deno.env.get('N7_SERVICE_KEY') || '';
      if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(base) || !chave) return json({ sistemas: [], central });
      const r = await fetch(base + '/rest/v1/app_users?select=is_active,is_super_admin,screen_permissions&email=eq.' + encodeURIComponent(meu.email) + '&limit=1',
        { headers: { apikey: chave, Authorization: 'Bearer ' + chave } });
      if (!r.ok) { console.error('n7-clientes: meus_sistemas respondeu', r.status); return json({ sistemas: [], central }); }
      const linhas = await r.json();
      return json({ sistemas: sistemasDe(Array.isArray(linhas) ? linhas[0] || null : null), central });
    }

    if (acao === 'equipe') {
      const { data: pleno } = await eu.rpc('sou_admin_pleno');
      if (pleno !== true) return json({ erro: 'Ligar as contas é do administrador.' }, 403);
      const base = (Deno.env.get('N7_URL') || '').replace(/\/$/, ''), chave = Deno.env.get('N7_SERVICE_KEY') || '';
      if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(base) || !chave) throw new Error(SEM_CANAL);
      const r = await fetch(base + '/rest/v1/app_users?select=name,email,is_active&order=name.asc', { headers: { apikey: chave, Authorization: 'Bearer ' + chave } });
      if (!r.ok) { console.error('n7-clientes: equipe respondeu', r.status, (await r.text()).slice(0, 400)); throw new Error('O Núcleo 7 não respondeu agora (' + r.status + '). Tente de novo em instantes.'); }
      const linhas = await r.json();
      const equipe = (Array.isArray(linhas) ? linhas : []).map((l: any) => ({ nome: String(l?.name || '').trim().slice(0, 160), email: String(l?.email || '').trim().toLowerCase().slice(0, 160), ativo: l?.is_active !== false }))
        .filter((x: any) => x.nome && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x.email));
      return json({ equipe });
    }

    if (acao === 'procurar') {
      if (!pode.um) return json({ erro: 'Seu acesso não deixa editar o cadastro deste cliente.' }, 403);
      const lista = await lerN7();
      return json({ clientes: buscar(String(corpo.termo || ''), lista).map(resumo) });
    }

    if (acao === 'todos') {
      if (!pode.todos) return json({ erro: 'Puxar todos de uma vez é do administrador.' }, 403);
      /* os clientes ativos do B7, lidos como a própria pessoa */
      const { data: cli, error } = await eu.from('clientes').select('id, nome, servico, teste, deleted_at').is('deleted_at', null).order('nome');
      if (error) return json({ erro: error.message }, 500);
      const ativos = (cli || []).filter((c: any) => (c.servico || 'ativo') === 'ativo' && !c.teste);
      const lista = await lerN7();
      const achados: unknown[] = [], escolher: unknown[] = [], nenhum: unknown[] = [], erros: unknown[] = [];
      let completos = 0;
      for (const c of ativos) {
        const { data: cad } = await eu.rpc('cliente_cadastro', { p_cliente: c.id });
        if (!cad) { erros.push({ id: c.id, nome: c.nome }); continue; }
        const r = casar({ nome: c.nome, n7_id: cad.interno?.n7_cliente_id }, lista);
        if (r.tipo === 'nenhum') { nenhum.push({ id: c.id, nome: c.nome }); continue; }
        if (r.tipo === 'escolher') { escolher.push({ id: c.id, nome: c.nome, candidatos: r.candidatos.length }); continue; }
        /* todos de uma vez: SÓ os campos vazios no B7 */
        const vazios = proposta(cad as CadastroB7, r.cliente).filter(x => x.vazio);
        if (!vazios.length && cad.interno?.n7_cliente_id) { completos++; continue; }
        achados.push({ id: c.id, nome: c.nome, n7: resumo(r.cliente), campos: vazios.map(x => x.rotulo), dados: corpoSalvar(vazios, r.cliente.id) });
      }
      return json({ achados, escolher, nenhum, erros, completos, total: ativos.length });
    }

    return json({ erro: 'Ação desconhecida.' }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === SEM_CANAL) return json({ erro: SEM_CANAL, sem_canal: true }, 503);
    console.error('n7-clientes:', acao, msg);
    return json({ erro: msg.startsWith('O Núcleo 7') ? msg : 'Não foi possível falar com o Núcleo 7 agora.' }, 502);
  }
}));
