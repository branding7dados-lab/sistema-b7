/* =====================================================================
   B7.Eventos — CAMADA DE EVENTOS DO CALENDÁRIO B7 (fase 6)

   O Calendário NÃO é dono de dado nenhum. Cada domínio continua dono
   do que é seu; aqui só LEMOS os registros canônicos de uma janela de
   datas e os normalizamos num formato único de evento, que o
   Calendário (e, aos poucos, o Painel) desenha. Nada é gravado.

   Fontes canônicas (uma consulta por domínio, em paralelo, por janela):
     gravacao   → gravacoes_ocorrencias (calendario_ocorrencias_resumo):
                  a data FÍSICA de cada ocorrência — a atual e as
                  antigas (remarcada/cancelada) do histórico.
     google     → eventos do Google ainda sem gravação vinculada
                  (calendario_eventos_resumo) — só para gestores; é a
                  integração que já existia, não uma expansão.
     publicacao → conteudos.data_postagem (Linha Editorial)
     video      → demandas_edicao.prazo (Produção de Vídeo)
     design     → design_demandas.prazo (Produção de Design)
     aprovacao  → NÃO entra: aprovações não têm prazo/data agendada
                  canônica (só enviado_em/decidido_em). Não inventamos.
     oportunidade → datas comemorativas/campanhas (fase 7, B7.Oportunidades):
                  camada INFORMATIVA opcional (ESTADO.oportunidades), só
                  lida quando a pessoa liga a camada no Calendário.

   Evento normalizado:
     { id (estável: '<dominio>:<id da fonte>'), dominio, fonteId,
       titulo, sub, clienteId, clienteNome, clienteLogo,
       dia 'AAAA-MM-DD' (dia LOCAL), hora 'HH:MM'|null, horaFim,
       diaInteiro, responsavelId, responsavelNome,
       status (chave do domínio), statusRotulo, tom ('azul'|'ambar'|
       'verde'|'vermelho'|'neutro'), cancelado, concluido, historico,
       href (destino canônico), extra {…} }

   Datas: data pura (AAAA-MM-DD) NUNCA passa por new Date(texto) —
   seria lida como UTC e "09/10" viraria "08/10". Instantes
   (timestamptz) viram dia/hora no fuso local do navegador.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Eventos = (function () {
  const pode = r => !(B7.Perm && B7.Perm.podeRota) || B7.Perm.podeRota(r);
  const papel = () => (B7.Auth && B7.Auth.papel && B7.Auth.papel()) || null;
  const souGestor = () => ['admin', 'coordenador'].includes(papel());

  /* ------------------------------------------------------------ datas */
  const pad = n => String(n).padStart(2, '0');
  const isoLocal = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  /* 'AAAA-MM-DD' → Date local à meia-noite (sem UTC) */
  const local = iso => { const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d); };
  const somarDias = (iso, n) => { const d = local(iso); d.setDate(d.getDate() + n); return isoLocal(d); };
  const hoje = () => isoLocal(new Date());
  const difDias = (a, b) => Math.round((local(b) - local(a)) / 864e5);
  /* instante → dia e hora locais */
  const diaDoInstante = ts => isoLocal(new Date(ts));
  const horaDoInstante = ts => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  /* data pura vinda do banco (AAAA-MM-DD ou AAAA-MM-DDT…): só o texto */
  const diaPuro = v => v ? String(v).slice(0, 10) : null;
  const inicioSemana = iso => { const d = local(iso); d.setDate(d.getDate() - d.getDay()); return isoLocal(d); };
  const primeiroDoMes = iso => String(iso).slice(0, 8) + '01';
  const ultimoDoMes = iso => { const d = local(primeiroDoMes(iso)); d.setMonth(d.getMonth() + 1); d.setDate(0); return isoLocal(d); };
  const DATAS = { pad, isoLocal, local, somarDias, hoje, difDias, diaDoInstante, horaDoInstante, diaPuro, inicioSemana, primeiroDoMes, ultimoDoMes };

  /* ------------------------------------------------------------ domínios
     Rótulo, ícone e ordem — a mesma lista para filtros, legenda e
     agrupamento do dia. Cor fica no CSS (acento discreto por domínio). */
  const SVG = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const DOMINIOS = {
    gravacao:   { rot: 'Gravação',   plural: 'Gravações',   grupo: 'Gravações',   ordem: 1, ic: SVG('<rect x="3" y="6.5" width="12.5" height="11" rx="2.5"/><path d="M15.5 10.5l5-3v9l-5-3z"/>') },
    publicacao: { rot: 'Publicação', plural: 'Publicações', grupo: 'Publicações', ordem: 2, ic: SVG('<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8 9h8M8 12.5h8M8 16h5"/>') },
    video:      { rot: 'Vídeo',      plural: 'Vídeo',       grupo: 'Prazos de vídeo',  ordem: 3, ic: SVG('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M10 9.5v5l4.5-2.5z"/>') },
    design:     { rot: 'Design',     plural: 'Design',      grupo: 'Prazos de design', ordem: 4, ic: SVG('<path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16z"/><path d="M14 6l3 3"/>') },
    google:     { rot: 'Google',     plural: 'Agenda Google', grupo: 'Agenda Google (sem vínculo)', ordem: 5, ic: SVG('<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M8.5 3v3M15.5 3v3"/>') },
    oportunidade: { rot: 'Oportunidade', plural: 'Oportunidades', grupo: 'Oportunidades (datas comemorativas)', ordem: 6, ic: SVG('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>') }
  };
  /* filtro "tipo": Google cru mora junto de Gravações (é agenda de gravação) */
  const TIPO_DO_DOMINIO = { gravacao: 'gravacoes', google: 'gravacoes', publicacao: 'publicacoes', video: 'video', design: 'design' };
  const TIPOS = [
    { id: 'gravacoes', rot: 'Gravações', dominios: ['gravacao', 'google'] },
    { id: 'publicacoes', rot: 'Publicações', dominios: ['publicacao'] },
    { id: 'video', rot: 'Vídeo', dominios: ['video'] },
    { id: 'design', rot: 'Design', dominios: ['design'] }
  ];

  /* ---------------------------------------------------------- adaptadores
     Cada um: disponivel() (permissão de rota — o RLS do banco continua
     sendo a autoridade), carregar(ini, fim) → linhas cruas,
     normalizar(linha) → evento. */
  const SIT_OC = {
    marcada:   { rot: 'Marcada', tom: 'azul' },
    remarcada: { rot: 'Remarcada', tom: 'ambar' },
    concluida: { rot: 'Concluída', tom: 'verde' },
    cancelada: { rot: 'Cancelada', tom: 'vermelho' }
  };
  const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const VIDEO_ST = {
    pendente: ['Pendente', 'neutro'], em_edicao: ['Em edição', 'azul'], aguardando_aprovacao: ['Aguardando aprovação', 'ambar'],
    correcao: ['Correção', 'ambar'], standby: ['Stand-by', 'neutro'], entregue: ['Entregue', 'verde'], descartado: ['Descartado', 'vermelho']
  };
  const DESIGN_ST = {
    aguardando_producao: ['Aguardando produção', 'neutro'], em_criacao: ['Em criação', 'azul'], revisao_interna: ['Revisão interna', 'ambar'],
    ajustes: ['Ajustes', 'ambar'], aprovado_interno: ['Aprovado internamente', 'azul'], aguardando_cliente: ['Aguardando cliente', 'ambar'],
    ajustes_cliente: ['Ajustes do cliente', 'ambar'], aprovado_cliente: ['Aprovado pelo cliente', 'verde'], finalizado: ['Finalizado', 'verde']
  };

  const ADAPTADORES = {
    gravacao: {
      disponivel: () => pode('calendario') || pode('gravacoes'),
      carregar: (ini, fim) => B7.DB.ocorrenciasCalendario(local(ini).toISOString(), local(somarDias(fim, 1)).toISOString()),
      normalizar: o => {
        const s = SIT_OC[o.status] || SIT_OC.marcada;
        const semHora = !!o.sem_horario;
        return {
          id: 'gravacao:' + o.id, dominio: 'gravacao', fonteId: o.gravacao_id, ocorrenciaId: o.id,
          titulo: o.gravacao_nome || 'Gravação', clienteId: o.gravacao_client_id, clienteNome: o.gravacao_cliente_nome,
          clienteLogo: o.gravacao_cliente_logo_url,
          dia: diaDoInstante(o.inicio), hora: semHora ? null : horaDoInstante(o.inicio),
          horaFim: semHora || !o.fim || o.fim === o.inicio ? null : horaDoInstante(o.fim), diaInteiro: semHora,
          responsavelId: o.gravacao_videomaker_id || null, responsavelNome: null,
          status: o.status, statusRotulo: s.rot, tom: s.tom,
          cancelado: o.status === 'cancelada', concluido: o.status === 'concluida', historico: !o.atual,
          href: '#/gravacao/' + o.gravacao_id,
          extra: {
            local: o.gravacao_local, referencia: o.gravacao_competencia_ano ? MESES[o.gravacao_competencia_mes - 1] + ' de ' + o.gravacao_competencia_ano : null,
            erroSync: o.erro_sincronizacao, agenda: o.agenda_nome, anteriorId: o.ocorrencia_anterior_id, bruto: o
          }
        };
      }
    },
    google: {
      disponivel: () => souGestor() && ESTADO.googleConectado,
      carregar: (ini, fim) => B7.DB.eventosCalendario(local(ini).toISOString(), local(somarDias(fim, 1)).toISOString())
        .then(l => (l || []).filter(ev => !ev.gravacao_id)),   /* vinculado = já aparece como gravação (sem duplicar) */
      normalizar: ev => ({
        id: 'google:' + ev.id, dominio: 'google', fonteId: ev.id,
        titulo: ev.titulo || '(sem título)', clienteId: null, clienteNome: null, clienteLogo: null,
        dia: ev.dia_inteiro ? diaPuro(ev.inicio) : diaDoInstante(ev.inicio),
        hora: ev.dia_inteiro ? null : horaDoInstante(ev.inicio), horaFim: ev.dia_inteiro || !ev.fim ? null : horaDoInstante(ev.fim),
        diaInteiro: !!ev.dia_inteiro, responsavelId: null, responsavelNome: ev.responsavel_texto || null,
        status: ev.status_provider === 'cancelled' ? 'cancelado' : 'sem_vinculo',
        statusRotulo: ev.status_provider === 'cancelled' ? 'Cancelado no Google' : 'Sem vínculo', tom: ev.status_provider === 'cancelled' ? 'vermelho' : 'neutro',
        cancelado: ev.status_provider === 'cancelled', concluido: false, historico: false,
        href: null, extra: { local: ev.local, agenda: ev.agenda_nome, bruto: ev }
      })
    },
    publicacao: {
      disponivel: () => pode('publicacoes') || pode('linha'),
      carregar: (ini, fim) => B7.DB.publicacoesCalendario(ini, fim),
      normalizar: c => {
        const publicado = c.status === 'Publicado';
        return {
          id: 'publicacao:' + c.id, dominio: 'publicacao', fonteId: c.id,
          titulo: c.titulo || 'Conteúdo sem título', sub: [c.tipo, c.canal].filter(Boolean).join(' · '),
          clienteId: c.client_id, clienteNome: c.clientes && c.clientes.nome, clienteLogo: c.clientes && c.clientes.logo_url,
          dia: diaPuro(c.data_postagem), hora: null, horaFim: null, diaInteiro: true,
          responsavelId: null, responsavelNome: null,
          status: c.status || '', statusRotulo: c.status || '', tom: publicado ? 'verde' : 'neutro',
          cancelado: false, concluido: publicado, historico: false,
          href: c.linha_id ? '#/linha/' + c.linha_id + '/criativos?conteudo=' + c.id : '#/publicacoes/' + diaPuro(c.data_postagem),
          extra: { formato: c.tipo, linha: c.linhas_editoriais && c.linhas_editoriais.nome, pilar: c.pilares && c.pilares.nome }
        };
      }
    },
    video: {
      disponivel: () => pode('video'),
      carregar: (ini, fim) => B7.DB.prazosVideoPeriodo(ini, fim),
      normalizar: d => {
        const s = VIDEO_ST[d.editing_status] || [d.editing_status || '', 'neutro'];
        return {
          id: 'video:' + d.id, dominio: 'video', fonteId: d.id,
          titulo: d.titulo || d.codigo || 'Demanda de vídeo', sub: d.codigo || '',
          clienteId: d.client_id, clienteNome: d.cliente_nome, clienteLogo: d.cliente_logo_url,
          dia: diaPuro(d.prazo), hora: null, horaFim: null, diaInteiro: true,
          responsavelId: d.videomaker_id || null, responsavelNome: d.videomaker_nome || null,
          status: d.editing_status, statusRotulo: s[0], tom: s[1],
          cancelado: d.editing_status === 'descartado', concluido: d.editing_status === 'entregue', historico: false,
          href: '#/video/' + d.id, extra: { gravacao: d.gravacao_nome }
        };
      }
    },
    design: {
      disponivel: () => pode('design'),
      carregar: (ini, fim) => B7.DB.prazosDesignPeriodo(ini, fim),
      normalizar: d => {
        const s = DESIGN_ST[d.status] || [d.status || '', 'neutro'];
        return {
          id: 'design:' + d.id, dominio: 'design', fonteId: d.id,
          titulo: d.titulo || d.conteudo_titulo || 'Peça de design', sub: d.conteudo_tipo || d.tipo || '',
          clienteId: d.client_id, clienteNome: d.cliente_nome, clienteLogo: d.cliente_logo_url,
          dia: diaPuro(d.prazo), hora: null, horaFim: null, diaInteiro: true,
          responsavelId: d.designer_id || null, responsavelNome: d.designer_nome || null,
          status: d.status, statusRotulo: s[0], tom: s[1],
          cancelado: false, concluido: d.status === 'finalizado', historico: false,
          href: '#/design/' + d.id, extra: { linha: d.linha_nome }
        };
      }
    },
    /* camada informativa: não é compromisso, não tem responsável nem
       status operacional. Campanha que começou antes da janela aparece
       no primeiro dia visível ("em andamento"). */
    oportunidade: {
      disponivel: () => !!ESTADO.oportunidades && !!B7.Oportunidades && ['admin', 'coordenador', 'designer', 'videomaker'].includes(papel()),
      carregar: (ini, fim) => B7.Oportunidades.periodo(ini, fim).then(l => l.map(it => Object.assign({ diaVis: it.ini < ini ? ini : it.ini }, it))),
      normalizar: it => {
        const c = B7.Oportunidades.CONF[it.op.confiabilidade] || B7.Oportunidades.CONF.pendente;
        const ignorados = it.relacionados.filter(r => r.ajuste && !r.nivel).map(r => r.cliente.id);
        return {
          id: 'oportunidade:' + it.op.id + ':' + it.ini, dominio: 'oportunidade', fonteId: it.op.id,
          titulo: it.op.nome, sub: B7.Oportunidades.NATUREZA[it.op.natureza] || '',
          clienteId: null, clienteNome: null, clienteLogo: null,
          dia: it.diaVis, hora: null, horaFim: null, diaInteiro: true, responsavelId: null, responsavelNome: null,
          status: it.op.confiabilidade, statusRotulo: c.rot, tom: c.tom,
          cancelado: false, concluido: false, historico: false, href: null,
          extra: { porCliente: it.porCliente, ignorados, nivelMax: it.nivelMax, geral: it.geral, ini: it.ini, fim: it.fim, emAndamento: it.ini < it.diaVis }
        };
      }
    }
  };

  const ESTADO = { googleConectado: false, oportunidades: false };

  /* ------------------------------------------------------------ cache
     Por domínio + janela. Janela que já passou muda pouco (10 min);
     a que toca hoje/futuro é revalidada em 45 s. */
  const cache = new Map();
  const TTL_PASSADO = 10 * 60e3, TTL_ATUAL = 45e3;
  const chaveCache = (dom, ini, fim) => dom + '|' + ini + '|' + fim;
  function invalidar() { cache.clear(); }

  function dominiosDisponiveis() {
    return Object.keys(ADAPTADORES).filter(k => { try { return ADAPTADORES[k].disponivel(); } catch (e) { return false; } });
  }
  function tiposDisponiveis() {
    const doms = dominiosDisponiveis();
    return TIPOS.filter(t => t.dominios.some(d => doms.includes(d)));
  }

  /* carrega TODOS os domínios disponíveis em paralelo. Falha de um
     domínio não esvazia os outros: vira um erro localizado.
     Retorna { eventos, erros: {dominio: msg}, dominios }. */
  async function carregar(ini, fim, opcoes) {
    const forcar = opcoes && opcoes.forcar;
    const doms = dominiosDisponiveis();
    const agora = Date.now();
    const toca = fim >= hoje();
    const res = await Promise.all(doms.map(async dom => {
      const k = chaveCache(dom, ini, fim);
      const c = cache.get(k);
      if (!forcar && c && agora - c.em < (toca ? TTL_ATUAL : TTL_PASSADO)) return { dom, linhas: c.linhas };
      try {
        const linhas = (await ADAPTADORES[dom].carregar(ini, fim)) || [];
        cache.set(k, { em: Date.now(), linhas });
        return { dom, linhas };
      } catch (e) {
        if (c) return { dom, linhas: c.linhas, erro: e };   /* mostra o último bom */
        return { dom, linhas: [], erro: e };
      }
    }));
    const vistos = new Set(), eventos = [], erros = {};
    res.forEach(({ dom, linhas, erro }) => {
      if (erro) erros[dom] = erro.message || 'erro';
      linhas.forEach(l => {
        let ev; try { ev = ADAPTADORES[dom].normalizar(l); } catch (e) { return; }
        if (!ev || !ev.dia || ev.dia < ini || ev.dia > fim || vistos.has(ev.id)) return;   /* dedup por identidade estável */
        vistos.add(ev.id); eventos.push(ev);
      });
    });
    eventos.sort(ordenar);
    return { eventos, erros, dominios: doms };
  }

  /* um domínio só, normalizado — é o que o Painel usa para não ter uma
     segunda regra (ex.: gravações da "Minha semana"). Falha = rejeita. */
  async function carregarDominio(dom, ini, fim) {
    const ad = ADAPTADORES[dom];
    if (!ad || !ad.disponivel()) return [];
    const k = chaveCache(dom, ini, fim), c = cache.get(k), toca = fim >= hoje();
    let linhas;
    if (c && Date.now() - c.em < (toca ? TTL_ATUAL : TTL_PASSADO)) linhas = c.linhas;
    else { linhas = (await ad.carregar(ini, fim)) || []; cache.set(k, { em: Date.now(), linhas }); }
    const vistos = new Set();
    return linhas.map(l => { try { return ad.normalizar(l); } catch (e) { return null; } })
      .filter(ev => ev && ev.dia && ev.dia >= ini && ev.dia <= fim && !vistos.has(ev.id) && vistos.add(ev.id))
      .sort(ordenar);
  }

  /* ordem dentro do dia: com hora primeiro (cronológico), depois prazos
     por domínio; histórico (remarcada antiga) depois da ocorrência atual */
  function ordenar(a, b) {
    return a.dia.localeCompare(b.dia) ||
      ((a.hora ? 0 : 1) - (b.hora ? 0 : 1)) ||
      String(a.hora || '').localeCompare(String(b.hora || '')) ||
      (DOMINIOS[a.dominio].ordem - DOMINIOS[b.dominio].ordem) ||
      ((a.historico ? 1 : 0) - (b.historico ? 1 : 0)) ||
      String(a.clienteNome || '').localeCompare(String(b.clienteNome || ''), 'pt-BR') ||
      a.id.localeCompare(b.id);
  }

  /* filtros combinados (tipo AND cliente AND responsável AND canceladas) */
  function filtrar(eventos, f) {
    const tipo = TIPOS.find(t => t.id === f.tipo);
    return eventos.filter(ev => ev.dominio === 'oportunidade' ? filtrarOportunidade(ev, f) :
      (!tipo || tipo.dominios.includes(ev.dominio)) &&
      (!f.cliente || ev.clienteId === f.cliente) &&
      (!f.resp || ev.responsavelId === f.resp) &&
      (f.canceladas || !ev.cancelado));
  }
  /* oportunidade = camada por cima dos filtros de tipo: aparece com a
     camada ligada; com cliente, só as relevantes para ele (ignoradas para
     ele somem, as dos outros não mudam); sem cliente, as que têm algum
     cliente muito relevante/relacionado + as gerais. Responsável não se
     aplica (não é compromisso de ninguém). */
  function filtrarOportunidade(ev, f) {
    if (!f.op || f.resp) return false;
    const x = ev.extra;
    if (f.cliente) return !!x.porCliente[f.cliente] || (x.geral && !x.ignorados.includes(f.cliente));
    return x.nivelMax === 'muito' || x.nivelMax === 'relacionada' || x.geral;
  }

  return { DATAS, DOMINIOS, TIPOS, TIPO_DO_DOMINIO, ADAPTADORES, ESTADO, carregar, carregarDominio, filtrar, filtrarOportunidade, invalidar, dominiosDisponiveis, tiposDisponiveis, ordenar };
})();
