/* =====================================================================
   OTTO · PDF COM O DESIGN DO B7 (4.58.0)
   Kevin: "não pode modificar o design do roteiro — tem que ser o mesmo que
   a gente usa hoje". O servidor não tem navegador para desenhar a ficha;
   então o Otto deixa um pedido em wa_pdf_pedidos e QUALQUER B7 aberto da
   equipe (programa do PC ou navegador, de quem vê o WhatsApp do B7) pega o
   pedido em segundo plano, gera o PDF com o MESMO código do botão
   "Baixar" (B7.Export.gerarPDF / B7.BaixarLinha.gerar), sobe o arquivo e
   pede para a wa-evolution mandar no WhatsApp. Ninguém vê nada na tela.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.OttoPDF = (function () {
  const sb = () => B7.sb;
  let canal = null, ocupado = false, ligado = false, podeVer = null;

  async function pode() {
    if (podeVer !== null) return podeVer;
    try { const r = await sb().rpc('pode_ver_wa'); podeVer = !!r.data; } catch (e) { podeVer = false; }
    return podeVer;
  }

  async function ctxRoteiros(gravacaoId) {
    const g = await B7.DB.gravacao(gravacaoId);
    const roteiros = await B7.DB.listarRoteiros(gravacaoId);
    const cenas = await B7.DB.listarCenasDaGravacao(roteiros.map(r => r.id));
    const porRoteiro = {};
    roteiros.forEach(r => { porRoteiro[r.id] = cenas.filter(c => c.script_id === r.id).sort((a, b) => a.position - b.position); });
    return {
      ctx: { cliente: g.cliente_nome, semCliente: !!g.geral, clienteLogo: g.cliente_logo_url || null, clienteId: g.client_id,
        gravacao: g.nome, gravacaoId: g.id, dataGravacao: g.data_gravacao ? B7.UI.dataBR(g.data_gravacao) : '', roteiros, cenasPorRoteiro: porRoteiro },
      nome: B7.Export.nomeArquivo([g.cliente_nome, g.nome, 'ROTEIROS'], 'pdf')
    };
  }

  async function gerar(p) {
    if (p.tipo === 'roteiros') {
      const { ctx, nome } = await ctxRoteiros(p.ref_id);
      if (!ctx.roteiros.length) throw new Error('A gravação não tem roteiros.');
      /* igual ao "Baixar" da tela: todos os roteiros, sem a folha de abertura (opção desmarcada por padrão) */
      const blob = await B7.Export.gerarPDF(ctx, ctx.roteiros.map(r => r.id), false, nome, null, { blob: true });
      return { blob, nome };
    }
    if (p.tipo === 'linha') {
      if (B7.Areas) await B7.Areas.carregar(['slides', 'printLinha']);
      const ctx = await B7.BaixarLinha.reunir(p.ref_id, {});
      const r = await B7.BaixarLinha.gerar(ctx, 'a4', null, { blob: true });
      return { blob: r.blob, nome: r.nome };
    }
    throw new Error('Tipo de documento desconhecido.');
  }

  async function atender(p) {
    if (ocupado || !p || p.status !== 'aguardando') return;
    const eu = B7.Auth && B7.Auth.usuario && B7.Auth.usuario();
    if (!eu) return;
    /* pega o pedido (só um B7 consegue) */
    const { data: peguei } = await sb().from('wa_pdf_pedidos').update({ status: 'gerando', pego_por: eu.id, atualizado_em: new Date().toISOString() })
      .eq('id', p.id).eq('status', 'aguardando').select('id');
    if (!peguei || !peguei.length) return;
    ocupado = true;
    try {
      const { blob, nome } = await gerar(p);
      const path = 'envio/otto/' + p.id + '.pdf';
      const up = await sb().storage.from('wa-midia').upload(path, blob, { contentType: 'application/pdf', upsert: false });
      if (up.error) throw new Error('Não subiu o PDF: ' + up.error.message);
      await sb().from('wa_pdf_pedidos').update({ status: 'pronto', path, nome, atualizado_em: new Date().toISOString() }).eq('id', p.id);
      await B7.DB.waEvolution('otto_pdf_enviar', { id: p.id });
    } catch (e) {
      await sb().from('wa_pdf_pedidos').update({ status: 'erro', erro: String(e && e.message || e).slice(0, 300), atualizado_em: new Date().toISOString() }).eq('id', p.id);
      B7.DB.waEvolution('otto_pdf_enviar', { id: p.id }).catch(() => {});   /* avisa no WhatsApp que não deu */
    } finally { ocupado = false; setTimeout(varrer, 500); }
  }

  /* pedidos que chegaram enquanto este B7 estava fechado */
  async function varrer() {
    if (ocupado) return;
    const desde = new Date(Date.now() - 6 * 3600e3).toISOString();
    const { data } = await sb().from('wa_pdf_pedidos').select('*').eq('status', 'aguardando').gte('criado_em', desde).order('criado_em').limit(3);
    for (const p of data || []) { await atender(p); if (ocupado) break; }
  }

  async function ligar() {
    if (ligado || !B7.sb || !B7.Auth || !B7.Auth.usuario || !B7.Auth.usuario()) return;
    if (B7.Auth.ehCliente && B7.Auth.ehCliente()) return;
    if (!(await pode())) return;
    ligado = true;
    try {
      canal = sb().channel('otto-pdf-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_pdf_pedidos' }, ev => { setTimeout(() => atender(ev.new), Math.random() * 800); })
        .subscribe();
    } catch (e) { /* sem tempo real: a varredura cobre */ }
    varrer();
    setInterval(varrer, 45000);
  }
  /* liga sozinho depois que o sistema abre e a pessoa entrou */
  setTimeout(function tentar() { if (B7.Auth && B7.Auth.usuario && B7.Auth.usuario()) ligar(); else setTimeout(tentar, 5000); }, 6000);

  return { ligar, varrer };
})();
