/* =====================================================================
   ACESSO AO BANCO
   Todo SQL/consulta do sistema passa por aqui. Nenhum outro arquivo fala
   direto com o Supabase — assim, mudar o banco significa mexer só neste.
   Toda função devolve dados ou lança erro; quem chama decide o que fazer.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.DB = (function () {
  const sb = () => {
    if (!B7.sb) throw new Error('Supabase não configurado');
    return B7.sb;
  };
  /* O status HTTP vai junto no erro: o autosave precisa distinguir
     "o servidor caiu" (tenta de novo) de "o banco recusou" (descarta). */
  const ok = ({ data, error, status }) => {
    if (error) { if (status !== undefined && error.status === undefined) error.status = status; throw error; }
    return data;
  };

  /* Se o banco não responder, é melhor falhar com aviso do que deixar a
     tela girando para sempre (URL errada, rede da empresa bloqueando etc). */
  const LIMITE = 20000;
  function comLimite(promessa) {
    return Promise.race([
      promessa,
      new Promise((_, rej) => setTimeout(
        () => rej(new Error('O banco não respondeu. Confira a conexão e os dados em js/config.js.')), LIMITE))
    ]);
  }

  const api = {
    /* ---------------------------------------------------- CLIENTES */
    async listarClientes() {
      return ok(await sb().from('clientes_resumo').select('*').is('deleted_at', null).order('nome'));
    },
    async cliente(id) {
      return ok(await sb().from('clientes_resumo').select('*').eq('id', id).single());
    },
    async criarCliente(nome, observacoes = '', logo = null) {
      const dados = { nome: nome.trim(), observacoes };
      if (logo) { dados.logo_url = logo.url; dados.logo_path = logo.path; }
      const linhas = ok(await sb().from('clientes').insert([dados]).select());
      return linhas[0];
    },
    async atualizarCliente(id, patch) {
      return ok(await sb().from('clientes').update(patch).eq('id', id).select());
    },
    async fixarCliente(id, fixado) {
      return ok(await sb().from('clientes').update({ is_pinned: !!fixado }).eq('id', id).select());
    },

    /* títulos dos primeiros roteiros — alimenta a prévia no hover */
    async previaRoteiros(gravacaoId, limite = 3) {
      const linhas = ok(await sb().from('roteiros').select('id,titulo,position')
        .eq('recording_session_id', gravacaoId).is('deleted_at', null)
        .order('position').limit(limite));
      return linhas;
    },

    async excluirCliente(id) {
      return ok(await sb().from('clientes').delete().eq('id', id));
    },

    /* ------------------------------------- LOGOS (Supabase Storage) */
    /* A imagem vai para o bucket; na tabela fica só a referência. */
    async enviarLogo(arquivo, clienteId) {
      const ext = (arquivo.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const limpo = arquivo.name.replace(/\.[^.]+$/, '').replace(/[^\w\-]+/g, '-').slice(0, 40).toLowerCase();
      /* pasta por cliente + timestamp: sem colisão entre clientes nem entre trocas */
      const caminho = (clienteId || 'novos') + '/' + Date.now() + '-' + (limpo || 'logo') + '.' + ext;
      const { error } = await sb().storage.from('client-logos')
        .upload(caminho, arquivo, { cacheControl: '3600', upsert: false, contentType: arquivo.type });
      if (error) throw error;
      const { data } = sb().storage.from('client-logos').getPublicUrl(caminho);
      return { path: caminho, url: data.publicUrl };
    },

    async apagarLogo(caminho) {
      if (!caminho) return;
      const { error } = await sb().storage.from('client-logos').remove([caminho]);
      if (error) console.warn('não consegui apagar a logo antiga:', error.message);
    },


    /* ============================ FIXADOS, ARQUIVO E LIXEIRA ==========
       Nada é apagado de verdade pelo botão de excluir: o registro ganha
       deleted_at e sai das listas. A exclusão definitiva é outra ação. */
    async fixar(tabela, id, fixado) {
      return ok(await sb().from(tabela).update({ is_pinned: !!fixado }).eq('id', id).select());
    },
    async arquivar(id, arquivar) {
      return ok(await sb().from('gravacoes')
        .update({ archived_at: arquivar ? new Date().toISOString() : null }).eq('id', id).select());
    },
    async paraLixeira(tabela, id) {
      return ok(await sb().from(tabela)
        .update({ deleted_at: new Date().toISOString() }).eq('id', id).select());
    },
    async restaurar_(tabela, id) {
      return ok(await sb().from(tabela).update({ deleted_at: null }).eq('id', id).select());
    },
    async excluirDefinitivo(tabela, id) {
      return ok(await sb().from(tabela).delete().eq('id', id));
    },
    async lixeira() {
      const [gravacoes, roteiros, clientes] = await Promise.all([
        sb().from('gravacoes_resumo').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        sb().from('roteiros').select('id,titulo,recording_session_id,deleted_at')
          .not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        sb().from('clientes_resumo').select('*').not('deleted_at', 'is', null)
      ]);
      for (const r of [gravacoes, roteiros, clientes]) if (r.error) throw r.error;
      return { gravacoes: gravacoes.data || [], roteiros: roteiros.data || [], clientes: clientes.data || [] };
    },

    /* ==================================== ATIVIDADE ==================
       Só eventos que interessam. Se o registro falhar, a ação principal
       não pode quebrar por causa disso. */
    async registrar(evento) {
      try {
        await sb().from('atividades').insert([{
          action_type: evento.tipo, entity_type: evento.entidade,
          entity_id: evento.id || null, client_id: evento.cliente || null,
          recording_id: evento.gravacao || null, description: evento.texto || ''
        }]);
      } catch (e) { console.warn('atividade não registrada:', e.message); }
    },
    async atividades(limite = 10, clienteId) {
      let q = sb().from('atividades').select('*');
      if (clienteId) q = q.eq('client_id', clienteId);
      return ok(await q.order('created_at', { ascending: false }).limit(limite));
    },

    /* ==================================== FIXADOS ==================== */
    async fixados() {
      const [gravacoes, clientes] = await Promise.all([
        sb().from('gravacoes_resumo').select('*').eq('is_pinned', true).is('deleted_at', null),
        sb().from('clientes_resumo').select('*').eq('is_pinned', true).is('deleted_at', null)
      ]);
      for (const r of [gravacoes, clientes]) if (r.error) throw r.error;
      return { gravacoes: gravacoes.data || [], clientes: clientes.data || [] };
    },

    /* --------------------------------------------------- GRAVAÇÕES */
    async listarGravacoes(clienteId, opcoes = {}) {
      let q = sb().from('gravacoes_resumo').select('*').is('deleted_at', null);
      if (!opcoes.comArquivadas) q = q.is('archived_at', null);
      if (opcoes.somenteArquivadas) q = sb().from('gravacoes_resumo').select('*')
        .is('deleted_at', null).not('archived_at', 'is', null);
      if (clienteId) q = q.eq('client_id', clienteId);
      return ok(await q.order('updated_at', { ascending: false }));
    },
    async gravacoesRecentes(limite = 6) {
      return ok(await sb().from('gravacoes_resumo').select('*')
        .is('deleted_at', null).is('archived_at', null)
        .order('updated_at', { ascending: false }).limit(limite));
    },
    async gravacao(id) {
      return ok(await sb().from('gravacoes_resumo').select('*').eq('id', id).single());
    },
    async criarGravacao(dados) {
      const linhas = ok(await sb().from('gravacoes').insert([dados]).select());
      return linhas[0];
    },
    async atualizarGravacao(id, patch) {
      return ok(await sb().from('gravacoes').update(patch).eq('id', id).select());
    },
    async excluirGravacao(id) {
      return ok(await sb().from('gravacoes').delete().eq('id', id));
    },

    /* ---------------------------------------------------- ROTEIROS */
    async listarRoteiros(gravacaoId) {
      return ok(await sb().from('roteiros').select('*')
        .eq('recording_session_id', gravacaoId).is('deleted_at', null).order('position'));
    },
    async criarRoteiro(dados) {
      const linhas = ok(await sb().from('roteiros').insert([dados]).select());
      return linhas[0];
    },
    async atualizarRoteiro(id, patch) {
      return ok(await sb().from('roteiros').update(patch).eq('id', id).select());
    },
    async excluirRoteiro(id) {
      return ok(await sb().from('roteiros').delete().eq('id', id));
    },
    async reordenarRoteiros(lista) {   // [{id, position}, ...]
      for (const r of lista) {
        ok(await sb().from('roteiros').update({ position: r.position }).eq('id', r.id));
      }
    },

    /* ------------------------------------------------------- CENAS */
    async listarCenasDaGravacao(roteiroIds) {
      if (!roteiroIds.length) return [];
      return ok(await sb().from('cenas').select('*').in('script_id', roteiroIds).order('position'));
    },
    async listarCenas(roteiroId) {
      return ok(await sb().from('cenas').select('*').eq('script_id', roteiroId).order('position'));
    },
    async criarCena(dados) {
      const linhas = ok(await sb().from('cenas').insert([dados]).select());
      return linhas[0];
    },
    async criarCenas(lista) {
      if (!lista.length) return [];
      return ok(await sb().from('cenas').insert(lista).select());
    },
    async atualizarCena(id, patch) {
      return ok(await sb().from('cenas').update(patch).eq('id', id).select());
    },
    async excluirCena(id) {
      return ok(await sb().from('cenas').delete().eq('id', id));
    },
    async reordenarCenas(lista) {
      for (const c of lista) {
        ok(await sb().from('cenas').update({ position: c.position }).eq('id', c.id));
      }
    },

    /* Restaura um registro apagado mantendo o mesmo id (usado no Desfazer) */
    async restaurar(tabela, registro) {
      const linhas = ok(await sb().from(tabela).insert([registro]).select());
      return linhas[0];
    },

    /* ---------------------------------------------------- DUPLICAR */
    async duplicarRoteiro(roteiro, novaPosicao) {
      const cenas = await this.listarCenas(roteiro.id);
      const copia = await this.criarRoteiro({
        recording_session_id: roteiro.recording_session_id,
        position: novaPosicao,
        titulo: roteiro.titulo,
        objetivo: roteiro.objetivo,
        observacao_gravacao: roteiro.observacao_gravacao,
        escala: roteiro.escala,
        escala_automatica: roteiro.escala_automatica
      });
      if (cenas.length) {
        await this.criarCenas(cenas.map((c, i) => ({
          script_id: copia.id, position: i, tipo: c.tipo, direcao: c.direcao,
          funcao: c.funcao, texto: c.texto, sugestao_cenas: c.sugestao_cenas
        })));
      }
      return copia;
    },

    async duplicarGravacao(gravacaoId, dados) {
      const nova = await this.criarGravacao(dados);
      const roteiros = await this.listarRoteiros(gravacaoId);
      for (let i = 0; i < roteiros.length; i++) {
        const r = roteiros[i];
        const copia = await this.criarRoteiro({
          recording_session_id: nova.id, position: i,
          titulo: r.titulo, objetivo: r.objetivo,
          observacao_gravacao: r.observacao_gravacao,
          escala: r.escala, escala_automatica: r.escala_automatica
        });
        const cenas = await this.listarCenas(r.id);
        if (cenas.length) {
          await this.criarCenas(cenas.map((c, j) => ({
            script_id: copia.id, position: j, tipo: c.tipo, direcao: c.direcao,
            funcao: c.funcao, texto: c.texto, sugestao_cenas: c.sugestao_cenas
          })));
        }
      }
      return nova;
    },

    /* roteiros de um cliente, dos mais recentes para os mais antigos */
    /* um roteiro pelo id — usado pelo vínculo conteúdo → roteiro */
    async roteiro(id) {
      return ok(await sb().from('roteiros').select('*').eq('id', id).single());
    },

    async roteirosDoCliente(clienteId, limite = 5) {
      const gravacoes = ok(await sb().from('gravacoes').select('id,nome,status')
        .eq('client_id', clienteId).is('deleted_at', null).is('archived_at', null));
      if (!gravacoes.length) return [];
      const ids = gravacoes.map(g => g.id);
      const roteiros = ok(await sb().from('roteiros')
        .select('id,titulo,position,recording_session_id,updated_at')
        .in('recording_session_id', ids).is('deleted_at', null)
        .order('updated_at', { ascending: false }).limit(limite));
      const porId = {};
      gravacoes.forEach(g => porId[g.id] = g);
      return roteiros.map(r => ({ ...r, gravacao: porId[r.recording_session_id] || null }));
    },


    /* =================================================================
       CENTRAL DE CONTEÚDO
       Inteligência do cliente, onboarding mensal, linhas editoriais,
       pilares e conteúdos. Tudo opcional: um cliente só com nome
       continua funcionando em todas as telas.
       ================================================================= */

    /* ---- inteligência (1 registro por cliente, criado sob demanda) ---- */
    async inteligencia(clienteId) {
      const linhas = ok(await sb().from('cliente_inteligencia').select('*').eq('client_id', clienteId));
      if (linhas.length) return linhas[0];
      const criadas = ok(await sb().from('cliente_inteligencia')
        .insert([{ client_id: clienteId }]).select());
      return criadas[0];
    },
    async salvarInteligencia(clienteId, patch) {
      return ok(await sb().from('cliente_inteligencia').update(patch).eq('client_id', clienteId).select());
    },

    /* ---- produtos e provas ---- */
    async listarProdutos(clienteId) {
      return ok(await sb().from('produtos').select('*')
        .eq('client_id', clienteId).is('deleted_at', null).order('position'));
    },
    async criarProduto(clienteId, posicao) {
      const linhas = ok(await sb().from('produtos')
        .insert([{ client_id: clienteId, position: posicao || 0 }]).select());
      return linhas[0];
    },
    async atualizarProduto(id, patch) {
      return ok(await sb().from('produtos').update(patch).eq('id', id).select());
    },
    async excluirProduto(id) {
      return ok(await sb().from('produtos').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    },
    async listarProvas(clienteId) {
      return ok(await sb().from('provas').select('*')
        .eq('client_id', clienteId).is('deleted_at', null).order('position'));
    },
    async criarProva(clienteId, posicao) {
      const linhas = ok(await sb().from('provas')
        .insert([{ client_id: clienteId, position: posicao || 0 }]).select());
      return linhas[0];
    },
    async atualizarProva(id, patch) {
      return ok(await sb().from('provas').update(patch).eq('id', id).select());
    },
    async excluirProva(id) {
      return ok(await sb().from('provas').update({ deleted_at: new Date().toISOString() }).eq('id', id));
    },

    /* ---- onboarding mensal ---- */
    async listarOnboardings(clienteId) {
      return ok(await sb().from('onboardings').select('*')
        .eq('client_id', clienteId).is('deleted_at', null)
        .order('ano', { ascending: false }).order('mes', { ascending: false }));
    },
    async criarOnboarding(dados) {
      const linhas = ok(await sb().from('onboardings').insert([dados]).select());
      return linhas[0];
    },
    async atualizarOnboarding(id, patch) {
      return ok(await sb().from('onboardings').update(patch).eq('id', id).select());
    },
    /* duplicar o mês anterior: copia o contexto e limpa o que é do mês */
    async duplicarOnboarding(origem, mes, ano) {
      return this.criarOnboarding({
        client_id: origem.client_id, mes: mes, ano: ano,
        objetivo: origem.objetivo, campanhas: '', prioritarios: origem.prioritarios,
        ofertas: origem.ofertas, datas: '', novidades: '',
        obrigatorios: origem.obrigatorios, evitar: origem.evitar,
        pedidos: '', quantidade: origem.quantidade, observacoes: ''
      });
    },

    /* ---- linhas editoriais ---- */
    async listarLinhas(clienteId, opcoes = {}) {
      let q = sb().from('linhas_resumo').select('*').is('deleted_at', null);
      if (opcoes.somenteArquivadas) q = q.not('archived_at', 'is', null);
      else if (!opcoes.comArquivadas) q = q.is('archived_at', null);
      if (clienteId) q = q.eq('client_id', clienteId);
      return ok(await q.order('ano', { ascending: false }).order('mes', { ascending: false }));
    },
    async arquivarLinha(id, arquivar) {
      return ok(await sb().from('linhas_editoriais')
        .update({ archived_at: arquivar ? new Date().toISOString() : null }).eq('id', id).select());
    },
    async linha(id) {
      return ok(await sb().from('linhas_resumo').select('*').eq('id', id).single());
    },
    async criarLinha(dados) {
      const linhas = ok(await sb().from('linhas_editoriais').insert([dados]).select());
      return linhas[0];
    },
    async atualizarLinha(id, patch) {
      return ok(await sb().from('linhas_editoriais').update(patch).eq('id', id).select());
    },
    async excluirLinha(id) {
      /* a confirmação promete que os conteúdos vão junto — então vão */
      const agora = new Date().toISOString();
      ok(await sb().from('conteudos').update({ deleted_at: agora })
        .eq('linha_id', id).is('deleted_at', null));
      return ok(await sb().from('linhas_editoriais')
        .update({ deleted_at: agora }).eq('id', id));
    },

    /* ---- pilares ---- */
    async listarPilares(linhaId) {
      return ok(await sb().from('pilares').select('*').eq('linha_id', linhaId).order('position'));
    },
    async criarPilar(dados) {
      const linhas = ok(await sb().from('pilares').insert([dados]).select());
      return linhas[0];
    },
    async atualizarPilar(id, patch) {
      return ok(await sb().from('pilares').update(patch).eq('id', id).select());
    },
    async excluirPilar(id) {
      /* a FK é on delete set null, mas o cliente PostgREST pode ter cache
         de esquema antigo: desvincula explicitamente antes de apagar */
      ok(await sb().from('conteudos').update({ pilar_id: null }).eq('pilar_id', id));
      return ok(await sb().from('pilares').delete().eq('id', id));
    },
    async reordenarPilares(ids) {
      for (let i = 0; i < ids.length; i++) {
        ok(await sb().from('pilares').update({ position: i }).eq('id', ids[i]));
      }
    },
    /* vincula (ou desvincula, com null) um conteúdo a um pilar */
    async definirPilarDoConteudo(conteudoId, pilarId) {
      return ok(await sb().from('conteudos').update({ pilar_id: pilarId || null })
        .eq('id', conteudoId).select());
    },

    /* ---- conteúdos ---- */
    async listarConteudos(linhaId) {
      return ok(await sb().from('conteudos').select('*')
        .eq('linha_id', linhaId).is('deleted_at', null).order('position'));
    },
    async conteudo(id) {
      return ok(await sb().from('conteudos').select('*').eq('id', id).single());
    },
    async criarConteudo(dados) {
      const linhas = ok(await sb().from('conteudos').insert([dados]).select());
      return linhas[0];
    },
    async atualizarConteudo(id, patch) {
      return ok(await sb().from('conteudos').update(patch).eq('id', id).select());
    },
    async excluirConteudo(id) {
      return ok(await sb().from('conteudos')
        .update({ deleted_at: new Date().toISOString() }).eq('id', id));
    },

    /* Todas as linhas de todos os clientes, para a visão global. Usa a
       mesma view que já traz nome do cliente e contagem de conteúdos. */
    async listarTodasLinhas(limite) {
      return ok(await sb().from('linhas_resumo').select('*')
        .is('deleted_at', null)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(limite || 60));
    },

    /* ================================================= STATUS SEMANAL */

    async listarStatus({ clienteId = null, limite = 40, arquivados = false } = {}) {
      let q = sb().from('status_resumo').select('*').is('deleted_at', null);
      q = arquivados ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
      if (clienteId) q = q.eq('client_id', clienteId);
      return ok(await q.order('semana_inicio', { ascending: false }).limit(limite));
    },
    async status(id) {
      const linhas = ok(await sb().from('status_resumo').select('*').eq('id', id).limit(1));
      if (!linhas.length) { const e = new Error('Status não encontrado'); e.naoEncontrado = true; throw e; }
      return linhas[0];
    },
    /* Já existe relatório desta semana para este cliente? Serve para
       oferecer abrir em vez de criar outro sem querer. */
    async statusDaSemana(clienteId, inicio) {
      const linhas = ok(await sb().from('status_resumo').select('*')
        .eq('client_id', clienteId).eq('semana_inicio', inicio)
        .is('deleted_at', null).limit(1));
      return linhas[0] || null;
    },
    async criarStatus(dados) {
      const linhas = ok(await sb().from('status_semanais').insert([dados]).select());
      return linhas[0];
    },
    async atualizarStatus(id, patch) {
      return ok(await sb().from('status_semanais').update(patch).eq('id', id).select());
    },
    async arquivarStatus(id, arquivar) {
      return ok(await sb().from('status_semanais')
        .update({ archived_at: arquivar ? new Date().toISOString() : null }).eq('id', id).select());
    },
    async excluirStatus(id) {
      return ok(await sb().from('status_semanais')
        .update({ deleted_at: new Date().toISOString() }).eq('id', id).select());
    },

    /* ---- demandas ---- */
    async listarItens(reportId) {
      return ok(await sb().from('status_itens').select('*')
        .eq('report_id', reportId).is('deleted_at', null)
        .order('data', { ascending: true }).order('position', { ascending: true }));
    },
    async criarItem(dados) {
      const linhas = ok(await sb().from('status_itens').insert([dados]).select());
      return linhas[0];
    },
    async criarItens(lista) {
      if (!lista.length) return [];
      return ok(await sb().from('status_itens').insert(lista).select());
    },
    async atualizarItem(id, patch) {
      return ok(await sb().from('status_itens').update(patch).eq('id', id).select());
    },
    async excluirItem(id) {
      return ok(await sb().from('status_itens')
        .update({ deleted_at: new Date().toISOString() }).eq('id', id).select());
    },

    /* ---- versões exportadas ---- */
    async listarVersoes(reportId) {
      return ok(await sb().from('status_versoes').select('id,versao,formato,created_at')
        .eq('report_id', reportId).order('versao', { ascending: false }));
    },
    async criarVersao(reportId, formato, conteudo) {
      const anteriores = await this.listarVersoes(reportId).catch(() => []);
      const versao = (anteriores[0] ? anteriores[0].versao : 0) + 1;
      const linhas = ok(await sb().from('status_versoes')
        .insert([{ report_id: reportId, versao, formato, conteudo }]).select());
      return linhas[0];
    },
    async versao(id) {
      const linhas = ok(await sb().from('status_versoes').select('*').eq('id', id).limit(1));
      return linhas[0] || null;
    },

    /* Todos os conteúdos de um cliente, para quando não há linha
       editorial vinculada à semana. */
    async listarConteudosDoCliente(clienteId, limite) {
      return ok(await sb().from('conteudos').select('*')
        .eq('client_id', clienteId).is('deleted_at', null)
        .order('data_postagem', { ascending: false }).limit(limite || 80));
    },

    /* Conteúdos da linha editorial com postagem dentro do intervalo. É o
       recorte da semana: não traz o mês inteiro. */
    async conteudosDoPeriodo(linhaId, inicio, fim) {
      return ok(await sb().from('conteudos').select('*')
        .eq('linha_id', linhaId).is('deleted_at', null)
        .gte('data_postagem', inicio).lte('data_postagem', fim)
        .order('data_postagem', { ascending: true }));
    },
    /* Conteúdos específicos por id — usado pelo Status Semanal para
       reconciliar a situação das demandas vinculadas (`status_itens.
       content_id`) com o status atual de cada conteúdo na Linha
       Editorial, sem trazer a linha inteira. */
    async conteudosPorIds(ids) {
      if (!ids || !ids.length) return [];
      return ok(await sb().from('conteudos').select('id,status,tipo,etapa,data_postagem')
        .in('id', ids).is('deleted_at', null));
    },

    /* =============================================== CENTRAL DE PRODUÇÃO
       Cada número tem uma definição e um filtro equivalente na lista, para
       o total e a lista nunca discordarem. Arquivados e excluídos ficam
       de fora de tudo. */
    async painelProducao(filtros) {
      filtros = filtros || {};
      /* Cada contagem é isolada: se uma tabela ainda não existe porque o
         migration correspondente não rodou, aquele número vem zero e a
         Central continua de pé em vez de virar tela de erro. */
      const conta = async (tabela, montar) => {
        try {
          let q = sb().from(tabela).select('id', { count: 'exact', head: true })
            .is('deleted_at', null).is('archived_at', null);
          q = montar ? montar(q) : q;
          const { count, error } = await q;
          if (error) { console.warn('painelProducao: ' + tabela, error.message); return 0; }
          return count || 0;
        } catch (e) { console.warn('painelProducao: ' + tabela, e.message); return 0; }
      };

      /* O período tem semântica diferente em cada categoria:
         gravação usa a data de gravação, linha editorial usa mês/ano de
         referência e roteiro usa a data de criação. */
      const perGrav = q => filtros.de
        ? q.gte('data_gravacao', filtros.de).lte('data_gravacao', filtros.ate) : q;
      const perRot = q => filtros.de
        ? q.gte('created_at', filtros.de).lte('created_at', filtros.ate + 'T23:59:59') : q;
      const cli = q => filtros.clienteId ? q.eq('client_id', filtros.clienteId) : q;

      /* Roteiro não tem client_id: ele pertence a uma gravação. Filtrar
         por cliente é filtrar pelas gravações daquele cliente. */
      const idsGrav = filtros.clienteId ? await this.idsGravacoesDoCliente(filtros.clienteId) : null;
      const cliRot = q => idsGrav ? q.in('recording_session_id', idsGrav.length ? idsGrav : ['00000000-0000-0000-0000-000000000000']) : q;

      const g = q => cli(perGrav(q));
      const r = q => cliRot(perRot(q));

      const [gravTotal, gravFeitas, gravFaltam, gravAgendadas, gravSemData, gravCanceladas,
             rotTotal, rotAndamento, rotProntos, rotGravados] = await Promise.all([
        /* total: gravações válidas, canceladas fora */
        conta('gravacoes', q => g(q).neq('situacao', 'Cancelada')),
        /* gravadas: confirmação explícita da equipe, nunca deduzida da data */
        conta('gravacoes', q => g(q).eq('situacao', 'Gravada')),
        /* faltam: pendentes e agendadas — não é total menos gravadas */
        conta('gravacoes', q => g(q).in('situacao', ['Pendente', 'Agendada'])),
        conta('gravacoes', q => g(q).eq('situacao', 'Agendada')),
        conta('gravacoes', q => g(q).eq('situacao', 'Pendente').is('data_gravacao', null)),
        conta('gravacoes', q => g(q).eq('situacao', 'Cancelada')),

        conta('roteiros', q => r(q)),
        conta('roteiros', q => r(q).in('status', ['Em criação', 'Em revisão', 'Aprovado internamente'])),
        conta('roteiros', q => r(q).eq('status', 'Pronto para gravar')),
        /* roteiro já gravado tinha sumido da leitura: entrava no total e não
           aparecia em categoria nenhuma */
        conta('roteiros', q => r(q).eq('status', 'Gravado'))
      ]);

      /* Linhas editoriais filtram por mês/ano de referência, não por
         created_at: é essa a semântica do planejamento. */
      /* aqui não se usa count: as linhas são filtradas por mês/ano de
         referência em memória, então precisamos das linhas mesmo */
      let ql = sb().from('linhas_editoriais').select('id,status,mes,ano,client_id')
        .is('deleted_at', null).is('archived_at', null);
      if (filtros.clienteId) ql = ql.eq('client_id', filtros.clienteId);
      if (filtros.de) {
        const a = filtros.de.slice(0, 7).split('-'), b = filtros.ate.slice(0, 7).split('-');
        ql = ql.gte('ano', +a[0]).lte('ano', +b[0]);
      }
      let linhas = [];
      try { linhas = (await ql.then(r => r.data)) || []; } catch (e) { linhas = []; }
      const noPeriodo = filtros.de
        ? linhas.filter(l => {
            const ref = l.ano * 100 + l.mes;
            const a = +filtros.de.slice(0, 4) * 100 + +filtros.de.slice(5, 7);
            const b = +filtros.ate.slice(0, 4) * 100 + +filtros.ate.slice(5, 7);
            return ref >= a && ref <= b;
          })
        : linhas;

      return {
        gravacoes: { total: gravTotal, gravadas: gravFeitas, faltam: gravFaltam,
                     agendadas: gravAgendadas, sem_data: gravSemData,
                     canceladas: gravCanceladas },
        linhas: { total: noPeriodo.length,
                  elaboracao: noPeriodo.filter(l => l.status !== 'Finalizada').length,
                  finalizadas: noPeriodo.filter(l => l.status === 'Finalizada').length },
        roteiros: { total: rotTotal, andamento: rotAndamento, prontos: rotProntos,
                    gravados: rotGravados }
      };
    },

    /* A lista usa exatamente a mesma regra da contagem. */
    async listarGravacoesPor(situacoes, filtros) {
      filtros = filtros || {};
      let q = sb().from('gravacoes_resumo').select('*')
        .is('deleted_at', null).is('archived_at', null);
      if (situacoes === 'sem_data') q = q.eq('situacao', 'Pendente').is('data_gravacao', null);
      else if (situacoes && situacoes.length) q = q.in('situacao', situacoes);
      if (filtros.clienteId) q = q.eq('client_id', filtros.clienteId);
      if (filtros.de) q = q.gte('data_gravacao', filtros.de).lte('data_gravacao', filtros.ate);
      return ok(await q.order('updated_at', { ascending: false }).limit(60));
    },
    /* ids das gravações vivas de um cliente — base para qualquer filtro
       de roteiro por cliente */
    async idsGravacoesDoCliente(clienteId) {
      const linhas = ok(await sb().from('gravacoes').select('id')
        .eq('client_id', clienteId).is('deleted_at', null));
      return linhas.map(x => x.id);
    },
    async listarRoteirosPor(status, filtros) {
      filtros = filtros || {};
      let q = sb().from('roteiros').select('*')
        .is('deleted_at', null).is('archived_at', null);
      if (status && status.length) q = q.in('status', status);
      if (filtros.clienteId) {
        const ids = await this.idsGravacoesDoCliente(filtros.clienteId);
        if (!ids.length) return [];
        q = q.in('recording_session_id', ids);
      }
      if (filtros.de) q = q.gte('created_at', filtros.de).lte('created_at', filtros.ate + 'T23:59:59');
      return ok(await q.order('updated_at', { ascending: false }).limit(60));
    },

    /* ---- verificação real da conexão, para as Configurações ---- */
    async verificarBanco() {
      const inicio = Date.now();
      try {
        const { error } = await sb().from('clientes')
          .select('id', { count: 'exact', head: true }).limit(1);
        if (error) throw error;
        return { ok: true, ms: Date.now() - inicio, em: new Date().toISOString() };
      } catch (e) {
        return { ok: false, erro: e.message || 'Falha ao consultar o banco.',
                 ms: Date.now() - inicio, em: new Date().toISOString() };
      }
    },

    /* ==================================================== AUTENTICAÇÃO */

    /* dá acesso ao cliente supabase para a camada de sessão */
    cliente_supabase() { return sb(); },

    /* getSession() aguarda o supabase-js terminar de restaurar a sessão
       do armazenamento local. Perguntar antes disso devolve vazio mesmo
       com sessão válida — foi o que causava o vaivém da tela de login. */
    async sessaoSupabase() {
      try {
        const { data } = await sb().auth.getSession();
        return (data && data.session) || null;
      } catch (e) { return null; }
    },

    async minhaSessao() {
      const linhas = ok(await sb().from('minha_sessao').select('*').limit(1));
      return linhas[0] || null;
    },

    /* Chama a função de autenticação. Erros de rede e função ausente são
       distinguidos de erros de credencial: o primeiro não deve virar
       "senha inválida" na tela. */
    async chamarAuth(corpo) {
      const { data, error } = await sb().functions.invoke('b7-auth', { body: corpo });
      if (error) {
        /* O supabase-js entrega qualquer resposta fora da faixa 2xx como
           erro. Uma função publicada que recusa a credencial responde 401
           e cairia aqui igual a uma função inexistente — por isso lemos o
           corpo da resposta antes de concluir qualquer coisa. */
        let corpoErro = null, texto = '';
        const ctx = error.context;
        const status = ctx && typeof ctx.status === 'number' ? ctx.status : 0;
        try { texto = await ctx.clone().text(); corpoErro = JSON.parse(texto); } catch (x) {}
        if (corpoErro && corpoErro.erro) throw new Error(corpoErro.erro);
        /* Sem corpo reconhecível, o que importa é dizer o que o gateway
           respondeu: 401 sem JSON é "Verify JWT" ligado na função; 404 é
           função com outro nome; 5xx é a função quebrando ao subir. */
        let motivo = 'Serviço de acesso indisponível';
        if (status === 401 || status === 403) {
          motivo += ' (HTTP ' + status + ': a função b7-auth está com "Verify JWT" ligado — desligue em Edge Functions → b7-auth → Details)';
        } else if (status === 404) {
          motivo += ' (HTTP 404: não existe uma função publicada com o nome exato b7-auth)';
        } else if (status >= 500) {
          motivo += ' (HTTP ' + status + ': a função falhou — veja Edge Functions → b7-auth → Logs)';
        } else if (status) {
          motivo += ' (HTTP ' + status + ')';
        } else {
          motivo += ' (sem resposta: rede, CORS ou projeto pausado — ' + (error.name || '') + ')';
        }
        if (texto && texto.length < 160) motivo += ' — ' + texto.replace(/\s+/g, ' ').trim();
        const e = new Error(motivo + '.');
        e.rede = true; e.status = status;
        throw e;
      }
      if (data && data.erro) throw new Error(data.erro);
      return data;
    },

    async assumirSessao(access_token, refresh_token) {
      const { error } = await sb().auth.setSession({ access_token, refresh_token });
      if (error) throw new Error('Não foi possível iniciar a sessão.');
    },

    async encerrarSessao() {
      try { await sb().auth.signOut(); } catch (e) {}
    },

    /* ================================================= PORTAL DO CLIENTE

       Nenhuma destas consultas filtra por empresa no cliente-JS: quem
       filtra é o RLS, com posso_ver_cliente(). Filtrar aqui seria uma
       conveniência de interface, não uma proteção. */

    async aprovacoesDoCliente({ situacao } = {}) {
      let q = sb().from('aprovacoes_pendentes').select('*')
        .order('enviado_em', { ascending: false });
      if (situacao && situacao !== 'todos') q = q.eq('situacao', situacao);
      return ok(await q.limit(50));
    },

    async aprovacao(id) {
      const linhas = ok(await sb().from('aprovacoes').select('*').eq('id', id).limit(1));
      return linhas[0] || null;
    },

    /* ---- envio, decisão e comentários ----
       Tudo passa por funções do banco (migration_aprovacoes_v2): elas
       trancam a versão, conferem quem decide, ignoram comando repetido e
       gravam evento + notificações + Kanban na mesma transação. */
    rpc(nome, args) {
      return sb().rpc(nome, args).then(({ data, error }) => {
        if (error) {
          const e = new Error(error.message || 'Falha no banco');
          e.code = error.code; e.details = error.details; throw e;
        }
        return data;
      });
    },

    async enviarParaAprovacao({ client_id, tipo, alvo_id, snapshot, observacao }) {
      return this.rpc('aprov_enviar', {
        p_client_id: client_id, p_tipo: tipo, p_alvo_id: alvo_id,
        p_snapshot: snapshot || {}, p_observacao: observacao || null
      });
    },

    /* situacao: 'aprovado' | 'ajustes' | 'recusado'. versao é a que a
       pessoa está vendo — o banco recusa se outra já existir. */
    async decidirAprovacao(id, situacao, motivo, versao) {
      return this.rpc('aprov_decidir', {
        p_aprovacao_id: id, p_situacao: situacao,
        p_motivo: motivo || null, p_versao: versao == null ? null : versao
      });
    },

    /* "Excluir aprovação" (só Admin; o banco confere). escopo: 'total' |
       'parte'. Anulação auditada: nada é apagado; a versão volta a
       aguardar o cliente (migration_aprovacoes_v3). */
    async anularAprovacao({ id, escopo, parteId, motivo, visivelCliente }) {
      return this.rpc('aprov_anular', {
        p_aprovacao_id: id, p_escopo: escopo || 'total', p_parte_id: parteId || null,
        p_motivo: motivo || null, p_visivel_cliente: !!visivelCliente
      });
    },

    async decidirParte(aprovacaoId, parteId, rotulo, situacao, comentario, tipo) {
      return this.rpc('aprov_decidir_parte', {
        p_aprovacao_id: aprovacaoId, p_parte_id: parteId, p_rotulo: rotulo,
        p_situacao: situacao, p_comentario: comentario || null, p_parte_tipo: tipo || 'cena'
      });
    },

    /* painel: lista com contagens, para equipe e para o portal */
    async painelAprovacoes(f) {
      f = f || {};
      let q = sb().from('aprovacoes_painel').select('*');
      if (f.situacao && f.situacao !== 'todos') {
        if (Array.isArray(f.situacao)) q = q.in('situacao', f.situacao);
        else q = q.eq('situacao', f.situacao);
      }
      if (f.clienteId) q = q.eq('client_id', f.clienteId);
      if (f.tipo) q = q.eq('tipo', f.tipo);
      if (f.de) q = q.gte('enviado_em', f.de);
      if (f.ate) q = q.lte('enviado_em', f.ate + 'T23:59:59');
      if (f.busca) q = q.ilike('titulo', '%' + f.busca + '%');
      if (f.somenteAtual) q = q.eq('versao_atual', true);
      if (f.alvoIds) q = q.in('alvo_id', f.alvoIds);
      return ok(await q.order('enviado_em', { ascending: false }).limit(f.limite || 200));
    },
    async painelAprovacao(id) {
      const l = ok(await sb().from('aprovacoes_painel').select('*').eq('id', id).limit(1));
      return l[0] || null;
    },
    /* última versão de cada material de uma lista (para o editor / linha) */
    async ultimasAprovacoes(tipo, alvoIds) {
      if (!alvoIds || !alvoIds.length) return {};
      const linhas = ok(await sb().from('aprovacoes_painel').select('*')
        .eq('tipo', tipo).in('alvo_id', alvoIds).order('versao', { ascending: false }));
      const por = {};
      linhas.forEach(a => { if (!por[a.alvo_id]) por[a.alvo_id] = a; });
      return por;
    },
    async eventosDaAprovacao(id) {
      return ok(await sb().from('eventos_dominio').select('*').eq('aprovacao_id', id)
        .order('created_at', { ascending: true }));
    },
    async reprocessarEvento(id) { return this.rpc('aprov_reprocessar', { p_evento_id: id }); },

    /* ---- notificações ---- */
    async notificacoes({ limite = 30, antesDe } = {}) {
      let q = sb().from('notificacoes').select('*').order('created_at', { ascending: false }).limit(limite);
      if (antesDe) q = q.lt('created_at', antesDe);
      return ok(await q);
    },
    async notificacoesNaoLidas() {
      const { count, error } = await sb().from('notificacoes')
        .select('id', { count: 'exact', head: true }).is('lida_em', null);
      if (error) throw error;
      return count || 0;
    },
    async marcarLida(id) { return this.rpc('notif_marcar_lida', { p_id: id }); },
    async marcarTodasLidas() { return this.rpc('notif_marcar_todas', {}); },
    /* mais recente não lida — usada só para decidir se toca o som de
       "cheguei e tem coisa nova" no login/retorno, sem trazer a lista
       inteira de não lidas (leitura leve, migration_editorial_versao.sql §8) */
    async ultimaNaoLida() {
      const { data, error } = await sb().from('notificacoes').select('id, created_at')
        .is('lida_em', null).order('created_at', { ascending: false }).limit(1);
      if (error) throw error;
      return (data && data[0]) || null;
    },

    /* ---- presença e preferências (migration_presenca.sql) ---- */
    async heartbeat() { return this.rpc('perfil_heartbeat', {}); },
    async gravarPreferencias(patch) { return this.rpc('perfil_preferencias_gravar', { p: patch || {} }); },

    /* ---- push (migration_push.sql) ---- */
    async registrarPush(sub) {
      return this.rpc('push_registrar', {
        p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth,
        p_user_agent: (navigator.userAgent || '').slice(0, 300)
      });
    },
    async removerPush(endpoint) {
      const { error } = await sb().from('push_subscricoes').delete().eq('endpoint', endpoint);
      if (error) throw error;
    },
    async temPush(endpoint) {
      const { count, error } = await sb().from('push_subscricoes')
        .select('id', { count: 'exact', head: true }).eq('endpoint', endpoint);
      if (error) throw error;
      return (count || 0) > 0;
    },

    /* ---- Realtime ----
       Devolve o canal (ou null sem Realtime). Quem assina é responsável
       por chamar B7.DB.fecharCanal ao sair da tela. */
    canal(nome, assinaturas, aoMudar) {
      try {
        if (!sb().channel) return null;
        let c = sb().channel(nome);
        (assinaturas || []).forEach(a => {
          c = c.on('postgres_changes', Object.assign({ event: '*', schema: 'public' }, a), p => aoMudar(p));
        });
        c.subscribe();
        return c;
      } catch (e) { return null; }
    },
    fecharCanal(c) {
      if (!c) return;
      try { sb().removeChannel(c); } catch (e) { try { c.unsubscribe(); } catch (x) {} }
    },

    async partesDaAprovacao(id) {
      return ok(await sb().from('aprovacao_partes').select('*').eq('aprovacao_id', id));
    },

    async comentariosAprovacao(id) {
      return ok(await sb().from('comentarios').select('*')
        .eq('aprovacao_id', id).order('created_at', { ascending: true }));
    },

    async comentarAprovacao(aprovacaoId, texto, { parteId, parteRotulo } = {}) {
      const u = window.B7 && B7.Auth && B7.Auth.usuario();
      ok(await sb().from('comentarios').insert([{
        aprovacao_id: aprovacaoId,
        parte_id: parteId || null,
        parte_rotulo: parteRotulo || null,
        autor_id: u ? u.id : null,
        autor_nome: u ? u.nome : 'Equipe',
        autor_papel: u ? u.papel : null,
        texto
      }]));
    },

    async resolverComentario(id) {
      const u = window.B7 && B7.Auth && B7.Auth.usuario();
      ok(await sb().from('comentarios').update({
        resolvido: true, resolvido_em: new Date().toISOString(),
        resolvido_por: u ? u.id : null
      }).eq('id', id));
    },

    /* o que a equipe já enviou de um material, para não reenviar à toa */
    async aprovacoesDoMaterial(tipo, alvoId) {
      return ok(await sb().from('aprovacoes').select('*')
        .eq('tipo', tipo).eq('alvo_id', alvoId).is('deleted_at', null)
        .order('versao', { ascending: false }));
    },

    async itensDoStatus(reportId) {
      return ok(await sb().from('status_itens').select('*')
        .eq('report_id', reportId).is('deleted_at', null)
        .order('data', { ascending: true }).order('position', { ascending: true }));
    },

    /* As consultas do portal recebem o client_id da empresa escolhida.
       Para o cliente isso é redundante com o RLS (posso_ver_cliente
       corta o resto) — o filtro existe para a PRÉVIA do admin, que é
       equipe e passaria sem corte, ler exatamente o conjunto do cliente.
       Os filtros de liberação (visivel_cliente, publicado_em) ficam
       repetidos aqui pela mesma razão. Tudo somente leitura. */

    async conteudosVisiveis(clientId) {
      let q = sb().from('conteudos').select('*')
        .eq('visivel_cliente', true).is('deleted_at', null);
      if (clientId) q = q.eq('client_id', clientId);
      return ok(await q.order('data_postagem', { ascending: true }).limit(60));
    },

    async linhaVisivelAtual(clientId) {
      let q = sb().from('linhas_editoriais').select('*')
        .eq('visivel_cliente', true).is('deleted_at', null);
      if (clientId) q = q.eq('client_id', clientId);
      const linhas = ok(await q.order('ano', { ascending: false }).order('mes', { ascending: false }).limit(1));
      return linhas[0] || null;
    },

    /* view portal_status: só publicado (migration_portal_v2.sql) */
    async ultimoStatusPublicado(clientId) {
      const lista = await this.statusPublicados(clientId, 1);
      return lista[0] || null;
    },
    async statusPublicados(clientId, limite = 40) {
      let q = sb().from('portal_status').select('*');
      if (clientId) q = q.eq('client_id', clientId);
      return ok(await q.order('semana_inicio', { ascending: false }).limit(limite));
    },

    /* view portal_producao: conteúdos liberados com status amigável
       (em_producao | em_revisao | aguardando_voce | aprovado |
       programado | publicado) e a aprovação atual, sem nada interno */
    async producaoDoCliente(clientId, limite = 200) {
      let q = sb().from('portal_producao').select('*');
      if (clientId) q = q.eq('client_id', clientId);
      return ok(await q.order('data_postagem', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false }).limit(limite));
    },

    /* view portal_gravacoes: só gravações liberadas (visivel_cliente),
       com nome, data opcional, situação amigável e roteiros por título */
    async gravacoesDoCliente(clientId, limite = 60) {
      let q = sb().from('portal_gravacoes').select('*');
      if (clientId) q = q.eq('client_id', clientId);
      return ok(await q.order('data_gravacao', { ascending: false, nullsFirst: false }).limit(limite));
    },

    /* equipe: libera ou recolhe uma gravação do portal */
    async liberarGravacao(id, visivel) {
      return this.rpc('gravacao_liberar_portal', { p_id: id, p_visivel: !!visivel });
    },

    /* ======================================================= KANBAN
       O quadro lê a view kanban_resumo (resumo por card, já com nome do
       cliente, responsável e contagem de ajustes pendentes). O detalhe
       carrega o resto só quando a gaveta abre. */

    /* ativas + concluídas dos últimos 30 dias (histórico limitado) */
    async listarDemandas() {
      const corte = new Date(Date.now() - 30 * 86400000).toISOString();
      return ok(await sb().from('kanban_resumo').select('*')
        .is('deleted_at', null).is('arquivada_em', null)
        .or('concluida_em.is.null,concluida_em.gte.' + corte)
        .order('posicao', { ascending: true }).limit(1000));
    },

    /* uma demanda pela view — usada pelo Realtime para trocar só a linha
       que mudou, e para reler depois de salvar */
    async demandas(ids) {
      if (!ids || !ids.length) return [];
      return ok(await sb().from('kanban_resumo').select('*').in('id', ids));
    },
    async demanda(id) {
      const l = await this.demandas([id]);
      return l[0] || null;
    },

    async criarDemanda(campos) {
      const u = window.B7 && B7.Auth && B7.Auth.usuario();
      if (u && !campos.criado_por) campos.criado_por = u.id;
      const linhas = ok(await sb().from('kanban_demandas').insert([campos]).select());
      return linhas[0];
    },

    async atualizarDemanda(id, campos) {
      ok(await sb().from('kanban_demandas').update(campos).eq('id', id));
    },

    /* mover = coluna + posição + histórico numa transação no banco
       (kanban_mover, migration_kanban_v2). Devolve a linha gravada. */
    async moverDemanda(id, coluna, posicao) {
      return this.rpc('kanban_mover', {
        p_id: id, p_coluna: coluna, p_posicao: posicao == null ? null : posicao
      });
    },

    async excluirDemanda(id) {
      ok(await sb().from('kanban_demandas')
        .update({ deleted_at: new Date().toISOString() }).eq('id', id));
    },

    async demandasDoMaterial(tipo, id) {
      return ok(await sb().from('kanban_demandas').select('*')
        .eq('tipo_vinculo', tipo).eq('vinculo_id', id).is('deleted_at', null));
    },

    async comentariosDemanda(id) {
      return ok(await sb().from('kanban_comentarios').select('*')
        .eq('demanda_id', id).order('created_at', { ascending: true }));
    },

    async comentarDemanda(id, texto, autorNome) {
      const u = window.B7 && B7.Auth && B7.Auth.usuario();
      ok(await sb().from('kanban_comentarios')
        .insert([{ demanda_id: id, texto, autor_nome: autorNome || (u ? u.nome : 'Equipe'),
                   autor_id: u ? u.id : null }]));
    },

    async resolverNotaDemanda(id, resolvido) {
      ok(await sb().from('kanban_comentarios')
        .update({ resolvido_em: resolvido ? new Date().toISOString() : null }).eq('id', id));
    },

    async historicoDemanda(id) {
      return ok(await sb().from('kanban_historico').select('*')
        .eq('demanda_id', id).order('created_at', { ascending: false }).limit(100));
    },

    async registrarKanban(id, de, para, campo) {
      const u = window.B7 && B7.Auth && B7.Auth.usuario();
      ok(await sb().from('kanban_historico').insert([{
        demanda_id: id, de, para, campo: campo || 'coluna',
        autor_nome: u ? u.nome : null, autor_id: u ? u.id : null
      }]));
    },

    /* tudo o que a gaveta de detalhe precisa, em paralelo: notas internas,
       histórico e — se há aprovação — cenas decididas, comentários do
       cliente e eventos da versão ativa */
    async detalheDemanda(d) {
      const vazio = () => [];
      const [notas, historico, partes, comentarios, eventos] = await Promise.all([
        this.comentariosDemanda(d.id).catch(vazio),
        this.historicoDemanda(d.id).catch(vazio),
        d.aprovacao_id ? this.partesDaAprovacao(d.aprovacao_id).catch(vazio) : vazio(),
        d.aprovacao_id ? this.comentariosAprovacao(d.aprovacao_id).catch(vazio) : vazio(),
        d.aprovacao_id ? this.eventosDaAprovacao(d.aprovacao_id).catch(vazio) : vazio()
      ]);
      return { notas, historico, partes, comentarios, eventos };
    },

    /* materiais de um cliente que uma demanda manual pode apontar */
    async materiaisParaVinculo(clienteId) {
      if (!clienteId) return [];
      const vazio = () => [];
      const [roteiros, linhas, gravacoes] = await Promise.all([
        this.roteirosDoCliente(clienteId, 40).catch(vazio),
        this.listarLinhas(clienteId).catch(vazio),
        this.listarGravacoes(clienteId).catch(vazio)
      ]);
      return [].concat(
        roteiros.map(r => ({ tipo: 'roteiro', id: r.id, titulo: r.titulo || 'Sem título',
                             extra: r.gravacao ? r.gravacao.nome : '' })),
        linhas.map(l => ({ tipo: 'linha', id: l.id, titulo: l.nome || 'Linha editorial',
                           extra: l.mes && l.ano ? l.mes + '/' + l.ano : '' })),
        gravacoes.map(g => ({ tipo: 'gravacao', id: g.id, titulo: g.nome || 'Gravação', extra: g.status || '' }))
      );
    },

    /* quem pode ser responsável: a equipe interna, não os clientes */
    async listarEquipe() {
      return ok(await sb().from('perfis').select('id, nome, papel')
        .in('papel', ['admin', 'coordenador']).eq('estado', 'ativa')
        .order('nome', { ascending: true }));
    },

    /* ---- banco de ideias ---- */
    async listarIdeias(clienteId) {
      return ok(await sb().from('ideias').select('*')
        .eq('client_id', clienteId).is('deleted_at', null)
        .order('updated_at', { ascending: false }));
    },
    async criarIdeia(dados) {
      const linhas = ok(await sb().from('ideias').insert([dados]).select());
      return linhas[0];
    },
    async atualizarIdeia(id, patch) {
      return ok(await sb().from('ideias').update(patch).eq('id', id).select());
    },
    async excluirIdeia(id) {
      return ok(await sb().from('ideias')
        .update({ deleted_at: new Date().toISOString() }).eq('id', id));
    },

    /* ---- slides (carrossel) e frames (stories) ---- */
    async listarSlides(conteudoId) {
      return ok(await sb().from('slides').select('*').eq('content_id', conteudoId).order('position'));
    },
    async criarSlide(dados) {
      const linhas = ok(await sb().from('slides').insert([dados]).select());
      return linhas[0];
    },
    async atualizarSlide(id, patch) {
      return ok(await sb().from('slides').update(patch).eq('id', id).select());
    },
    async excluirSlide(id) { return ok(await sb().from('slides').delete().eq('id', id)); },

    async listarFrames(conteudoId) {
      return ok(await sb().from('frames').select('*').eq('content_id', conteudoId).order('position'));
    },
    async criarFrame(dados) {
      const linhas = ok(await sb().from('frames').insert([dados]).select());
      return linhas[0];
    },
    async atualizarFrame(id, patch) {
      return ok(await sb().from('frames').update(patch).eq('id', id).select());
    },
    async excluirFrame(id) { return ok(await sb().from('frames').delete().eq('id', id)); },

    /* Todas as linhas de todos os clientes, para a visão global. Usa a
       mesma view que já traz nome do cliente e contagem de conteúdos. */
    async listarTodasLinhas(limite) {
      return ok(await sb().from('linhas_resumo').select('*')
        .is('deleted_at', null)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(limite || 60));
    },

    /* ---- banco de ideias ---- */
    async listarIdeias(clienteId) {
      return ok(await sb().from('ideias').select('*')
        .eq('client_id', clienteId).is('deleted_at', null)
        .order('updated_at', { ascending: false }));
    },
    async criarIdeia(dados) {
      const linhas = ok(await sb().from('ideias').insert([dados]).select());
      return linhas[0];
    },
    async atualizarIdeia(id, patch) {
      return ok(await sb().from('ideias').update(patch).eq('id', id).select());
    },
    async excluirIdeia(id) {
      return ok(await sb().from('ideias')
        .update({ deleted_at: new Date().toISOString() }).eq('id', id));
    },

    /* ------------------------------------------------------- BUSCA */
    async buscar(termo) {
      const t = `%${termo.trim()}%`;
      /* Busca no título de tudo e também no texto das cenas: quem procura
         "cashback" quase sempre lembra da fala, não do nome do roteiro.
         As tabelas novas podem não existir ainda — falha nelas não derruba
         a busca inteira. */
      const opcional = q => q.then(r => r.error ? { data: [] } : r, () => ({ data: [] }));
      const [clientes, gravacoes, roteiros, cenas, linhas, conteudos, ideias,
             semanas] = await Promise.all([
        sb().from('clientes_resumo').select('*').ilike('nome', t).is('deleted_at', null).limit(6),
        sb().from('gravacoes_resumo').select('*').ilike('nome', t).is('deleted_at', null).limit(8),
        sb().from('roteiros').select('id,titulo,recording_session_id').ilike('titulo', t)
          .is('deleted_at', null).limit(8),
        opcional(sb().from('cenas').select('id,script_id,texto,funcao').ilike('texto', t).limit(8)),
        opcional(sb().from('linhas_resumo').select('*').ilike('nome', t).is('deleted_at', null).limit(6)),
        opcional(sb().from('conteudos').select('id,titulo,tipo,linha_id')
          .ilike('titulo', t).is('deleted_at', null).limit(8)),
        opcional(sb().from('ideias').select('id,titulo,client_id,status')
          .ilike('titulo', t).is('deleted_at', null).limit(6)),
        opcional(sb().from('status_resumo')
          .select('id,cliente_nome,semana_inicio,semana_fim,total_itens')
          .ilike('cliente_nome', t).is('deleted_at', null)
          .order('semana_inicio', { ascending: false }).limit(4))
      ]);

      /* as cenas encontradas precisam do roteiro para poder abrir */
      let cenasCom = [];
      const achadas = cenas.data || [];
      if (achadas.length) {
        const ids = [...new Set(achadas.map(c => c.script_id))];
        /* roteiro na lixeira não volta na busca: a cena some junto */
        const rs = await sb().from('roteiros').select('id,titulo,recording_session_id')
          .in('id', ids).is('deleted_at', null);
        const mapa = {};
        (rs.data || []).forEach(r => mapa[r.id] = r);
        cenasCom = achadas.map(c => ({ ...c, roteiro: mapa[c.script_id] })).filter(c => c.roteiro);
      }

      return {
        clientes: clientes.data || [],
        gravacoes: gravacoes.data || [],
        roteiros: roteiros.data || [],
        cenas: cenasCom,
        linhas: linhas.data || [],
        conteudos: conteudos.data || [],
        ideias: ideias.data || [],
        semanas: semanas.data || []
      };
    },

    /* ------------------------------------------------------ RESUMO */
    async resumo() {
      /* lixeira e arquivados ficam fora de todos os totais, para os
         números baterem com as listas */
      const conta = async (tabela, filtro) => {
        let q = sb().from(tabela).select('id', { count: 'exact', head: true }).is('deleted_at', null);
        if (tabela !== 'clientes') q = q.is('archived_at', null);
        if (filtro) q = filtro(q);
        const { count, error } = await q;
        if (error) throw error;
        return count || 0;
      };
      const inicioMes = new Date();
      inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
      const [clientes, gravacoes, roteiros, mes, rascunho, pronto, gravado] = await Promise.all([
        conta('clientes'), conta('gravacoes'), conta('roteiros'),
        conta('roteiros', q => q.gte('created_at', inicioMes.toISOString())),
        conta('gravacoes', q => q.eq('status', 'Rascunho')),
        conta('gravacoes', q => q.eq('status', 'Pronto para gravar')),
        conta('gravacoes', q => q.eq('status', 'Gravado'))
      ]);
      /* "em andamento" = tudo que ainda não foi gravado; é o número que
         interessa na operação, mais do que um total acumulado */
      return { clientes, gravacoes, roteiros, mes,
               rascunho, pronto, gravado, andamento: rascunho + pronto };
    },

    /* roteiros mexidos por último, com a gravação e o cliente de cada um */
    async roteirosRecentes(limite = 8) {
      const roteiros = ok(await sb().from('roteiros')
        .select('id,titulo,objetivo,status,recording_session_id,updated_at')
        .is('deleted_at', null).is('archived_at', null)
        .order('updated_at', { ascending: false }).limit(limite));
      if (!roteiros.length) return [];
      const ids = [...new Set(roteiros.map(r => r.recording_session_id))];
      const gravacoes = ok(await sb().from('gravacoes_resumo').select('*').in('id', ids));
      const porId = {};
      gravacoes.forEach(g => porId[g.id] = g);
      return roteiros.map(r => ({ ...r, gravacao: porId[r.recording_session_id] || null }));
    },

    /* ------------------------------------------------------ BACKUP */
    /* Backup versão 2: inclui a Central de Conteúdo. Um arquivo da versão 1
       continua sendo importável — as tabelas novas simplesmente vêm vazias. */
    async exportarTudo() {
      const TABELAS = ['clientes', 'gravacoes', 'roteiros', 'cenas',
        'cliente_inteligencia', 'produtos', 'provas', 'onboardings',
        'linhas_editoriais', 'pilares', 'conteudos', 'slides', 'frames', 'ideias',
        /* status semanal — versões exportadas entram; nada de cache */
        'status_semanais', 'status_itens', 'status_versoes',
        /* atividade, portal do cliente e quadro de produção. Perfis e
           identidades NÃO entram: senha e sessão vivem só no Supabase. */
        'atividades', 'perfil_clientes', 'aprovacoes', 'aprovacao_partes', 'comentarios',
        'kanban_demandas', 'kanban_comentarios', 'kanban_historico'];
      const pacote = { formato: 'roteiros-b7-backup', versao: 5,
                       gerado_em: new Date().toISOString() };
      for (const t of TABELAS) {
        const r = await sb().from(t).select('*');
        /* uma tabela que ainda não existe no banco não invalida o backup */
        if (r.error) {
          if (['clientes', 'gravacoes', 'roteiros', 'cenas'].includes(t)) throw r.error;
          pacote[t] = [];
          continue;
        }
        pacote[t] = r.data;
      }
      return pacote;
    },

    /* ======================================================= DESIGN
       Tudo lê a view design_resumo (já com cliente, linha, designer e
       última versão). Toda escrita relevante passa por função do banco
       (migration_design.sql) — mesmo padrão de Aprovações/Kanban: a
       tabela em si só aceita SELECT. */

    async listarDesign(filtros) {
      let q = sb().from('design_resumo').select('*');
      if (filtros) {
        if (filtros.designerId) q = q.eq('designer_id', filtros.designerId);
        if (filtros.clienteId) q = q.eq('client_id', filtros.clienteId);
        if (filtros.linhaId) q = q.eq('linha_id', filtros.linhaId);
        if (filtros.status) q = q.eq('status', Array.isArray(filtros.status) ? filtros.status[0] : filtros.status);
        if (filtros.statusIn) q = q.in('status', filtros.statusIn);
        if (filtros.semResponsavel) q = q.is('designer_id', null);
      }
      return ok(await q.order('updated_at', { ascending: false }).limit(500));
    },

    async design(id) {
      return ok(await sb().from('design_resumo').select('*').eq('id', id).single());
    },

    async designDoConteudo(conteudoId) {
      return ok(await sb().from('design_resumo').select('*').eq('conteudo_id', conteudoId));
    },

    async designProducaoDaLinha(linhaId) {
      const l = ok(await sb().from('design_producao_linha').select('*').eq('linha_id', linhaId));
      return l[0] || { linha_id: linhaId, total: 0, aguardando: 0, em_criacao: 0, em_revisao: 0, em_ajustes: 0, aprovadas: 0, finalizadas: 0 };
    },

    async gerarDesignDaLinha(linhaId) {
      return this.rpc('design_gerar_da_linha', { p_linha_id: linhaId });
    },
    async gerarDesignDoConteudo(conteudoId) {
      return this.rpc('design_gerar_do_conteudo', { p_conteudo_id: conteudoId });
    },
    async criarDesignManual(campos) {
      return this.rpc('design_criar_manual', {
        p_titulo: campos.titulo, p_client_id: campos.clientId || null,
        p_tipo: campos.tipo || 'outro', p_descricao: campos.descricao || '',
        p_designer_id: campos.designerId || null, p_prazo: campos.prazo || null,
        p_prioridade: campos.prioridade || 'normal'
      });
    },
    async atribuirDesign(deliverableId, designerId) {
      return this.rpc('design_atribuir', { p_deliverable_id: deliverableId, p_designer_id: designerId });
    },
    async definirPrazoPrioridadeDesign(deliverableId, prazo, prioridade) {
      return this.rpc('design_definir_prazo_prioridade', { p_deliverable_id: deliverableId, p_prazo: prazo || null, p_prioridade: prioridade });
    },

    async versoesDesign(deliverableId) {
      return ok(await sb().from('design_versoes').select('*').eq('deliverable_id', deliverableId).order('numero', { ascending: false }));
    },
    async arquivosVersaoDesign(versaoId) {
      return ok(await sb().from('design_arquivos').select('*').eq('versao_id', versaoId).order('papel').order('posicao'));
    },
    async criarRascunhoDesign(deliverableId) {
      return this.rpc('design_versao_rascunho', { p_deliverable_id: deliverableId });
    },
    async registrarArquivoDesign({ versaoId, papel, nome, caminho, mime, tamanho, caminhoThumb, parte, largura, altura }) {
      return this.rpc('design_arquivo_registrar', {
        p_versao_id: versaoId, p_papel: papel, p_nome: nome,
        p_caminho: caminho, p_mime: mime || null, p_tamanho: tamanho || null,
        p_caminho_thumb: caminhoThumb || null,
        p_parte_tipo: parte ? parte.tipo : null, p_parte_id: parte ? parte.id : null,
        p_parte_posicao: parte ? parte.posicao : null,
        p_largura: largura || null, p_altura: altura || null
      });
    },
    /* todos os arquivos de todas as versões da peça, com o número/estado
       da versão junto — a base do "arquivo efetivo por slide" (calculado
       no cliente com a MESMA regra de design_arquivos_efetivos: preview
       mais recente de versão já enviada) e do histórico por slide */
    async arquivosDesign(deliverableId, versoes) {
      const ids = (versoes || []).map(v => v.id);
      if (!ids.length) return [];
      const lista = ok(await sb().from('design_arquivos').select('*').in('versao_id', ids).order('created_at'));
      const porVersao = new Map(versoes.map(v => [v.id, v]));
      return lista.map(a => {
        const v = porVersao.get(a.versao_id) || {};
        return Object.assign({}, a, { versao_numero: v.numero, versao_estado: v.estado });
      });
    },
    /* nomes de quem decidiu (revisado_por) pra linha do tempo por slide —
       equipe + designers; RLS de perfis vale normalmente */
    async nomesPerfis(ids) {
      const lista = [...new Set((ids || []).filter(Boolean))];
      if (!lista.length) return {};
      const linhas = ok(await sb().from('perfis').select('id, nome').in('id', lista));
      const m = {}; linhas.forEach(l => { m[l.id] = l.nome; }); return m;
    },
    /* decisões do cliente sobre a peça (linhas de `aprovacoes`, tipo
       design_versao) — Portal ou registradas pela B7; RLS de aprovacoes
       vale (designer pode não enxergar: cai em []) */
    async aprovacoesDesign(deliverableId) {
      return ok(await sb().from('aprovacoes').select('*').eq('tipo', 'design_versao').eq('alvo_id', deliverableId)
        .is('deleted_at', null).order('versao', { ascending: false }));
    },
    /* Registrar decisão do cliente (Admin/Coordenador) — decisao:
       'enviado' | 'aprovado' | 'ajustes' | 'recusado'; canal: whatsapp |
       ligacao | reuniao | presencial | outro; partes: [{parte_id, mensagem}] */
    async registrarDecisaoClienteDesign(deliverableId, decisao, canal, observacao, partes) {
      return this.rpc('design_registrar_decisao_cliente', {
        p_deliverable_id: deliverableId, p_decisao: decisao, p_canal: canal || 'whatsapp',
        p_observacao: observacao || null, p_partes: partes || []
      });
    },
    async removerArquivoRascunhoDesign(arquivoId) {
      return this.rpc('design_arquivo_remover_rascunho', { p_arquivo_id: arquivoId });
    },
    async revisarParteDesign(arquivoId, decisao, mensagem) {
      return this.rpc('design_parte_revisar', { p_arquivo_id: arquivoId, p_decisao: decisao, p_mensagem: mensagem || null });
    },
    async fecharRevisaoDesign(versaoId) {
      return this.rpc('design_revisao_fechar', { p_versao_id: versaoId });
    },
    /* via: 'upload' (padrão — exige ao menos 1 arquivo já registrado) ou
       'externa' (arte revisada fora do sistema, ex. WhatsApp — nenhum
       arquivo é exigido; canal é uma anotação opcional). */
    async enviarVersaoDesign(versaoId, observacao, via, canal) {
      return this.rpc('design_versao_enviar', {
        p_versao_id: versaoId, p_observacao: observacao || '',
        p_via: via === 'externa' ? 'externa' : 'upload',
        p_canal: via === 'externa' ? (canal || null) : null
      });
    },
    async assumirDemandaLinha(linhaId) {
      return this.rpc('design_assumir_demanda_linha', { p_linha_id: linhaId });
    },
    /* Conclusão formal da Linha Editorial (gatilho oficial que libera as
       demandas de Design — migration_editorial_versao.sql). responsavelId
       null = fica em "Demandas a fazer" para qualquer Designer assumir. */
    async concluirLinha(linhaId, responsavelId) {
      return this.rpc('linha_concluir', { p_linha_id: linhaId, p_responsavel_design_id: responsavelId || null });
    },
    async versoesDaLinha(linhaId) {
      return ok(await sb().from('linha_versoes').select('id, versao, concluida_em, concluida_por, responsavel_design_id')
        .eq('linha_id', linhaId).order('versao', { ascending: false }));
    },
    async solicitarAjusteDesign(versaoId, mensagem) {
      return this.rpc('design_solicitar_ajuste', { p_versao_id: versaoId, p_mensagem: mensagem });
    },
    async aprovarInternoDesign(versaoId) {
      return this.rpc('design_aprovar_interno', { p_versao_id: versaoId });
    },
    async finalizarDesign(deliverableId) {
      return this.rpc('design_finalizar', { p_deliverable_id: deliverableId });
    },
    async enviarClienteDesign(versaoId, observacao) {
      return this.rpc('design_enviar_cliente', { p_versao_id: versaoId, p_observacao: observacao || '' });
    },

    /* histórico da peça: eventos_dominio não é exposto por RLS ampla ao
       designer, então a timeline vem das próprias versões + notificações
       que o usuário tem direito de ver (mesma base de dados, sem
       segundo sistema de auditoria). */
    async historicoDesign(deliverableId) {
      const [versoes, notifs] = await Promise.all([
        this.versoesDesign(deliverableId),
        ok(await sb().from('notificacoes').select('*')
          .eq('link', '#/design/' + deliverableId).order('created_at', { ascending: true }))
      ]);
      const [arquivos, aprovacoes] = await Promise.all([
        this.arquivosDesign(deliverableId, versoes).catch(() => []),
        this.aprovacoesDesign(deliverableId).catch(() => [])
      ]);
      return { versoes, notificacoes: notifs, arquivos, aprovacoes };
    },

    /* envia um blob qualquer pro bucket design-files, num caminho já
       pronto — usado tanto pro arquivo original (com progresso) quanto
       pra miniatura gerada localmente (sem progresso, é pequena). Fatorei
       daqui de dentro de enviarArquivoDesign pra não duplicar a parte
       chata (headers, token, XHR) quando a miniatura entrou (Rodada 5). */
    async _subirArquivoStorage(caminho, blob, mime, aoProgredir) {
      const cfg = window.B7_CONFIG || {};
      const base = String(cfg.SUPABASE_URL || '').trim().replace(/\/+$/, '');
      const chave = String(cfg.SUPABASE_PUBLISHABLE_KEY || '').trim();
      const sess = await sb().auth.getSession();
      const token = sess && sess.data && sess.data.session && sess.data.session.access_token;
      const url = base + '/storage/v1/object/design-files/' + encodeURI(caminho);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('apikey', chave);
        xhr.setRequestHeader('Authorization', 'Bearer ' + (token || chave));
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('Content-Type', mime || 'application/octet-stream');
        xhr.upload.onprogress = (e) => {
          if (aoProgredir && e.lengthComputable) aoProgredir(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            let msg = 'O envio falhou (HTTP ' + xhr.status + ').';
            try { const j = JSON.parse(xhr.responseText); if (j && j.message) msg = j.message; } catch (_e) {}
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error('O envio foi interrompido. Confira a conexão e tente novamente.'));
        xhr.send(blob);
      });
    },

    /* miniatura local (Rodada 5) — gerada no navegador, NUNCA no
       servidor: evita depender de transformação de imagem paga do
       Storage e mantém tudo funcionando em qualquer plano do Supabase.
       Só pra formatos raster comuns (jpeg/png/webp/gif); qualquer outra
       coisa (vídeo, PDF, arquivo de design nativo) retorna null — o
       card mostra o ícone por formato em vez de tentar montar uma
       miniatura que não existe. Lado maior limitado a 320px, JPEG 0.72
       — pequeno o bastante pra nunca pesar no card de 52px nem na
       bolinha do navegador, grande o bastante pra dar uma ideia real da
       arte. Retorna null (nunca lança) se o navegador não conseguir
       decodificar — a peça continua acessível pelo arquivo original. */
    async _gerarMiniaturaImagem(arquivo, ladoMax) {
      const okMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(arquivo.type);
      if (!okMime) return null;
      /* Arquivos 2.0: as dimensões reais da arte vão junto do registro —
         a prévia grande reserva a proporção certa antes mesmo de a
         imagem chegar. Medidas aqui de carona na decodificação da
         miniatura (mesmo bitmap), sem decodificar duas vezes. */
      this._ultimaMedida = null;
      try {
        let bitmap;
        if ('createImageBitmap' in window) {
          bitmap = await createImageBitmap(arquivo);
        } else {
          const urlObj = URL.createObjectURL(arquivo);
          try {
            bitmap = await new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => reject(new Error('decodificação falhou'));
              img.src = urlObj;
            });
          } finally { URL.revokeObjectURL(urlObj); }
        }
        const largura = bitmap.width || bitmap.naturalWidth, altura = bitmap.height || bitmap.naturalHeight;
        if (!largura || !altura) return null;
        this._ultimaMedida = { largura, altura };
        const escala = Math.min(1, ladoMax / Math.max(largura, altura));
        const w = Math.max(1, Math.round(largura * escala)), h = Math.max(1, Math.round(altura * escala));
        const tela = document.createElement('canvas');
        tela.width = w; tela.height = h;
        const ctx = tela.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, w, h);
        if (bitmap.close) bitmap.close();
        const blob = await new Promise(resolve => tela.toBlob(resolve, 'image/jpeg', 0.72));
        return blob || null;
      } catch (e) { return null; /* nunca bloqueia o upload do arquivo original por isso */ }
    },

    /* upload de arquivo de Design — Storage privado (bucket design-files),
       caminho "<deliverable_id>/<versao_id>/<arquivo>". Progresso real via
       XHR (o cliente supabase-js não expõe progresso em upload()).
       Rodada 5: se o arquivo for uma imagem, sobe também uma miniatura
       pequena (gerada localmente) no mesmo caminho + "-thumb.jpg" — o
       card na fila passa a baixar ela, não o arquivo original inteiro.
       Se a miniatura não puder ser gerada (formato não suportado, falha
       de decodificação), o upload segue normal, só sem thumb — sem
       bloquear ninguém por causa de uma otimização. */
    async enviarArquivoDesign({ deliverableId, versaoId, arquivo, papel, parte, aoProgredir }) {
      const nomeSeguro = arquivo.name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-140);
      const caminho = deliverableId + '/' + versaoId + '/' + Date.now() + '-' + nomeSeguro;

      await this._subirArquivoStorage(caminho, arquivo, arquivo.type, aoProgredir);

      let caminhoThumb = null;
      const miniatura = await this._gerarMiniaturaImagem(arquivo, 320);
      const medida = this._ultimaMedida || {};
      if (miniatura) {
        caminhoThumb = caminho + '-thumb.jpg';
        try { await this._subirArquivoStorage(caminhoThumb, miniatura, 'image/jpeg'); }
        catch (e) { caminhoThumb = null; /* card cai pro arquivo original */ }
      }

      /* Arquivos 2.0: `parte` = { tipo:'slide'|'frame', id, posicao } vincula
         o arquivo ao slide/frame canônico (id estável da Linha Editorial —
         nunca posição de array). Peça de arte única manda parte = null. */
      const id = await this.registrarArquivoDesign({
        versaoId, papel, nome: arquivo.name, caminho, mime: arquivo.type, tamanho: arquivo.size, caminhoThumb,
        parte: parte || null, largura: medida.largura, altura: medida.altura
      });
      /* devolve caminho/mime junto do id — quem acabou de subir o
         arquivo (a fila de upload, antes de a peça ser recarregada do
         banco) precisa disso pra poder abrir uma prévia na hora, sem
         esperar um refresh de `drawer.extra`. */
      return { id, caminho, mime: arquivo.type };
    },

    /* Baixa o ARQUIVO ORIGINAL (bytes intactos, nunca a miniatura) como
       blob, pela mesma URL assinada de curta duração — o bucket continua
       privado e quem não enxerga a peça não consegue assinar a URL
       (política de select do Storage passa por design_pode_acessar). */
    async baixarArquivoDesign(caminho) {
      const url = await this.urlArquivoDesign(caminho);
      const r = await fetch(url);
      if (!r.ok) throw new Error('Não foi possível baixar o arquivo (HTTP ' + r.status + ').');
      return r.blob();
    },

    /* design_resumo não expõe a descrição (só interessa às peças manuais,
       que não têm conteúdo canônico) — lida direto da tabela base. */
    async descricaoDesign(deliverableId) {
      const l = ok(await sb().from('design_deliverables').select('descricao').eq('id', deliverableId).single());
      return (l && l.descricao) || '';
    },

    urlArquivoDesign(caminho) {
      /* Storage privado: sem URL pública. A visualização passa por
         createSignedUrl, curta duração, pedida na hora de abrir. */
      return sb().storage.from('design-files').createSignedUrl(caminho, 60 * 10)
        .then(({ data, error }) => { if (error) throw error; return data.signedUrl; });
    },

    /* =================================================================
       B7 VÍDEO / VIDEOMAKER — Parte 1
       Mesmo padrão do Design: leitura direta nas views/RLS, toda
       escrita passa por função (migration_video.sql).
       ================================================================= */
    /* videomakers_elegiveis (migration_video_producao.sql) já é a
       união de quem tem papel='videomaker' com quem ganhou a FUNÇÃO
       EXTRA "videomaker" (ex.: Kevin, admin + videomaker) — não filtra
       mais por igualdade exata de papel. Numa instalação sem essa
       migração a view não existe; cai de volta na consulta antiga. */
    async listarVideomakers() {
      try {
        return ok(await sb().from('videomakers_elegiveis').select('id,nome,avatar_url,estado,papel,funcoes_extra').order('nome'));
      } catch (e) {
        return ok(await sb().from('perfis').select('id,nome,avatar_url,estado')
          .eq('papel', 'videomaker').eq('estado', 'ativa').order('nome'));
      }
    },
    async minhasDemandasVideo() {
      return ok(await sb().from('demandas_edicao_resumo').select('*')
        .order('prazo', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }));
    },
    async demandaVideo(id) {
      return ok(await sb().from('demandas_edicao_resumo').select('*').eq('id', id).single());
    },
    async historicoDemandaVideo(id) {
      return ok(await sb().from('demandas_edicao_eventos').select('*').eq('demanda_id', id).order('created_at', { ascending: true }));
    },
    async criarDemandaVideo({ clienteId, titulo, codigo, competenciaAno, competenciaMes, gravacaoId, videomakerId, pacote, prazo, observacoes, prioridade, roteiroId }) {
      return this.rpc('video_criar_demanda', {
        p_client_id: clienteId, p_titulo: titulo, p_codigo: codigo || '',
        p_competencia_ano: competenciaAno || null, p_competencia_mes: competenciaMes || null,
        p_gravacao_id: gravacaoId || null, p_videomaker_id: videomakerId || null,
        p_pacote: pacote || '', p_prazo: prazo || null, p_observacoes: observacoes || '',
        p_prioridade: prioridade || 'normal', p_roteiro_id: roteiroId || null
      });
    },
    async atribuirVideo(demandaId, videomakerId) {
      return this.rpc('video_atribuir', { p_demanda_id: demandaId, p_videomaker_id: videomakerId || null });
    },
    async mudarStatusVideo(demandaId, status, mensagem) {
      return this.rpc('video_mudar_status', { p_demanda_id: demandaId, p_status: status, p_mensagem: mensagem || null });
    },
    async definirLinkVideo(demandaId, link) {
      return this.rpc('video_definir_link', { p_demanda_id: demandaId, p_link: link || '' });
    },
    async editarDemandaVideo(demandaId, patch) {
      return this.rpc('video_editar_demanda', {
        p_demanda_id: demandaId,
        p_titulo: patch.titulo ?? null, p_codigo: patch.codigo ?? null, p_pacote: patch.pacote ?? null,
        p_prazo: patch.temPrazo ? (patch.prazo || null) : null, p_tem_prazo: !!patch.temPrazo,
        p_observacoes: patch.observacoes ?? null,
        p_gravacao_id: patch.temGravacao ? (patch.gravacaoId || null) : null, p_tem_gravacao: !!patch.temGravacao,
        p_prioridade: patch.prioridade ?? null
      });
    },
    /* gravações de um cliente, para o seletor "vincular a uma gravação"
       na Central do Videomaker (mais recentes primeiro). */
    async gravacoesDoClienteParaVideo(clienteId) {
      return ok(await sb().from('gravacoes').select('id,nome,data_gravacao,situacao,status')
        .eq('client_id', clienteId).order('data_gravacao', { ascending: false }).order('created_at', { ascending: false }));
    },
    async excluirDemandaVideo(demandaId) { return this.rpc('video_excluir_demanda', { p_demanda_id: demandaId }); },

    /* ---- importação de planilha (CSV) ---- */
    async importarPlanilhaVideo(nomeArquivo, linhas) {
      return this.rpc('video_import_criar_lote', { p_nome_arquivo: nomeArquivo || '', p_linhas: linhas || [] });
    },
    async loteImportacaoVideo(loteId) {
      return ok(await sb().from('demandas_edicao_import_lotes').select('*').eq('id', loteId).single());
    },
    async linhasImportacaoVideo(loteId) {
      return ok(await sb().from('demandas_edicao_import_linhas').select('*').eq('lote_id', loteId).order('linha_numero'));
    },
    async resolverLinhaImportacaoVideo(linhaId, clienteId, lembrarApelido) {
      return this.rpc('video_import_resolver_linha', { p_linha_id: linhaId, p_cliente_id: clienteId, p_lembrar_apelido: lembrarApelido !== false });
    },
    async confirmarLinhaImportacaoVideo(linhaId) { return this.rpc('video_import_confirmar_linha', { p_linha_id: linhaId }); },
    async confirmarLoteImportacaoVideo(loteId) { return this.rpc('video_import_confirmar_lote', { p_lote_id: loteId }); },

    /* ---- backfill de competência (migration_video_producao.sql) ---- */
    async backfillCompetenciaVideo() { return this.rpc('video_backfill_competencia', {}); },
    async demandasCompetenciaNaoConfiavelVideo() { return this.rpc('video_demandas_competencia_nao_confiavel', {}); },
    async backfillResponsavelVideo() { return this.rpc('video_backfill_responsavel', {}); },
    async demandasResponsavelNaoConfiavelVideo() { return this.rpc('video_demandas_responsavel_nao_confiavel', {}); },

    /* ---- Workspace de Vídeo — versões, aprovação, entrega (Parte 2, migration_video_workspace.sql) ---- */
    async versoesDemandaVideo(demandaId) {
      return ok(await sb().from('video_versoes_resumo').select('*').eq('demanda_id', demandaId).order('numero', { ascending: false }));
    },
    async criarVersaoVideo(demandaId, { arquivoUrl, arquivoNome, observacao }) {
      return this.rpc('video_criar_versao', {
        p_demanda_id: demandaId, p_arquivo_url: arquivoUrl || '', p_arquivo_nome: arquivoNome || '', p_observacao: observacao || ''
      });
    },
    async enviarParaAprovacaoVideo(demandaId, versaoId) {
      return this.rpc('video_enviar_para_aprovacao', { p_demanda_id: demandaId, p_versao_id: versaoId });
    },
    async registrarDecisaoClienteVideo(versaoId, decisao, canal, observacao) {
      return this.rpc('video_registrar_decisao_cliente', { p_versao_id: versaoId, p_decisao: decisao, p_canal: canal || 'outro', p_observacao: observacao || '' });
    },
    async registrarEntregaVideo(demandaId, versaoId, mensagem) {
      return this.rpc('video_registrar_entrega', { p_demanda_id: demandaId, p_versao_id: versaoId, p_mensagem: mensagem || null });
    },

    /* ---- Comentários com timecode (migration_video_comentarios.sql) ----
       Timecode é digitado por quem comenta (o preview do Drive não expõe
       o tempo do player pra fora do iframe) — ver nota no arquivo SQL. */
    async comentariosVersaoVideo(versaoId) {
      return ok(await sb().from('video_comentarios_resumo').select('*').eq('versao_id', versaoId).order('timecode_seg', { ascending: true }));
    },
    async criarComentarioVideo(versaoId, timecodeSeg, texto) {
      return this.rpc('video_criar_comentario', { p_versao_id: versaoId, p_timecode_seg: timecodeSeg, p_texto: texto });
    },
    async excluirComentarioVideo(comentarioId) {
      return this.rpc('video_excluir_comentario', { p_comentario_id: comentarioId });
    },

    /* ---- Catálogo de pacotes predefinidos (migration_video_pacotes.sql) ----
       Só sugestão pra preencher mais rápido — o campo "Pacote" da
       demanda continua sendo texto livre, sem FK pra cá. */
    async pacotesVideo() {
      return ok(await sb().from('video_pacotes').select('*').order('nome'));
    },
    async criarPacoteVideo(nome) {
      return this.rpc('video_criar_pacote', { p_nome: nome });
    },
    async excluirPacoteVideo(id) {
      return this.rpc('video_excluir_pacote', { p_id: id });
    },
    async definirQuotaPacoteVideo(id, quantidade) {
      return this.rpc('video_definir_quota_pacote', { p_id: id, p_quantidade: quantidade || null });
    },

    /* ---- Gestão, métricas, fechamento mensal, automação (Parte 3,
       migration_video_gestao.sql) ---- */
    async resumoGestaoVideo(ano, mes) {
      return this.rpc('video_gestao_resumo', { p_ano: ano, p_mes: mes });
    },
    async cargaEquipeVideo() {
      return ok(await sb().rpc('video_carga_equipe'));
    },
    async producaoPorClienteVideo(ano, mes) {
      return ok(await sb().rpc('video_producao_por_cliente', { p_ano: ano, p_mes: mes }));
    },
    async relatorioPorVideomakerVideo(ano, mes) {
      return ok(await sb().rpc('video_relatorio_por_videomaker', { p_ano: ano, p_mes: mes }));
    },
    async mesFechadoVideo(ano, mes) {
      return this.rpc('video_mes_fechado', { p_ano: ano, p_mes: mes });
    },
    async fecharMesVideo(ano, mes, snapshot) {
      return this.rpc('video_fechar_mes', { p_ano: ano, p_mes: mes, p_snapshot: snapshot || {} });
    },
    async reabrirMesVideo(ano, mes) {
      return this.rpc('video_reabrir_mes', { p_ano: ano, p_mes: mes });
    },
    async competenciasFechadasVideo() {
      return ok(await sb().from('video_competencias_fechadas').select('*').order('competencia_ano', { ascending: false }).order('competencia_mes', { ascending: false }));
    },
    /* roteiros de uma gravação "Gravado", pra montar o checklist da
       automação Gravação→Edição — reaproveita listarRoteiros já existente. */
    async roteirosParaAutomacaoVideo(gravacaoId) {
      return this.listarRoteiros(gravacaoId);
    },
    async gerarDemandasDeGravacaoVideo(gravacaoId, roteiroIds, videomakerId, prazo) {
      return ok(await sb().rpc('video_gerar_demandas_de_gravacao', {
        p_gravacao_id: gravacaoId, p_roteiro_ids: roteiroIds || [],
        p_videomaker_id: videomakerId || null, p_prazo: prazo || null
      }));
    },
    async verificarAlertasPrazoVideo() {
      return this.rpc('video_verificar_alertas_prazo', {});
    },
    async definirStandbyVideo(demandaId, revisarEm) {
      return this.rpc('video_definir_standby', { p_demanda_id: demandaId, p_revisar_em: revisarEm || null });
    },

    /* ---- Calendário de Gravações — integração com o Google Calendar da
       conta branding7dados (migration_calendario.sql + Edge Function
       google-agenda). O refresh_token do Google nunca passa por aqui:
       tudo que toca a conexão em si (conectar/desconectar/listar
       agendas do Google/sincronizar eventos) vai pela Edge Function,
       que usa a service role. O resto (status, escolher agendas ativas,
       vincular/desvincular/criar gravação a partir de um evento) é RPC
       direto, igual ao resto do sistema. ---- */
    async chamarCalendarioGoogle(corpo) {
      const { data, error } = await sb().functions.invoke('google-agenda', { body: corpo });
      if (error) {
        let corpoErro = null, texto = '';
        const ctx = error.context;
        const status = ctx && typeof ctx.status === 'number' ? ctx.status : 0;
        try { texto = await ctx.clone().text(); corpoErro = JSON.parse(texto); } catch (x) {}
        if (corpoErro && corpoErro.erro) throw new Error(corpoErro.erro);
        let motivo = 'Serviço do Calendário indisponível';
        if (status === 404) motivo += ' (função google-agenda não publicada)';
        else if (status >= 500) motivo += ' (a função falhou — veja os logs)';
        else if (status) motivo += ' (HTTP ' + status + ')';
        else motivo += ' (sem resposta: rede, CORS ou projeto pausado)';
        throw new Error(motivo + '.');
      }
      if (data && data.erro) throw new Error(data.erro);
      return data;
    },
    async statusConexaoCalendario() { return this.rpc('calendario_status_conexao', {}); },
    async iniciarConexaoCalendario() { return this.chamarCalendarioGoogle({ acao: 'iniciar_conexao' }); },
    async desconectarCalendario() { return this.chamarCalendarioGoogle({ acao: 'desconectar' }); },
    async listarCalendariosGoogle() { return this.chamarCalendarioGoogle({ acao: 'listar_calendarios' }); },
    async sincronizarCalendario(inicioISO, fimISO) {
      return this.chamarCalendarioGoogle({ acao: 'sincronizar', inicio: inicioISO, fim: fimISO });
    },
    async alternarAgendaCalendario(id, ativo) {
      return this.rpc('calendario_alternar_agenda', { p_id: id, p_ativo: !!ativo });
    },
    async eventosCalendario(inicioISO, fimISO) {
      return ok(await sb().from('calendario_eventos_resumo').select('*')
        .lt('inicio', fimISO).or('fim.gte.' + inicioISO + ',fim.is.null')
        .order('inicio'));
    },
    async vincularGravacaoCalendario(eventoId, gravacaoId) {
      return this.rpc('calendario_vincular_gravacao', { p_event_id: eventoId, p_gravacao_id: gravacaoId });
    },
    async desvincularCalendario(eventoId) {
      return this.rpc('calendario_desvincular', { p_event_id: eventoId });
    },
    async criarGravacaoDeEventoCalendario({ eventoId, clienteId, nome, dataGravacao, local, observacoes }) {
      return this.rpc('calendario_criar_gravacao_de_evento', {
        p_event_id: eventoId, p_client_id: clienteId, p_nome: nome,
        p_data_gravacao: dataGravacao, p_local: local || '', p_observacoes: observacoes || ''
      });
    },

    /* ---- Ocorrências (status Marcada/Remarcada/Concluída/Cancelada) ---- */
    async ocorrenciasCalendario(inicioISO, fimISO) {
      return ok(await sb().from('calendario_ocorrencias_resumo').select('*')
        .lt('inicio', fimISO).or('fim.gte.' + inicioISO + ',fim.is.null')
        .order('inicio'));
    },
    async ocorrenciaConcluir(ocorrenciaId) {
      return this.rpc('calendario_ocorrencia_concluir', { p_ocorrencia_id: ocorrenciaId });
    },
    async ocorrenciaRemarcar(ocorrenciaId, novoInicioISO, novoFimISO) {
      return this.rpc('calendario_ocorrencia_remarcar', {
        p_ocorrencia_id: ocorrenciaId, p_novo_inicio: novoInicioISO, p_novo_fim: novoFimISO || null
      });
    },
    async ocorrenciaCancelar(ocorrenciaId, motivo) {
      return this.rpc('calendario_ocorrencia_cancelar', { p_ocorrencia_id: ocorrenciaId, p_motivo: motivo || null });
    },
    /* Chamadas de escrita no Google — best-effort: se falharem, a mudança
       já salva no B7 (via ocorrenciaRemarcar/ocorrenciaCancelar acima)
       continua valendo; quem chamou só avisa o usuário do desalinho. */
    async atualizarEventoGoogle(eventoId, inicioISO, fimISO, ocorrenciaId) {
      return this.chamarCalendarioGoogle({ acao: 'atualizar_evento', evento_id: eventoId, inicio: inicioISO, fim: fimISO || inicioISO, ocorrencia_id: ocorrenciaId || null });
    },
    async cancelarEventoGoogle(eventoId, ocorrenciaId) {
      return this.chamarCalendarioGoogle({ acao: 'cancelar_evento', evento_id: eventoId, ocorrencia_id: ocorrenciaId || null });
    },
    /* "Marcar gravação" direto do Calendário (migration_calendario_marcar.sql):
       cria a gravação + a ocorrência inicial no B7 primeiro (sempre vale,
       mesmo se o Google falhar depois) — quem chama tenta criarEventoGoogle
       em seguida, best-effort, igual ao padrão de remarcar/cancelar. */
    async marcarGravacaoCalendario({ clienteId, nome, inicioISO, fimISO, local, observacoes }) {
      return this.rpc('calendario_marcar_gravacao', {
        p_client_id: clienteId, p_nome: nome, p_inicio: inicioISO, p_fim: fimISO || null,
        p_local: local || '', p_observacoes: observacoes || ''
      });
    },
    async criarEventoGoogle(ocorrenciaId, titulo, inicioISO, fimISO, local) {
      return this.chamarCalendarioGoogle({
        acao: 'criar_evento', ocorrencia_id: ocorrenciaId, titulo,
        inicio: inicioISO, fim: fimISO || inicioISO, local: local || ''
      });
    },
    async definirAgendaEscritaPadrao(agendaId) {
      return this.rpc('calendario_agenda_definir_escrita_padrao', { p_agenda_id: agendaId });
    },
    /* Editar só título/local de um evento já existente no Google (não
       mexe em data/horário — isso é atualizarEventoGoogle/remarcar).
       Usado pelo "Editar" da ocorrência. Best-effort, mesmo padrão. */
    async editarMetaEventoGoogle(eventoId, { titulo, local }, ocorrenciaId) {
      return this.chamarCalendarioGoogle({
        acao: 'editar_evento', evento_id: eventoId, titulo: titulo || '', local: local || '',
        ocorrencia_id: ocorrenciaId || null
      });
    },

    /* ---- Equipe de Design (Admin/Coordenador) ---- */
    async listarDesigners() {
      return ok(await sb().from('perfis').select('id,nome,avatar_url,estado')
        .eq('papel', 'designer').eq('estado', 'ativa').order('nome'));
    },

    /* Importa sem apagar nada: mantém os ids do arquivo e ignora o que
       já existir (upsert por id). Serve para restaurar um backup. */
    async importarTudo(pacote) {
      const passo = async (tabela, linhas) => {
        if (!linhas || !linhas.length) return 0;
        const { error } = await sb().from(tabela).upsert(linhas, { onConflict: 'id' });
        if (error) throw error;
        return linhas.length;
      };
      /* a ordem importa: cada tabela depende da anterior por chave estrangeira */
      const c = await passo('clientes', pacote.clientes);
      const d = await passo('gravacoes', pacote.gravacoes || pacote.diarias);  // aceita backup da versão anterior
      /* roteiros.content_id aponta para conteudos, que só entram depois:
         primeiro o roteiro sem o vínculo, e o vínculo volta no fim */
      const roteiros = pacote.roteiros || [];
      const vinculos = roteiros.filter(x => x.content_id).map(x => ({ id: x.id, content_id: x.content_id }));
      const r = await passo('roteiros', roteiros.map(x => ({ ...x, content_id: null })));
      const e = await passo('cenas', pacote.cenas);

      /* Central de Conteúdo — ausente em backups da versão 1 */
      let conteudo = 0;
      for (const t of ['cliente_inteligencia', 'produtos', 'provas', 'onboardings',
                       'linhas_editoriais', 'pilares', 'conteudos', 'slides', 'frames', 'ideias']) {
        try { conteudo += await passo(t, pacote[t]); }
        catch (err) { console.warn('backup: não foi possível importar ' + t, err); }
      }

      /* vínculo roteiro → conteúdo, agora que os conteúdos existem */
      for (const v of vinculos) {
        try { await sb().from('roteiros').update({ content_id: v.content_id }).eq('id', v.id); }
        catch (err) { console.warn('backup: vínculo de roteiro não restaurado', v, err); }
      }

      /* Status Semanal, portal e kanban — ausentes em backups mais antigos */
      let trends = 0;
      /* perfil_clientes e kanban_historico ficam de fora do import: as
         permissões dessas tabelas não aceitam upsert (a primeira é só
         leitura pela API, a segunda não permite update). Ambas seguem
         no arquivo exportado, para consulta. */
      for (const t of ['status_semanais', 'status_itens', 'status_versoes',
                       'atividades', 'aprovacoes', 'aprovacao_partes', 'comentarios',
                       'kanban_demandas', 'kanban_comentarios']) {
        try { trends += await passo(t, pacote[t]); }
        catch (err) { console.warn('backup: não foi possível importar ' + t, err); }
      }

      return { clientes: c, gravacoes: d, roteiros: r, cenas: e,
               conteudo: conteudo, trends: trends };
    }
  };

  /* Todo método ganha o limite de tempo, sem precisar lembrar disso em
     cada chamada. */
  const envolvido = {};
  Object.keys(api).forEach(nome => {
    envolvido[nome] = function (...args) {
      const r = api[nome].apply(envolvido, args);
      return (r && typeof r.then === 'function') ? comLimite(r) : r;
    };
  });
  return envolvido;
})();
