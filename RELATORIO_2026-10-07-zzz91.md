# Relatório — Três defeitos do chat vistos no vídeo

**Versão:** `2026-10-07-zzz91` · **Cache:** `roteiros-b7-v296`
**Origem:** vídeo do Kevin (07/10, 17:40), analisado quadro a quadro.

## O que o vídeo mostra
1. **Resposta contraditória da IA.** O pedido "faça uma demanda de edição de trend para atacadão dos suplementos" voltou com o texto "Não consegui montar a proposta. Diga o cliente e o título da demanda." e, logo abaixo, o cartão pronto com cliente e título — que foi confirmado e criou a demanda.
2. **Aviso de versão em cima do chat.** O cartão "Nova versão do B7" apareceu sobre o campo de escrever do chat, tampando-o.
3. **Chat piscando na troca de tela.** Ao ir de Configurações para Produção de Vídeo, o painel do chat virou um fantasma transparente por um instante e depois voltou.

## Causa e correção de cada um
1. **Texto errado.** O modelo devolveu só a proposta, sem frase nenhuma. O servidor, ao ver o texto vazio, colocava a mensagem de falha mesmo com a proposta válida. Agora, com proposta válida e sem frase, o texto é "Montei a proposta abaixo. Confira os dados e confirme para criar." A mensagem de falha só aparece quando não há proposta. (Função `b7-ia` publicada.)
2. **Aviso sobre o chat.** Com o chat aberto, o aviso de versão agora fica **ao lado** do painel, à esquerda. Em janela estreita demais para os dois lado a lado, vai para o topo da tela.
3. **Fantasma na troca de tela.** A animação de troca de página desenhava a página nova por cima do chat. O chat, o botão dele e o aviso de versão passaram a ficar numa camada acima, parados, como já acontecia com a barra do topo.

## Observação sobre a demanda criada no teste
A demanda "Edição de trend", do Atacadão dos Suplementos, **foi criada de verdade** quando o cartão foi confirmado no vídeo. Está na Edição de vídeo como Pendente, sem prazo e sem responsável. Se era só teste, dá para descartar por lá.

## Arquivos alterados
`supabase/functions/_shared/ia/chat.ts` (função `b7-ia` publicada), `styles/global.css`, `styles/ia-chat.css`, `js/auth.js`, `sw.js`.

## Testes executados
- Conferi no arquivo publicado o texto novo e as regras de estilo.
- Servidor: `b7-ia` publicada e respondendo.

## Não testado
Não reproduzi nenhum dos três em tela: o navegador de teste não roda a animação de troca de página nem mostra o resultado visual, e a IA real eu não consigo chamar. Os três consertos foram feitos pela causa lida no código e no vídeo. Vale repetir o mesmo roteiro do vídeo depois de atualizar.
