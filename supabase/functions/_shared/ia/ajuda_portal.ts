// zzz223: o que o CLIENTE vê no Sistema B7 (o Portal do cliente), para o
// assistente do Suporte responder "como faço…" sem entrar na operação
// interna da agência. Escrito à mão a partir de js/portal.js — se o Portal
// mudar, atualize aqui.
import type { Tutorial } from './ajuda.ts';

export const TUTORIAIS_PORTAL: Record<string, Tutorial> = {
  'portal-inicio': {
    titulo: 'Portal do cliente: início', grupo: 'Portal do cliente',
    texto: 'Onde fica: é a primeira tela depois de entrar ("Início" no menu da esquerda; no celular, no menu de baixo).\n' +
      'Serve para: ver de relance o que precisa de você (aprovações pendentes), o que a agência está produzindo e as próximas gravações e publicações da sua empresa.\n' +
      'Passo a passo:\n1. Entre com o usuário e a senha que a Branding7 enviou.\n2. No alto aparece "Olá, seu nome" e um resumo do que está esperando você.\n' +
      '3. Toque em um cartão para abrir o assunto (por exemplo, uma aprovação pendente).\n' +
      'Dicas:\n- Se você acompanha mais de uma empresa, troque a empresa no seletor do alto do menu ("PORTAL DO CLIENTE").\n- O sino, no topo, avisa quando chega algo novo para você aprovar ou uma resposta do suporte.'
  },
  'portal-aprovacoes': {
    titulo: 'Portal do cliente: aprovar, pedir ajuste ou recusar', grupo: 'Portal do cliente',
    texto: 'Onde fica: menu → "Aprovações". Também abre pelo aviso do sino ou pelo link que a agência enviar.\n' +
      'Serve para: decidir os materiais que a agência mandou (roteiros, artes, vídeos, linha editorial).\n' +
      'Passo a passo:\n1. Abra "Aprovações" e toque no material que está "aguardando você".\n2. Veja o material com calma (role a tela; nos roteiros, cada cena aparece separada).\n' +
      '3. Escolha: "Aprovar" (o botão grande), "Solicitar ajustes" (escreva o que precisa mudar) ou "Recusar".\n' +
      '4. Nos roteiros dá para decidir cena por cena: "Aprovar cena" ou "Pedir ajuste" em cada uma. "Aprovar roteiro completo" vale para todas as cenas que ainda não têm decisão.\n' +
      '5. Para deixar um recado sem decidir, escreva nos comentários e toque em "Enviar".\n' +
      'Dicas:\n- Seja específico no ajuste (ex.: "trocar a foto da segunda arte", "o preço certo é R$ 49,90"): a equipe resolve mais rápido.\n- Algumas artes podem ser baixadas em "Baixar PNG" ou "Baixar PDF".\n' +
      'Cuidado:\n- Só aprova quem tem permissão de aprovar na conta. Se os botões não aparecem, a sua conta é só de acompanhamento: peça à Branding7 para liberar.\n- Depois de aprovado, o material segue para a produção/publicação.'
  },
  'portal-linha': {
    titulo: 'Portal do cliente: linha editorial', grupo: 'Portal do cliente',
    texto: 'Onde fica: menu → "Linha Editorial".\nServe para: ver o planejamento de conteúdo do mês que foi liberado para você: os temas, os formatos e as datas previstas.\n' +
      'Dicas:\n- Só aparece o que a agência já liberou para o Portal. Se o mês ainda não está lá, ele ainda está sendo preparado.'
  },
  'portal-producao': {
    titulo: 'Portal do cliente: produção', grupo: 'Portal do cliente',
    texto: 'Onde fica: menu → "Produção".\nServe para: acompanhar em que etapa está cada peça (arte, vídeo) da sua empresa — em criação, em revisão, aguardando você, aprovada, publicada.\n' +
      'Dicas:\n- Use os filtros do alto para ver só um tipo ou só o que está aguardando você.'
  },
  'portal-gravacoes': {
    titulo: 'Portal do cliente: gravações', grupo: 'Portal do cliente',
    texto: 'Onde fica: menu → "Gravações".\nServe para: ver as gravações marcadas com a sua empresa (dia, horário e local) e o que vai ser gravado, quando a agência libera.\n' +
      'Dicas:\n- Precisa remarcar? Fale com a Branding7 pelo Suporte ou pelo contato de sempre: a data é combinada com a equipe.'
  },
  'portal-status': {
    titulo: 'Portal do cliente: status semanal e histórico', grupo: 'Portal do cliente',
    texto: 'Onde fica: menu → "Status Semanal" e menu → "Histórico".\nServe para: ler o resumo da semana que a agência prepara para você e consultar o que já foi decidido e entregue antes.'
  },
  'portal-perfil': {
    titulo: 'Portal do cliente: meu perfil, senha e segurança', grupo: 'Portal do cliente',
    texto: 'Onde fica: menu → "Meu perfil" (ou a sua foto, no topo).\nServe para: trocar o nome que aparece, a foto, a senha e ligar a verificação em 2 etapas.\n' +
      'Passo a passo para trocar a senha:\n1. Abra "Meu perfil" e toque em "Editar perfil e foto".\n2. Vá na aba "Segurança": em "Trocar senha", escreva a senha atual, a nova e repita a nova.\n3. Toque em "Trocar senha".\n' +
      'Verificação em 2 etapas: na mesma aba "Segurança", escolha "Código por e-mail" (chega um código ou um botão "Sou eu" no seu e-mail a cada entrada) ou "App autenticador".\n' +
      'Cuidado:\n- Esqueceu a senha e não consegue entrar? Fale com a Branding7: por segurança, a senha é redefinida pela equipe.\n- Ninguém da Branding7 pede a sua senha ou o código que chega no e-mail.'
  },
  'portal-suporte': {
    titulo: 'Portal do cliente: suporte', grupo: 'Portal do cliente',
    texto: 'Onde fica: menu → "Suporte".\nServe para: tirar dúvidas sobre o Portal, relatar um problema ou mandar um elogio/sugestão.\n' +
      'Como funciona:\n1. Escreva a dúvida: as perguntas frequentes aparecem na hora.\n2. Se não resolver, abra um chamado: o assistente responde primeiro e, se precisar, chama alguém da equipe.\n' +
      '3. Quando resolver, toque em "Resolveu" e avalie o atendimento. Chamado encerrado não recebe mais mensagens: para outro assunto, abra um novo.'
  }
};
