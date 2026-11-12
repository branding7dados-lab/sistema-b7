// =====================================================================
// n7-sync (4.42.0) — envia as métricas e os contatos do site da Branding7
// para o banco do sistema N7 (Núcleo7), a cada 15 minutos (pg_cron).
//
// Regra combinada com o programador do N7: só escreve em tabelas novas
// com final "_b7" (lista fixa abaixo); nunca apaga nem altera nada do N7.
// Upsert pela chave: reenviar o mesmo dado só atualiza a linha _b7 dele.
//
// Segredos (Supabase da B7 → Edge Functions → Secrets), colocados pelo
// Kevin no painel — nunca no código nem no chat:
//   N7_URL          https://<projeto-do-n7>.supabase.co
//   N7_SERVICE_KEY  chave service_role do N7
// Tabelas do lado do N7: docs/integracao-n7/n7_tabelas_b7.sql
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const TABELAS = ['site_leads_b7', 'site_eventos_b7', 'site_metricas_dia_b7', 'site_origens_dia_b7', 'site_campanhas_dia_b7', 'site_resumo_b7'] as const;
const CHAVES: Record<string, string> = {
  site_leads_b7: 'id', site_eventos_b7: 'id', site_metricas_dia_b7: 'dia',
  site_origens_dia_b7: 'dia,fonte', site_campanhas_dia_b7: 'dia,campanha', site_resumo_b7: 'periodo_dias'
};
const H = { 'Content-Type': 'application/json' };
const resp = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: H });

Deno.serve(async () => {
  const n7 = (Deno.env.get('N7_URL') || '').replace(/\/$/, ''), n7k = Deno.env.get('N7_SERVICE_KEY') || '';
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(n7) || !n7k) return resp({ ok: false, erro: 'Faltam os segredos N7_URL e N7_SERVICE_KEY.' }, 200);
  const hN7 = { apikey: n7k, Authorization: 'Bearer ' + n7k, 'Content-Type': 'application/json' };

  async function lerN7(caminho: string) {
    const r = await fetch(n7 + '/rest/v1/' + caminho, { headers: hN7 });
    if (!r.ok) throw new Error('N7 respondeu ' + r.status + ' em ' + caminho.split('?')[0] + ': ' + (await r.text()).slice(0, 200));
    return r.json();
  }
  async function gravar(tabela: typeof TABELAS[number], linhas: Record<string, unknown>[]) {
    if (!TABELAS.includes(tabela) || !tabela.endsWith('_b7')) throw new Error('tabela fora da lista: ' + tabela);
    const agora = new Date().toISOString();
    for (let i = 0; i < linhas.length; i += 500) {
      const parte = linhas.slice(i, i + 500).map(l => ({ ...l, sincronizado_em: agora }));
      const r = await fetch(n7 + '/rest/v1/' + tabela + '?on_conflict=' + CHAVES[tabela], {
        method: 'POST', headers: { ...hN7, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(parte)
      });
      if (!r.ok) throw new Error('N7 recusou ' + tabela + ' (' + r.status + '): ' + (await r.text()).slice(0, 300));
    }
    return linhas.length;
  }

  try {
    /* onde parou: último evento já enviado e se é a primeira vez (manda tudo) */
    const [ult, temDia] = await Promise.all([
      lerN7('site_eventos_b7?select=id&order=id.desc&limit=1'),
      lerN7('site_metricas_dia_b7?select=dia&limit=1')
    ]);
    const evDepois = ult && ult[0] ? Number(ult[0].id) : 0;
    const primeira = !(temDia && temDia.length);
    /* refaz os últimos 3 dias (o dia de hoje muda a cada visita) */
    const desde = primeira ? null : new Date(Date.now() - 3 * 864e5).toISOString();

    const b7 = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: d, error } = await b7.rpc('_site_n7_dados', { p_desde: desde, p_ev_depois: evDepois, p_lim: 5000 });
    if (error) throw new Error('Falha ao montar os dados: ' + error.message);

    const feito = {
      site_eventos_b7: await gravar('site_eventos_b7', d.eventos || []),
      site_leads_b7: await gravar('site_leads_b7', d.leads || []),
      site_metricas_dia_b7: await gravar('site_metricas_dia_b7', d.metricas_dia || []),
      site_origens_dia_b7: await gravar('site_origens_dia_b7', d.origens_dia || []),
      site_campanhas_dia_b7: await gravar('site_campanhas_dia_b7', d.campanhas_dia || []),
      site_resumo_b7: await gravar('site_resumo_b7', d.resumo || [])
    };
    return resp({ ok: true, primeira, enviados: feito });
  } catch (e) {
    return resp({ ok: false, erro: String((e as Error).message || e) }, 200);
  }
});
