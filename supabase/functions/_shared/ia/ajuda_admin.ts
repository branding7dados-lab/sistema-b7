// GERADO por testes/ajuda-admin-ia.mjs a partir de js/ajuda-admin.js — não edite aqui.
// Tutoriais da administração, para o assistente do Suporte responder a quem é administrador.
import type { Tutorial } from './ajuda.ts';
export const TUTORIAIS_ADMIN: Record<string, Tutorial> = {
 "adm-usuarios": {
  "titulo": "Criar e cuidar das contas",
  "grupo": "Pessoas e acessos",
  "texto": "Onde fica: Configurações → Administração → Pessoas e acessos (ou menu da sua foto → Usuários e acessos).\nQuem usa: Só administrador.\nServe para: Criar a conta de quem entra na equipe ou de um cliente, trocar a função, redefinir senha, desativar e ver quem está online.\nPasso a passo:\n1. No alto, os números da equipe: toque em um deles para filtrar a lista (online, administradores, acesso personalizado, contas que pedem atenção).\n2. Para criar, toque em Novo usuário: escolha Equipe B7 ou Cliente, a função principal e, se precisar, funções extras.\n3. A senha aparece uma única vez. Copie e entregue para a pessoa; depois ela não é mais mostrada.\n4. Toque no cartão de alguém para Editar acesso. No ⋯ ficam foto, redefinir senha, desativar e excluir.\n5. Os alertas do cartão avisam o que olhar: \"Nunca acessou\", \"Sem acesso há N dias\", \"Sem função\", \"Acesso personalizado\".\nDicas:\n- Prefira Desativar a excluir: a pessoa perde o acesso, mas o histórico do que ela fez continua."
 },
 "adm-funcoes": {
  "titulo": "Funções e módulos (o que cada um vê)",
  "grupo": "Pessoas e acessos",
  "texto": "Onde fica: Configurações → Administração → Funções e permissões (a matriz de tudo) → Editar funções e acessos. Também em Pessoas e acessos → botão Funções e acessos.\nQuem usa: Só administrador.\nServe para: Definir o padrão de cada função (Coordenador, Designer, Videomaker): quais módulos ela abre. Quem tem a função herda o padrão.\nPasso a passo:\n1. Escolha a função nas abas do alto e ligue ou desligue os módulos.\n2. Salve o padrão: todo mundo daquela função passa a ver igual, menos quem tem acesso personalizado.\n3. Para uma pessoa só, abra o cartão dela em Usuários e acessos e mude ali: vira um acesso personalizado (o mapa de módulos mostra em verde o que tem a mais e tracejado o que foi tirado).\nCuidado:\n- Administrador abre tudo, sempre. Funções e módulos só mudam o que as outras pessoas veem.\n- O banco confere o nível em cada ação: quem tem Ver não consegue alterar (recebe um aviso), e Editar não aprova nem exclui.\n- Para designer e videomaker, o nível vale para o trabalho deles. Para alterar o conteúdo de Clientes, Linhas, Roteiros, Gravações ou Status semanal, dê o nível na conta da pessoa ou use uma função personalizada.\n- WhatsApp, Lixeira e Agenda e recado da equipe também são permissões: dá para dar ou tirar por função ou por pessoa."
 },
 "adm-repasse": {
  "titulo": "Passar o trabalho de quem sai",
  "grupo": "Pessoas e acessos",
  "texto": "Onde fica: Configurações → Administração → Equipe → Equipe e carga → Passar o trabalho de alguém. Também no ⋯ do cartão da pessoa em Pessoas e acessos (Passar o trabalho…) e, sozinho, ao Desativar conta de quem ainda tem trabalho em aberto.\nQuem usa: Só administrador.\nServe para: Quando alguém sai da equipe ou vai ficar fora muito tempo: o que está em aberto com a pessoa (peças de design, demandas de vídeo, gravações marcadas e cards da Produção) passa para quem você escolher.\nPasso a passo:\n1. Escolha a pessoa. Aparece cada tipo de trabalho com quantos itens estão em aberto.\n2. Em cada tipo, escolha para quem vai. O B7 sugere quem está com menos trabalho e não está de férias. \"Não passar\" deixa aquele tipo com a pessoa.\n3. Em Ver os itens e escolher, desmarque o que não quer passar.\n4. Marque Desativar a conta no fim se a pessoa saiu. Confirme: os responsáveis mudam na hora e cada pessoa que recebe ganha um aviso com o total.\nCuidado:\n- Nada é apagado: só muda o responsável. O histórico de cada item mostra que ele veio de um repasse."
 },
 "adm-agenda-equipe": {
  "titulo": "Ausências, aniversários e recado para a equipe",
  "grupo": "Pessoas e acessos",
  "texto": "Onde fica: Configurações → Administração → Ausências e aniversários; o recado fica em Equipe → Recado e comunicado.\nQuem usa: Só administrador muda; a equipe vê.\nServe para: Marcar férias, folgas e atestados (a pessoa aparece como fora e a redistribuição avisa antes de passar trabalho para ela), guardar o aniversário de cada um (no dia aparece um cartão de parabéns) e deixar um recado fixo no alto da tela de todo mundo.\nPasso a passo:\n1. Em Marcar uma ausência, escolha a pessoa, o tipo e as datas. Tirar encerra a ausência sem apagar o registro.\n2. Em Aniversários, toque em Definir ao lado da pessoa e escolha dia e mês (a idade não aparece).\n3. Em Recado fixo para a equipe, escreva até 280 caracteres, escolha até quando fica no ar (no máximo 60 dias) e o estilo. Cada pessoa pode fechar o dela; Tirar do ar some para todos.\n4. Exportar lista da equipe (em Equipe) baixa uma planilha com função, situação, último acesso, aniversário e ausência de cada pessoa."
 },
 "adm-sessoes": {
  "titulo": "Sessões abertas e \"Visualizar como\"",
  "grupo": "Pessoas e acessos",
  "texto": "Onde fica: Configurações → Administração → Equipe → Segurança da equipe → Sessões ativas. \"Visualizar como…\" fica no menu da sua foto e em Equipe.\nQuem usa: Só administrador.\nServe para: Ver em quais aparelhos cada conta está aberta e derrubar uma sessão (celular perdido, pessoa que saiu). \"Visualizar como\" mostra o sistema com o acesso de outra pessoa.\nPasso a passo:\n1. Em Sessões ativas, cada linha é um aparelho. Encerrar tira o acesso: com o B7 aberto, ele sai da conta em até 1 minuto.\n2. Para impedir que a pessoa volte, além de encerrar, redefina a senha ou desative a conta.\n3. Em Visualizar como…, escolha a pessoa: você vê o menu e as telas como ela vê, para conferir permissões. Para sair, use a faixa do topo."
 },
 "adm-central": {
  "titulo": "Central de atendimento (chamados)",
  "grupo": "Atendimento da equipe",
  "texto": "Onde fica: Menu da sua foto → Suporte e feedback. Para administração e coordenação, abre a Central de atendimento.\nQuem usa: Administrador e coordenação.\nServe para: Responder os chamados da equipe (problemas, dúvidas, sugestões, elogios), mudar o andamento e acompanhar o que está parado.\nPasso a passo:\n1. No alto, os números da fila: novos, urgentes, sem resposta há 24 h, em andamento, resolvidos e o tempo médio para resolver. Toque para filtrar.\n2. À esquerda, as filas (Caixa de entrada, Urgentes, Sem resposta…), o tipo e a pessoa. No meio, a lista. À direita, o chamado aberto.\n3. Mude o andamento em um toque (Novo, Em análise, Em andamento, Resolvido, Não será feito) e a prioridade. A pessoa recebe aviso no sino.\n4. Para responder, escreva embaixo (há respostas prontas). Em Nota interna, só a administração lê.\n5. Em \"Informações técnicas\" estão a tela, a versão, o aparelho e os últimos erros de quem abriu o chamado.\nDicas:\n- Chamado novo sem resposta há mais de 24 h (ou urgente parado) gera aviso automático para você e a coordenação, uma vez por dia."
 },
 "adm-ideias": {
  "titulo": "Ideias da equipe (com votos)",
  "grupo": "Atendimento da equipe",
  "texto": "Onde fica: Central de atendimento → aba Ideias.\nQuem usa: Administrador e coordenação.\nServe para: Ver as sugestões da equipe na ordem de votos, para decidir o que entra primeiro.\nPasso a passo:\n1. A equipe vota pela tela de Suporte dela; aqui aparecem todas, a mais votada primeiro.\n2. Toque em Abrir para ir ao chamado da ideia e responder ou mudar o andamento."
 },
 "adm-comunicado": {
  "titulo": "Comunicado para a equipe",
  "grupo": "Atendimento da equipe",
  "texto": "Onde fica: Configurações → Admin → Comunicado.\nQuem usa: Só administrador.\nServe para: Mandar uma mensagem que chega na conversa de cada pessoa escolhida, com aviso, e acompanhar quem já leu.\nPasso a passo:\n1. Escreva a mensagem e escolha para quem: toda a equipe ou um grupo (Coordenação, Videomakers, Designers).\n2. A prévia mostra como chega. Envie.\n3. Em \"Enviados\", a barra mostra quantos leram; \"Ver quem leu\" lista leu / recebeu / ainda não recebeu."
 },
 "adm-saude": {
  "titulo": "Saúde do sistema e Médico",
  "grupo": "Cuidar do sistema",
  "texto": "Onde fica: Configurações → Admin → Cuidar do sistema.\nQuem usa: Só administrador.\nServe para: Saúde: se as rotinas rodaram, se os avisos estão saindo, Google Agenda, espaço e IA. Médico: cadastros incompletos (cliente sem logo, demanda sem responsável…).\nPasso a passo:\n1. Abra Saúde do sistema: \"Tudo certo\" ou os pontos de atenção, com os números de cada serviço.\n2. Abra Médico do sistema: cada área mostra os casos; o botão Abrir leva ao registro para corrigir. Nada é corrigido sozinho."
 },
 "adm-manutencao": {
  "titulo": "Modo manutenção",
  "grupo": "Cuidar do sistema",
  "texto": "Onde fica: Configurações → Admin → Manutenção.\nQuem usa: Só administrador.\nServe para: Travar a tela da equipe por alguns minutos enquanto algo é ajustado, com aviso antes. Administradores continuam usando.\nPasso a passo:\n1. Escolha começar agora, em alguns minutos ou agendar data e hora; escreva a mensagem e a previsão de volta.\n2. A equipe vê o aviso antes e, na hora, a tela de manutenção. Você vê uma faixa no rodapé com \"Gerenciar\".\n3. Desligue quando terminar: a equipe é liberada em até 1 minuto."
 },
 "adm-ia": {
  "titulo": "Inteligência artificial e uso da IA",
  "grupo": "Cuidar do sistema",
  "texto": "Onde fica: Configurações → Admin → Inteligência artificial e Uso da IA.\nQuem usa: Só administrador.\nServe para: Ligar ou desligar o assistente por área (roteiros, linhas, chat) e ver quantos pedidos foram feitos, por quem e quantos deram erro.\nPasso a passo:\n1. Desligado, o assistente some da tela e o servidor recusa o pedido.\n2. Em Uso da IA, escolha o período (7, 30 ou 90 dias). O texto dos pedidos nunca é guardado: só os números."
 },
 "adm-lixeira": {
  "titulo": "Lixeira e arquivados",
  "grupo": "Cuidar do sistema",
  "texto": "Onde fica: Menu lateral → Mais ferramentas → Lixeira / Arquivados.\nQuem usa: Administrador (Arquivados também para a coordenação).\nServe para: Recuperar o que foi apagado ou arquivado.\nPasso a passo:\n1. Abra a Lixeira, encontre o item e toque em Restaurar."
 },
 "adm-aparencia-sis": {
  "titulo": "Aparência do sistema",
  "grupo": "Aparência, recursos e textos",
  "texto": "Onde fica: Configurações → Admin → Aparência do sistema.\nQuem usa: Só administrador. Vale para toda a equipe.\nServe para: Cor do sistema (ou uma cor sua), menu lateral, botões, brilho de fundo e as datas especiais da abertura (Natal, Outubro Rosa…).\nPasso a passo:\n1. A prévia mostra o resultado no claro e no escuro, e a tela de trás já muda. Cancelar volta ao que estava.\n2. Em Datas especiais, use as sugestões ou crie a sua (dd/mm a dd/mm, cor e frase). \"Ver\" toca a abertura com aquela data.\n3. Salve: a equipe recebe em até 1 minuto."
 },
 "adm-recursos": {
  "titulo": "Recursos: liberar aos poucos",
  "grupo": "Aparência, recursos e textos",
  "texto": "Onde fica: Configurações → Admin → Recursos.\nQuem usa: Só administrador.\nServe para: Escolher para quem cada recurso novo aparece: todos, só você, administradores + funções, ou ninguém. Serve para testar antes de liberar.\nPasso a passo:\n1. Toque no recurso, escolha a regra e salve. A equipe recebe ao reabrir o B7."
 },
 "adm-textos": {
  "titulo": "Textos padrão e novidades",
  "grupo": "Aparência, recursos e textos",
  "texto": "Onde fica: Configurações → Admin → Textos padrão e Novidades.\nQuem usa: Só administrador.\nServe para: Reescrever as mensagens prontas para o cliente e as frases do Portal; publicar um aviso seu além das novidades automáticas.\nPasso a passo:\n1. Nos textos, as palavras entre chaves ({cliente}, {periodo}…) são trocadas pelo dado de verdade.\n2. As novidades de cada versão chegam sozinhas; use \"Publicar um aviso\" só para um recado a mais."
 },
 "adm-tv": {
  "titulo": "Painel de TV",
  "grupo": "Aparência, recursos e textos",
  "texto": "Onde fica: Configurações → Admin → Painel de TV.\nQuem usa: Só administrador configura; quem tem o recurso abre.\nServe para: Escolher o que aparece na TV da agência: blocos, nomes, visual, recado, clima, a animação ou só a logo.\nPasso a passo:\n1. Configure e use \"Para ver como fica\" antes de deixar na TV."
 },
 "adm-resumo": {
  "titulo": "Resumo da semana e redistribuição",
  "grupo": "Gestão do trabalho",
  "texto": "Onde fica: Configurações → Admin → Equipe e carga.\nQuem usa: Só administrador.\nServe para: Ler os últimos 7 dias em texto (a IA escreve em cima dos números do sistema) e ver quem está com trabalho demais em relação a quem está livre.\nPasso a passo:\n1. No Resumo, os números aparecem na hora; \"Gerar resumo\" escreve o texto. Se um número não bater com o sistema, a resposta é recusada.\n2. Na Redistribuição, as barras mostram a carga de cada pessoa da mesma função. Só itens que ainda não começaram são sugeridos; marque e passe. Nada muda sozinho."
 },
 "adm-assistente": {
  "titulo": "Administrar pelo assistente",
  "grupo": "Gestão do trabalho",
  "texto": "Onde fica: O botão do assistente, no canto da tela.\nQuem usa: Só administrador.\nServe para: Pedir em texto: \"desliga a IA de voz\", \"põe a cor do sistema em oceano\", \"avisa os designers que…\". O assistente monta um cartão com o antes e o depois.\nPasso a passo:\n1. Confira o cartão e toque em Aplicar. Nada muda sem esse toque. Permissões, contas e exclusões não são feitas por aqui."
 },
 "adm-cliente-teste": {
  "titulo": "Cliente de teste",
  "grupo": "Gestão do trabalho",
  "texto": "Onde fica: Clientes → Cliente Teste B7 (etiqueta TESTE).\nQuem usa: Administrador.\nServe para: Testar a criação de demandas, peças e gravações sem mexer em cliente de verdade. Fica fora do Panorama e do resumo do Painel.\nPasso a passo:\n1. Atribua os testes a você mesmo e apague os registros de teste quando terminar."
 },
 "adm-videos": {
  "titulo": "Vídeos nos tutoriais (YouTube)",
  "grupo": "Gestão do trabalho",
  "texto": "Onde fica: Dentro de qualquer tutorial da Ajuda, no alto.\nQuem usa: Só administrador coloca; todos assistem.\nServe para: Colocar um vídeo curto do passo a passo sem guardar o arquivo no sistema: o vídeo fica no YouTube.\nPasso a passo:\n1. Envie o vídeo para o YouTube como Não listado (só quem tem o link vê).\n2. Abra o tutorial, cole o link do YouTube no campo \"Vídeo deste tutorial\" e salve.\n3. Para tirar, toque em Remover. O vídeo continua no seu YouTube."
 }
};
