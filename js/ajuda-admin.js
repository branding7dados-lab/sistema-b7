/* =====================================================================
   AJUDA DA ADMINISTRAÇÃO (zzz215) — os tutoriais que só o administrador
   vê. Mesmo formato de B7.AJUDA_DADOS (js/ajuda-dados.js): grupos com
   tutoriais { id, titulo, onde, quem, serve, passos: [[texto, [subitens]]],
   dicas, cuidados, rotas }. A tela de Ajuda mostra estes para quem é
   administrador (aba "Administração") e esconde de todo o resto.
   ===================================================================== */
window.B7 = window.B7 || {};
B7.AJUDA_ADMIN = [
 { id: 'adm-equipe', nome: 'Pessoas e acessos', itens: [
  { id: 'adm-usuarios', titulo: 'Criar e cuidar das contas', rotas: ['usuarios'],
    onde: 'Menu da sua foto → **Usuários e acessos** (ou Configurações → Admin → Pessoas).',
    quem: 'Só administrador.',
    serve: 'Criar a conta de quem entra na equipe ou de um cliente, trocar a função, redefinir senha, desativar e ver quem está online.',
    passos: [
     ['No alto, os números da equipe: toque em um deles para filtrar a lista (online, administradores, acesso personalizado, contas que pedem atenção).', []],
     ['Para criar, toque em **Novo usuário**: escolha Equipe B7 ou Cliente, a função principal e, se precisar, funções extras.', []],
     ['A senha aparece **uma única vez**. Copie e entregue para a pessoa; depois ela não é mais mostrada.', []],
     ['Toque no cartão de alguém para **Editar acesso**. No ⋯ ficam foto, redefinir senha, desativar e excluir.', []],
     ['Os alertas do cartão avisam o que olhar: "Nunca acessou", "Sem acesso há N dias", "Sem função", "Acesso personalizado".', []]
    ],
    dicas: [['Prefira **Desativar** a excluir: a pessoa perde o acesso, mas o histórico do que ela fez continua.', []]] },
  { id: 'adm-funcoes', titulo: 'Funções e módulos (o que cada um vê)', rotas: [],
    onde: 'Usuários e acessos → botão **Funções e acessos**.',
    quem: 'Só administrador.',
    serve: 'Definir o padrão de cada função (Coordenador, Designer, Videomaker): quais módulos ela abre. Quem tem a função herda o padrão.',
    passos: [
     ['Escolha a função nas abas do alto e ligue ou desligue os módulos.', []],
     ['Salve o padrão: todo mundo daquela função passa a ver igual, menos quem tem acesso personalizado.', []],
     ['Para uma pessoa só, abra o cartão dela em Usuários e acessos e mude ali: vira um **acesso personalizado** (o mapa de módulos mostra em verde o que tem a mais e tracejado o que foi tirado).', []]
    ],
    cuidados: [['Administrador abre tudo, sempre. Funções e módulos só mudam o que as outras pessoas veem.', []]] },
  { id: 'adm-sessoes', titulo: 'Sessões abertas e "Visualizar como"', rotas: [],
    onde: 'Configurações → Admin → **Sessões**. "Visualizar como…" fica no menu da sua foto.',
    quem: 'Só administrador.',
    serve: 'Ver em quais aparelhos cada conta está aberta e derrubar uma sessão (celular perdido, pessoa que saiu). "Visualizar como" mostra o sistema com o acesso de outra pessoa.',
    passos: [
     ['Em Sessões ativas, cada linha é um aparelho. **Encerrar** tira o acesso: com o B7 aberto, ele sai da conta em até 1 minuto.', []],
     ['Para impedir que a pessoa volte, além de encerrar, redefina a senha ou desative a conta.', []],
     ['Em **Visualizar como…**, escolha a pessoa: você vê o menu e as telas como ela vê, para conferir permissões. Para sair, use a faixa do topo.', []]
    ] }
 ]},
 { id: 'adm-atendimento', nome: 'Atendimento da equipe', itens: [
  { id: 'adm-central', titulo: 'Central de atendimento (chamados)', rotas: ['suporte'],
    onde: 'Menu da sua foto → **Suporte e feedback**. Para administração e coordenação, abre a Central de atendimento.',
    quem: 'Administrador e coordenação.',
    serve: 'Responder os chamados da equipe (problemas, dúvidas, sugestões, elogios), mudar o andamento e acompanhar o que está parado.',
    passos: [
     ['No alto, os números da fila: novos, urgentes, **sem resposta há 24 h**, em andamento, resolvidos e o tempo médio para resolver. Toque para filtrar.', []],
     ['À esquerda, as filas (Caixa de entrada, Urgentes, Sem resposta…), o tipo e a pessoa. No meio, a lista. À direita, o chamado aberto.', []],
     ['Mude o andamento **em um toque** (Novo, Em análise, Em andamento, Resolvido, Não será feito) e a prioridade. A pessoa recebe aviso no sino.', []],
     ['Para responder, escreva embaixo (há respostas prontas). Em **Nota interna**, só a administração lê.', []],
     ['Em "Informações técnicas" estão a tela, a versão, o aparelho e os últimos erros de quem abriu o chamado.', []]
    ],
    dicas: [['Chamado novo sem resposta há mais de 24 h (ou urgente parado) gera aviso automático para você e a coordenação, uma vez por dia.', []]] },
  { id: 'adm-ideias', titulo: 'Ideias da equipe (com votos)', rotas: [],
    onde: 'Central de atendimento → aba **Ideias**.',
    quem: 'Administrador e coordenação.',
    serve: 'Ver as sugestões da equipe na ordem de votos, para decidir o que entra primeiro.',
    passos: [
     ['A equipe vota pela tela de Suporte dela; aqui aparecem todas, a mais votada primeiro.', []],
     ['Toque em **Abrir** para ir ao chamado da ideia e responder ou mudar o andamento.', []]
    ] },
  { id: 'adm-comunicado', titulo: 'Comunicado para a equipe', rotas: [],
    onde: 'Configurações → Admin → **Comunicado**.',
    quem: 'Só administrador.',
    serve: 'Mandar uma mensagem que chega na conversa de cada pessoa escolhida, com aviso, e acompanhar quem já leu.',
    passos: [
     ['Escreva a mensagem e escolha para quem: toda a equipe ou um grupo (Coordenação, Videomakers, Designers).', []],
     ['A prévia mostra como chega. Envie.', []],
     ['Em "Enviados", a barra mostra quantos leram; "Ver quem leu" lista leu / recebeu / ainda não recebeu.', []]
    ] }
 ]},
 { id: 'adm-sistema', nome: 'Cuidar do sistema', itens: [
  { id: 'adm-saude', titulo: 'Saúde do sistema e Médico', rotas: [],
    onde: 'Configurações → Admin → **Cuidar do sistema**.',
    quem: 'Só administrador.',
    serve: 'Saúde: se as rotinas rodaram, se os avisos estão saindo, Google Agenda, espaço e IA. Médico: cadastros incompletos (cliente sem logo, demanda sem responsável…).',
    passos: [
     ['Abra **Saúde do sistema**: "Tudo certo" ou os pontos de atenção, com os números de cada serviço.', []],
     ['Abra **Médico do sistema**: cada área mostra os casos; o botão Abrir leva ao registro para corrigir. Nada é corrigido sozinho.', []]
    ] },
  { id: 'adm-manutencao', titulo: 'Modo manutenção', rotas: [],
    onde: 'Configurações → Admin → **Manutenção**.',
    quem: 'Só administrador.',
    serve: 'Travar a tela da equipe por alguns minutos enquanto algo é ajustado, com aviso antes. Administradores continuam usando.',
    passos: [
     ['Escolha começar agora, em alguns minutos ou agendar data e hora; escreva a mensagem e a previsão de volta.', []],
     ['A equipe vê o aviso antes e, na hora, a tela de manutenção. Você vê uma faixa no rodapé com "Gerenciar".', []],
     ['Desligue quando terminar: a equipe é liberada em até 1 minuto.', []]
    ] },
  { id: 'adm-ia', titulo: 'Inteligência artificial e uso da IA', rotas: [],
    onde: 'Configurações → Admin → **Inteligência artificial** e **Uso da IA**.',
    quem: 'Só administrador.',
    serve: 'Ligar ou desligar o assistente por área (roteiros, linhas, chat) e ver quantos pedidos foram feitos, por quem e quantos deram erro.',
    passos: [
     ['Desligado, o assistente some da tela e o servidor recusa o pedido.', []],
     ['Em Uso da IA, escolha o período (7, 30 ou 90 dias). O texto dos pedidos nunca é guardado: só os números.', []]
    ] },
  { id: 'adm-lixeira', titulo: 'Lixeira e arquivados', rotas: ['lixeira', 'arquivados'],
    onde: 'Menu lateral → **Mais ferramentas** → Lixeira / Arquivados.',
    quem: 'Administrador (Arquivados também para a coordenação).',
    serve: 'Recuperar o que foi apagado ou arquivado.',
    passos: [['Abra a Lixeira, encontre o item e toque em **Restaurar**.', []]] }
 ]},
 { id: 'adm-aparencia', nome: 'Aparência, recursos e textos', itens: [
  { id: 'adm-aparencia-sis', titulo: 'Aparência do sistema', rotas: [],
    onde: 'Configurações → Admin → **Aparência do sistema**.',
    quem: 'Só administrador. Vale para toda a equipe.',
    serve: 'Cor do sistema (ou uma cor sua), menu lateral, botões, brilho de fundo e as datas especiais da abertura (Natal, Outubro Rosa…).',
    passos: [
     ['A prévia mostra o resultado no claro e no escuro, e a tela de trás já muda. Cancelar volta ao que estava.', []],
     ['Em Datas especiais, use as sugestões ou crie a sua (dd/mm a dd/mm, cor e frase). "Ver" toca a abertura com aquela data.', []],
     ['Salve: a equipe recebe em até 1 minuto.', []]
    ] },
  { id: 'adm-recursos', titulo: 'Recursos: liberar aos poucos', rotas: [],
    onde: 'Configurações → Admin → **Recursos**.',
    quem: 'Só administrador.',
    serve: 'Escolher para quem cada recurso novo aparece: todos, só você, administradores + funções, ou ninguém. Serve para testar antes de liberar.',
    passos: [['Toque no recurso, escolha a regra e salve. A equipe recebe ao reabrir o B7.', []]] },
  { id: 'adm-textos', titulo: 'Textos padrão e novidades', rotas: [],
    onde: 'Configurações → Admin → **Textos padrão** e **Novidades**.',
    quem: 'Só administrador.',
    serve: 'Reescrever as mensagens prontas para o cliente e as frases do Portal; publicar um aviso seu além das novidades automáticas.',
    passos: [
     ['Nos textos, as palavras entre chaves ({cliente}, {periodo}…) são trocadas pelo dado de verdade.', []],
     ['As novidades de cada versão chegam sozinhas; use "Publicar um aviso" só para um recado a mais.', []]
    ] },
  { id: 'adm-tv', titulo: 'Painel de TV', rotas: ['tv'],
    onde: 'Configurações → Admin → **Painel de TV**.',
    quem: 'Só administrador configura; quem tem o recurso abre.',
    serve: 'Escolher o que aparece na TV da agência: blocos, nomes, visual, recado, clima, a animação ou só a logo.',
    passos: [['Configure e use "Para ver como fica" antes de deixar na TV.', []]] }
 ]},
 { id: 'adm-operacao', nome: 'Gestão do trabalho', itens: [
  { id: 'adm-resumo', titulo: 'Resumo da semana e redistribuição', rotas: [],
    onde: 'Configurações → Admin → **Equipe e carga**.',
    quem: 'Só administrador.',
    serve: 'Ler os últimos 7 dias em texto (a IA escreve em cima dos números do sistema) e ver quem está com trabalho demais em relação a quem está livre.',
    passos: [
     ['No Resumo, os números aparecem na hora; "Gerar resumo" escreve o texto. Se um número não bater com o sistema, a resposta é recusada.', []],
     ['Na Redistribuição, as barras mostram a carga de cada pessoa da mesma função. Só itens que **ainda não começaram** são sugeridos; marque e passe. Nada muda sozinho.', []]
    ] },
  { id: 'adm-assistente', titulo: 'Administrar pelo assistente', rotas: [],
    onde: 'O botão do assistente, no canto da tela.',
    quem: 'Só administrador.',
    serve: 'Pedir em texto: "desliga a IA de voz", "põe a cor do sistema em oceano", "avisa os designers que…". O assistente monta um cartão com o antes e o depois.',
    passos: [['Confira o cartão e toque em **Aplicar**. Nada muda sem esse toque. Permissões, contas e exclusões não são feitas por aqui.', []]] },
  { id: 'adm-cliente-teste', titulo: 'Cliente de teste', rotas: [],
    onde: 'Clientes → **Cliente Teste B7** (etiqueta TESTE).',
    quem: 'Administrador.',
    serve: 'Testar a criação de demandas, peças e gravações sem mexer em cliente de verdade. Fica fora do Panorama e do resumo do Painel.',
    passos: [['Atribua os testes a você mesmo e apague os registros de teste quando terminar.', []]] },
  { id: 'adm-videos', titulo: 'Vídeos nos tutoriais (YouTube)', rotas: [],
    onde: 'Dentro de qualquer tutorial da Ajuda, no alto.',
    quem: 'Só administrador coloca; todos assistem.',
    serve: 'Colocar um vídeo curto do passo a passo sem guardar o arquivo no sistema: o vídeo fica no YouTube.',
    passos: [
     ['Envie o vídeo para o YouTube como **Não listado** (só quem tem o link vê).', []],
     ['Abra o tutorial, cole o link do YouTube no campo "Vídeo deste tutorial" e salve.', []],
     ['Para tirar, toque em Remover. O vídeo continua no seu YouTube.', []]
    ] }
 ]}
];
