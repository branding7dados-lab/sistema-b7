/* =====================================================================
   NOVIDADES DE CADA VERSÃO (zzz131) — o "o que mudou" que a equipe lê.

   Esta lista vai JUNTO com o sistema: toda versão que muda algo que a
   equipe percebe ganha um registro aqui, escrito na hora de publicar a
   versão. Ninguém precisa cadastrar nada: atualizou o B7, o cartão de
   novidades aparece sozinho (js/sistema.js → B7.Novidades).

   Como escrever um registro:
     · só o que muda para QUEM USA, em frase curta e sem termo técnico;
     · nada de banco, teste, correção interna ou ressalva — isso é do
       relatório, não daqui;
     · versão que não muda nada visível não entra;
     · o que é só do administrador NÃO entra (Kevin, 09/10/2026: aqui é
       só o que interessa à equipe) — isso ele lê no relatório;
     · a mais nova em cima.

   Quem vê cada registro (todos opcionais; sem nenhum = toda a equipe):
     funcao: 'videomaker'   só quem tem essa função (administrador também vê)
     rota: 'oportunidades'  só quem abre essa tela
     recurso: 'ia_voz'      só se o recurso estiver liberado para a pessoa
     ia: 'chat'             só se essa parte da IA estiver ligada
   O Portal do cliente não recebe novidades.
   ===================================================================== */
window.B7 = window.B7 || {};

B7.NOVIDADES_VERSOES = [
  { id: 'v-zzz186', versao: 'zzz186', em: '2026-10-15T15:00:00-03:00',
    titulo: 'WhatsApp: várias artes de uma vez',
    itens: ['Ao enviar uma arte, dá para marcar quais vão e juntar outras do computador — várias de uma vez (a mesma arte em proporções diferentes, por exemplo).',
            'Abrir uma janela do sistema com o WhatsApp aberto não deixa mais o WhatsApp “boiando” claro por cima.',
            'A atualização do programa de Windows fecha o programa sozinha, sem o aviso “Não é possível fechar o Sistema B7”.'] },
  { id: 'v-zzz185', versao: 'zzz185', em: '2026-10-15T14:00:00-03:00',
    titulo: 'Artes direto no WhatsApp',
    itens: ['No programa de Windows, a peça de design tem o botão “Enviar no WhatsApp”: o sistema abre o grupo do cliente, anexa as artes da versão mais nova e escreve a mensagem. Quem aperta enviar é você.',
            'O botão aparece no painel ao lado da conversa e na própria peça, depois de aprovada pela B7.'] },
  { id: 'v-zzz184', versao: 'zzz184', em: '2026-10-15T12:00:00-03:00',
    titulo: 'Painel do WhatsApp de cara nova',
    itens: ['O painel ao lado das conversas ficou mais limpo: cliente em destaque e lista de quem espera resposta com foto e tempo.',
            'Grupo que outra área cuida pode sair do “esperando resposta”: passe o mouse e clique no ×, ou desmarque o aviso dentro do grupo.',
            'Mensagens da equipe (inclusive do comercial) não aparecem mais como cliente esperando.'] },
  { id: 'v-zzz176', versao: 'zzz176', em: '2026-10-15T03:00:00-03:00',
    titulo: 'WhatsApp mais esperto (programa de Windows)',
    itens: ['O sistema reconhece sozinho os grupos de cada cliente pelo nome (“Suporte B7-3X - Infinite Fio” → Infinite Fio). Em “Conferir grupos” você confere uma vez.',
            'Ao lado da conversa, o cartão do cliente: vídeos, artes e gravações pendentes, com atalho para enviar no grupo.',
            '“Possível aprovação”: quando o cliente escreve “aprovado”, “pode postar”, “ficou ótimo”, o cartão avisa e leva à demanda.',
            '“Esperando resposta”: grupos de cliente sem resposta há mais de 15 min aparecem na lista; passou de 1 h, chega um aviso.',
            'Visual novo: cantos arredondados, entrada suave e os avisos do sistema aparecem na frente do WhatsApp.'] },
  { id: 'v-zzz173', versao: 'zzz173', em: '2026-10-15T02:00:00-03:00',
    titulo: 'WhatsApp: tela mais limpa',
    itens: ['Os menus do topo (Criar, avisos, sua conta) não ficam mais cortados atrás do WhatsApp.',
            'Barra nova: liga/desliga da assinatura com o nome editável, tamanho da letra (A− A+), recarregar e desconectar.'] },
  { id: 'v-zzz170', versao: 'zzz170', em: '2026-10-15T01:00:00-03:00',
    titulo: 'WhatsApp dentro do B7',
    itens: ['Novo item “WhatsApp” no menu: no programa de Windows, o WhatsApp abre dentro do sistema (leia o QR Code uma vez) e continua recebendo mensagens enquanto você usa as outras telas.',
            'Assinatura: suas mensagens saem com o seu nome em negrito na primeira linha. Liga, desliga e muda o nome no topo da tela do WhatsApp.',
            'Na demanda de vídeo, “Enviar no WhatsApp”: escolha o vídeo, e o sistema abre o grupo do cliente com o vídeo como documento e a mensagem pronta — você confere e aperta enviar.',
            'Na gravação marcada, “Avisar no WhatsApp” manda dia, hora e local para o grupo do cliente.',
            'Em Editar cliente, novo campo “Grupo do WhatsApp” (o nome do grupo como aparece no WhatsApp).'] },
  { id: 'v-zzz169', versao: 'zzz169', em: '2026-10-14T23:50:00-03:00',
    titulo: 'Assistente, Conversas e cores de cara nova',
    itens: ['Assistente: escolher cliente com busca (os últimos usados aparecem primeiro), histórico com busca e separado por dia, botão de copiar a resposta e “Tentar de novo”.',
            'Conversas: no computador, a lista fica ao lado da conversa; busca, filtro de não lidas, responder uma mensagem, reagir com emoji, editar o que você mandou e arrastar arquivos para enviar.',
            'Aparência: cinco paletas novas, fundos neutros, suaves ou coloridos, cantos retos ou arredondados e tema claro, escuro ou automático — com prévia na hora.',
            'As telas se atualizam mais rápido quando alguém muda algo, e voltam sozinhas se a internet cair.',
            'No programa de Windows, aparece no topo quando há atualização nova — um clique instala.'] },
  { id: 'v-zzz165', versao: 'zzz165', em: '2026-10-14T23:00:00-03:00',
    titulo: 'Tudo ao vivo, arrastar em lote e vídeo só de edição',
    itens: ['As telas se atualizam sozinhas quando alguém da equipe muda algo — sem precisar recarregar.',
            'Na linha editorial, o vídeo pode ser “Gravação e edição” ou “Só edição” (que já vira demanda em Edição de vídeo), e pode ser marcado como meme ou trend, com o link de referência indo junto.',
            'No quadro de Design e de Edição de vídeo, arrastar ficou mais suave; Ctrl ou Shift + clique marca vários cartões para mover juntos.',
            'O histórico das demandas mostra dia e hora de cada passo.',
            'No app Android, dá para escolher a cor do ícone em Configurações → Geral → Aplicativos.'] },
  { id: 'v-zzz164', versao: 'zzz164', em: '2026-10-14T21:00:00-03:00', rota: 'trends',
    titulo: 'Trends: guarde e transforme em roteiro',
    itens: ['Viu uma trend boa? No menu, “Trends” → “Nova trend”: cole o link e dê um nome.',
            '“Usar para um cliente” cria o roteiro numa gravação dele, já com a referência, e abre o editor.',
            'Cada cliente agora diz como trabalhamos com ele: linha editorial, por semana ou só roteiros — e a tela dele mostra só o que usa.'] },
  { id: 'v-zzz163', versao: 'zzz163', em: '2026-10-14T18:00:00-03:00',
    titulo: 'Escolha a cor do seu B7',
    itens: ['Em Configurações → Aparência, toque numa bolinha e o B7 inteiro troca de cor na hora — só para você.',
            'Agora tudo acompanha a cor: menu lateral, cabeçalhos, calendário, botões, brilhos e até os tons de cinza.',
            'Em “Mais opções” dá para escolher qualquer cor pelo código e ver a prévia no claro e no escuro.',
            'Nas Configurações, o campo “Procurar um ajuste” acha qualquer opção sem precisar trocar de aba.'] },
  { id: 'v-zzz135', versao: 'zzz135', em: '2026-10-09T17:30:00-03:00', ia: 'chat',
    titulo: 'Assistente cria várias demandas de uma vez',
    itens: ['Peça “crie 7 demandas para o cliente X, código do 8 ao 14” e ele monta um cartão para cada uma.',
            'Dá para dizer quem é o responsável e de qual gravação é: isso já vai na demanda.',
            'Com mais de uma proposta, o botão “Criar todas” cria tudo de uma vez.'] },
  { id: 'v-zzz134', versao: 'zzz134', em: '2026-10-09T16:00:00-03:00', recurso: 'conversas',
    titulo: 'Conversas da equipe',
    itens: ['O botão de conversa no topo, ao lado do sino, abre o chat interno: fale com qualquer pessoa da equipe sem sair da tela.',
            'Dá para mandar texto, áudio, imagem e arquivo, e colar um print com Ctrl+V.',
            'Você vê quem está online, o visto por último, quando a pessoa está digitando ou gravando áudio, e se a mensagem foi entregue e lida.',
            'Mensagem nova toca um som e chega como aviso no celular, se as notificações estiverem ligadas.'] },
  { id: 'v-zzz131', versao: 'zzz131', em: '2026-10-09T12:00:00-03:00',
    titulo: 'As novidades agora chegam sozinhas',
    itens: ['A cada atualização do B7, este cartão conta o que mudou para você.',
            'Dá para reler tudo em Configurações → Geral → Novidades do B7.'] },
  { id: 'v-zzz128', versao: 'zzz128', em: '2026-10-09T08:30:00-03:00', ia: 'chat',
    titulo: 'Assistente: imagem, roteiro pelo conteúdo e mais rapidez',
    itens: ['Dá para anexar uma imagem ou colar um print (Ctrl+V) na conversa com o assistente.',
            'No conteúdo da linha editorial, “Criar roteiro com IA” já cria o roteiro ligado a ele.',
            'O assistente responde mais rápido e usa o que já foi publicado do cliente como referência de tom.'] },
  { id: 'v-zzz127', versao: 'zzz127', em: '2026-10-09T07:30:00-03:00', ia: 'chat',
    titulo: 'Assistente enxerga mais e propõe mais',
    itens: ['Ele agora vê o andamento do mês, as datas dos próximos dias e os comentários em aberto.',
            'Além de demanda de vídeo, pode propor peça de design, gravação e conteúdo da linha — nada é criado sem você confirmar.',
            'Cada resposta tem o botão Ouvir, e as propostas ficam guardadas na conversa.',
            'Nas Oportunidades, cada ideia tem “Usar na linha”, que já leva título, gancho e legenda.'] },
  { id: 'v-zzz126', versao: 'zzz126', em: '2026-10-08T20:00:00-03:00', ia: 'chat', recurso: 'ia_voz',
    titulo: 'Fale com o assistente',
    itens: ['O microfone no campo de mensagem grava a sua fala e escreve o texto para você.'] },
  { id: 'v-zzz123', versao: 'zzz123', em: '2026-10-08T17:30:00-03:00', rota: 'oportunidades', recurso: 'ia_ideias',
    titulo: 'Ideias de conteúdo nas Oportunidades',
    itens: ['Na folha de cada data, a IA sugere três ideias de conteúdo para o cliente escolhido.',
            'A ficha do cliente ganhou “Memória da IA”: o que você anotar ali, a IA passa a respeitar.'] },
  { id: 'v-zzz121', versao: 'zzz121', em: '2026-10-08T15:30:00-03:00', rota: 'oportunidades', recurso: 'hoje_dia',
    titulo: 'Hoje é dia de…',
    itens: ['Toda manhã chega um aviso com as datas relevantes do dia.',
            'A data do dia também aparece no topo do Painel.'] },
  { id: 'v-zzz120', versao: 'zzz120', em: '2026-10-08T13:00:00-03:00', funcao: 'videomaker',
    titulo: 'Painel do videomaker mais completo',
    itens: ['Entraram a fila por etapa, os próximos 14 dias, as últimas entregas e o relógio.',
            'Ele se atualiza sozinho, para deixar aberto na tela.'] }
];
