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
