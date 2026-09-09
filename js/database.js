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
      return ok(await sb().from('pilares').delete().eq('id', id));
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
        let corpoErro = null;
        try { corpoErro = await error.context.json(); } catch (x) {}
        if (corpoErro && corpoErro.erro) throw new Error(corpoErro.erro);
        const e = new Error('Serviço de acesso indisponível.');
        e.rede = true;
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

    /* ---- envio, decisão e comentários ---- */

    /* A equipe libera UMA versão. Reenviar cria a próxima: nunca
       sobrescreve o que já foi decidido, senão o histórico mentiria. */
    async enviarParaAprovacao({ client_id, tipo, alvo_id, snapshot, observacao }) {
      const anteriores = ok(await sb().from('aprovacoes')
        .select('versao').eq('tipo', tipo).eq('alvo_id', alvo_id)
        .is('deleted_at', null).order('versao', { ascending: false }).limit(1));
      const versao = anteriores.length ? (anteriores[0].versao || 0) + 1 : 1;
      const u = window.B7 && B7.Auth && B7.Auth.usuario();
      const linhas = ok(await sb().from('aprovacoes').insert([{
        client_id, tipo, alvo_id, versao,
        snapshot: snapshot || {},
        situacao: 'pendente',
        enviado_por: u ? u.id : null,
        observacao_envio: observacao || null
      }]).select());
      return linhas[0];
    },

    async decidirAprovacao(id, situacao) {
      const u = window.B7 && B7.Auth && B7.Auth.usuario();
      /* .select() devolve as linhas afetadas: se o RLS recusou a
         decisão (conta sem pode_aprovar, empresa errada), vem vazio e
         isso precisa virar erro — não um toast de sucesso. */
      const linhas = ok(await sb().from('aprovacoes').update({
        situacao,
        decidido_por: u ? u.id : null,
        decidido_em: new Date().toISOString()
      }).eq('id', id).select('id'));
      if (!linhas.length) throw new Error('Sua conta não tem permissão para decidir esta aprovação.');
    },

    async decidirParte(aprovacaoId, parteId, rotulo, situacao, tipo) {
      const u = window.B7 && B7.Auth && B7.Auth.usuario();
      /* upsert pela chave (aprovacao, parte): mudar de ideia sobre uma
         cena substitui a decisão anterior daquela versão */
      const linhas = ok(await sb().from('aprovacao_partes').upsert([{
        aprovacao_id: aprovacaoId, parte_id: parteId, parte_rotulo: rotulo,
        parte_tipo: tipo || 'cena',
        situacao, decidido_por: u ? u.id : null,
        decidido_em: new Date().toISOString()
      }], { onConflict: 'aprovacao_id,parte_id' }).select('id'));
      if (!linhas.length) throw new Error('Sua conta não tem permissão para decidir esta cena.');
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

    async conteudosVisiveis() {
      return ok(await sb().from('conteudos').select('*')
        .eq('visivel_cliente', true).is('deleted_at', null)
        .order('data_postagem', { ascending: true }).limit(60));
    },

    async linhaVisivelAtual() {
      const linhas = ok(await sb().from('linhas_editoriais').select('*')
        .eq('visivel_cliente', true).is('deleted_at', null)
        .order('ano', { ascending: false }).order('mes', { ascending: false }).limit(1));
      return linhas[0] || null;
    },

    async ultimoStatusPublicado() {
      const linhas = ok(await sb().from('status_semanais').select('*')
        .not('publicado_em', 'is', null).is('deleted_at', null)
        .order('semana_inicio', { ascending: false }).limit(1));
      return linhas[0] || null;
    },

    /* ======================================================= KANBAN */

    async listarDemandas() {
      return ok(await sb().from('kanban_resumo').select('*')
        .is('deleted_at', null).order('posicao', { ascending: true }));
    },

    async criarDemanda(campos) {
      const linhas = ok(await sb().from('kanban_demandas').insert([campos]).select());
      return linhas[0];
    },

    async atualizarDemanda(id, campos) {
      ok(await sb().from('kanban_demandas').update(campos).eq('id', id));
    },

    /* separado do update geral: mover é a operação mais frequente e a
       única que precisa ser rápida no arrastar */
    async moverDemanda(id, campos) {
      ok(await sb().from('kanban_demandas').update(campos).eq('id', id));
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
      ok(await sb().from('kanban_comentarios')
        .insert([{ demanda_id: id, texto, autor_nome: autorNome }]));
    },

    async historicoDemanda(id) {
      return ok(await sb().from('kanban_historico').select('*')
        .eq('demanda_id', id).order('created_at', { ascending: false }));
    },

    async registrarKanban(id, de, para, campo) {
      const u = window.B7 && B7.Auth && B7.Auth.usuario();
      ok(await sb().from('kanban_historico').insert([{
        demanda_id: id, de, para, campo: campo || 'coluna',
        autor_nome: u ? u.nome : null
      }]));
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
        .select('id,titulo,recording_session_id,updated_at')
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
