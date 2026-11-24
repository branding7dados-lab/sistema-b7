/* 4.89.0: puxar o cadastro dos clientes do Núcleo 7 — peças puras (supabase/functions/_shared/n7-clientes.ts).
   Rodar com: node --experimental-strip-types --no-warnings testes/n7-clientes.test.mjs */
import { colunaQueFalta, limpar, normalizar, casar, buscar, duracaoDe, proposta, corpoSalvar, resumo, COLUNAS_N7 } from '../supabase/functions/_shared/n7-clientes.ts';

let falhas = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) falhas++; };

/* um cliente do Núcleo 7 cheio de coisa que NÃO pode sair */
const CRU = {
  id: 'n1', name: 'Mercato Sadia', status: 'ativo', cnpj: '12.345.678/0001-90', area_atuacao: '', segmento: 'Varejo',
  audience_location: 'Bahia inteira', instagram: '@mercato.sadia', website: 'mercato.com.br', logo_url: 'https://cdn.n7/logo.png',
  contract_months: 5, contract_start_date: '2026-03-01T00:00:00Z', observations: 'Prometemos 2 gravações por mês',
  holder_name: 'Dona Ana (antigo)',
  dados_contratuais: { responsavel_cargo: 'Gerente', responsavel_email: 'velho@x.com', responsavel_whatsapp: '11999990000', valor: 5000, senha_banco: 'x' },
  branding: { address: { city: 'Vitória da Conquista', state: 'BA', cep: '45000' }, responsavel: { name: 'Ana Souza', role: 'Dona', whatsapp: '(77) 99999-0000', email: 'Ana@Mercato.com' },
    accesses: [{ plataforma: 'instagram', senha: 'segredo' }], cores: ['#fff'] },
  product_value: 9000, payment_status: 'a_receber', mrr_value: 3000, installments: 6
};
const c = limpar(CRU);
const chaves = Object.keys(c).sort().join(',');
ok(chaves === 'cidade,cnpj,combinado,id,inicio,instagram,logo,meses,nicho,nome,resp_cargo,resp_email,resp_nome,resp_whatsapp,site,situacao', 'limpar: só os campos do cadastro (' + chaves + ')');
const tudo = JSON.stringify(c);
ok(!/segredo|senha|5000|9000|3000|a_receber|accesses|valor|45000|velho@x\.com/.test(tudo), 'nada de acesso, senha, valor ou pagamento sai do Núcleo 7');
ok(c.cidade === 'Vitória da Conquista - BA', 'cidade vem do endereço do cliente, não do "público" (' + c.cidade + ')');
ok(limpar({ audience_location: 'Salvador - BA' }).cidade === 'Salvador - BA', 'sem endereço, a cidade vem da tela interna');
ok(c.resp_nome === 'Ana Souza' && c.resp_cargo === 'Dona' && c.resp_email === 'Ana@Mercato.com', 'responsável vem do formulário do cliente primeiro');
const so = limpar({ holder_name: 'Beto', dados_contratuais: { responsavel_cargo: 'Sócio', responsavel_whatsapp: '7733334444' } });
ok(so.resp_nome === 'Beto' && so.resp_cargo === 'Sócio' && so.resp_whatsapp === '7733334444', 'sem o formulário, o responsável vem da tela interna');
ok(c.nicho === 'Varejo' && c.meses === 5, 'área de atuação cai no segmento quando vazia; meses lido');
ok(limpar({ branding: 'lixo', dados_contratuais: null }).resp_nome === '', 'campos estranhos não quebram');
ok(!/payment|product_value|mrr|installments|financial/.test(COLUNAS_N7), 'a lista de colunas pedidas não tem nada financeiro');

ok(normalizar('  MERCATO  Sadia. ') === 'mercato sadia' && normalizar('Mercató Sádia') === 'mercato sadia', 'normalizar: maiúsculas, acento, pontuação e espaços');

const L = [c, limpar({ id: 'n2', name: 'Padaria Sol', status: 'ativo' }), limpar({ id: 'n3', name: 'Padaria Sol ', status: 'pausa' }),
  limpar({ id: 'n4', name: 'Clínica Vida', status: 'cancelado' }), limpar({ id: 'n5', name: 'Clinica vida', status: 'ativo' }),
  limpar({ id: 'n6', name: 'Antiga', status: 'cancelado' })];
let r = casar({ nome: 'mercato sadia' }, L);
ok(r.tipo === 'achado' && r.cliente.id === 'n1', 'um só com o mesmo nome → achado');
r = casar({ nome: 'Padaria Sol' }, L);
ok(r.tipo === 'escolher' && r.candidatos.length === 2, 'dois com o mesmo nome → escolher (pausado também conta)');
r = casar({ nome: 'Clínica Vida' }, L);
ok(r.tipo === 'achado' && r.cliente.id === 'n5', 'cancelado não atrapalha o ativo de mesmo nome');
r = casar({ nome: 'Antiga' }, L);
ok(r.tipo === 'achado' && r.cliente.id === 'n6', 'cancelado sozinho ainda é achado');
r = casar({ nome: 'Padaria Sol', n7_id: 'n3' }, L);
ok(r.tipo === 'ligado' && r.cliente.id === 'n3', 'vínculo guardado vale mais que o nome');
r = casar({ nome: 'Mercato Sadia', n7_id: 'sumiu' }, L);
ok(r.tipo === 'achado', 'vínculo para um cliente que não existe mais: volta a casar pelo nome');
ok(casar({ nome: 'Ninguém' }, L).tipo === 'nenhum' && casar({ nome: '' }, L).tipo === 'nenhum', 'sem ninguém → nenhum');
ok(buscar('padar', L).length === 2 && buscar('a', L).length === 0, 'busca por parte do nome (2+ letras)');
ok(JSON.stringify(Object.keys(resumo(c))) === '["id","nome","situacao","cnpj","cidade"]', 'resumo para escolher: nome, situação, CNPJ e cidade');

ok([duracaoDe(0), duracaoDe(null), duracaoDe(1), duracaoDe(2), duracaoDe(3), duracaoDe(5), duracaoDe(6), duracaoDe(7), duracaoDe(24)].join() === ',,1,3,3,6,6,12,12', 'duração: 1 / 2–3 / 4–6 / 7+');

/* proposta: B7 vazio */
const VAZIO = { cliente: { contrato: 'mensal', logo_url: null }, interno: {}, perfil: {} };
let p = proposta(VAZIO, c);
const nomes = p.map(x => x.campo).join(',');
ok(nomes === 'cnpj,nicho,cidade,instagram,site,logo,inicio,meses,resp_nome,resp_cargo,resp_whatsapp,resp_email,combinado', 'B7 vazio: todos os campos preenchidos lá entram (' + nomes + ')');
ok(p.every(x => x.vazio), 'e todos marcados como "vazio no B7"');
const V = k => (p.find(x => x.campo === k) || {}).n7;
ok(V('cnpj') === '12345678000190' && V('instagram') === 'mercato.sadia' && V('resp_whatsapp') === '77999990000' && V('resp_email') === 'ana@mercato.com', 'valores no formato do B7 (só números, sem @, e-mail minúsculo)');
ok(V('meses') === '6' && V('inicio') === '2026-03-01', '5 meses vira 6 meses; data sem a hora');
/* proposta: B7 com coisas */
const CHEIO = { cliente: { contrato: 'mensal', logo_url: 'https://b7/logo.png' }, interno: { cnpj: '12345678000190', cidade: 'Salvador - BA', resp_whatsapp: '(77) 99999-0000' }, perfil: { nicho: 'varejo', site: '' } };
p = proposta(CHEIO, c);
ok(!p.some(x => x.campo === 'cnpj') && !p.some(x => x.campo === 'resp_whatsapp'), 'igual nos dois (mesmo com máscara diferente) não aparece');
ok(!p.some(x => x.campo === 'nicho'), 'igual ignorando maiúsculas não aparece');
ok(!p.some(x => x.campo === 'logo'), 'B7 com logo: a logo do Núcleo 7 não entra');
const cid = p.find(x => x.campo === 'cidade');
ok(cid && !cid.vazio && cid.b7 === 'Salvador - BA' && cid.n7 === 'Vitória da Conquista - BA', 'diferente nos dois: aparece, com os dois valores, e não é "vazio"');
ok(p.find(x => x.campo === 'site').vazio && p.find(x => x.campo === 'site').n7 === 'https://mercato.com.br', 'vazio no B7 continua "vazio"; o site vem com https:// como o B7 guarda');
ok(!proposta({ cliente: {}, interno: {}, perfil: { site: 'https://www.mercato.com.br/' } }, c).some(x => x.campo === 'site'), 'site igual com e sem https/www não aparece como diferente');
ok(limpar({ branding: { address: { city: 'x'.repeat(120), state: 'y'.repeat(40) } } }).cidade.length === 160, 'cidade comprida é cortada em 160 (o limite do B7)');
/* regras que recusam */
const RUIM = limpar({ id: 'r', name: 'R', cnpj: '123', logo_url: 'http://inseguro/logo.png', contract_months: 0, branding: { responsavel: { whatsapp: '12345', email: 'semarroba' } } });
p = proposta(VAZIO, RUIM);
ok(!p.length, 'CNPJ curto, logo http, duração 0, telefone curto e e-mail sem @ não são trazidos (' + p.map(x => x.campo) + ')');
ok(!proposta({ cliente: { contrato: 'avulso' }, interno: {}, perfil: {} }, c).some(x => x.campo === 'meses'), 'cliente avulso no B7 não recebe duração');

/* corpo para salvar */
const corpo = corpoSalvar(proposta(VAZIO, c), 'n1');
ok(corpo.interno.n7_cliente_id === 'n1' && corpo.interno.contrato_meses === 6 && corpo.perfil.instagram === 'mercato.sadia' && corpo.logo_n7 === 'https://cdn.n7/logo.png', 'corpo do salvar: interno, perfil, logo e o vínculo');
ok(JSON.stringify(corpoSalvar([], 'n2')) === '{"interno":{"n7_cliente_id":"n2"}}', 'sem campos: só guarda o vínculo');

/* 4.91.1: coluna que não existe no Núcleo 7 (o 400 da AutoEscola Modelo) */
const COLS = COLUNAS_N7.split(',');
ok(colunaQueFalta('{"code":"42703","message":"column clients.dados_contratuais does not exist"}', COLS) === 'dados_contratuais', 'acha a coluna ausente na mensagem do Núcleo 7');
ok(colunaQueFalta('{"code":"42703","message":"column \\"segmento\\" does not exist"}', COLS) === 'segmento', 'aceita a coluna entre aspas');
ok(colunaQueFalta('{"message":"column clients.name does not exist"}', COLS) === null && colunaQueFalta('{"message":"column clients.id does not exist"}', COLS) === null, 'id e nome nunca são deixados de fora');
ok(colunaQueFalta('{"message":"column clients.senha does not exist"}', COLS) === null && colunaQueFalta('lixo', COLS) === null && colunaQueFalta('', COLS) === null, 'outra coluna ou erro qualquer não vira "falta"');

if (falhas) process.exit(1);
console.log('Núcleo 7 (regras): ok');
