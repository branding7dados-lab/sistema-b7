# Relatório — Assistente: várias propostas na mesma resposta

**Versão:** `2026-10-08-zzz124` · **Cache:** `roteiros-b7-v329`
**Pedido:** print do assistente respondendo "deixo as propostas abaixo para você confirmar" sem mostrar proposta nenhuma, depois de "Crie 2 demandas para Arena Deck…".

## A causa
O assistente propõe uma demanda terminando a resposta com uma marca interna, que o servidor transforma no cartão de confirmação. O servidor só aceitava **uma** marca por resposta. Quando o pedido era de duas demandas, a IA mandava duas marcas e o servidor **descartava as duas**: sobrava só a frase "seguem as propostas", sem cartão.

Não tem relação com a resposta em fluxo de hoje: o defeito existe desde que o assistente passou a propor ações (zzz89).

## O que mudou
- **Até 5 propostas por resposta**, cada uma com o seu cartão e os seus botões. Confirmar ou cancelar uma não mexe nas outras.
- **A frase que acompanha os cartões agora é fixa** ("Montei as 2 propostas abaixo. Confira os dados e confirme cada uma para criar."). Antes a IA às vezes escrevia "acesse a tela de Edição de Vídeo" junto das propostas.
- **O título passa a dizer o que é a peça**, com as suas palavras: "Flyer animado — Noite do Pop Rock", em vez de só "Noite do Pop Rock".
- Proposta repetida não vira dois cartões. Se alguma não puder ser montada (cliente fora da lista, sem título), o texto avisa.

Continua igual: nada é criado sem você tocar em "Criar demanda", e quem cria é a função de sempre, com as suas permissões.

## Arquivos alterados
`supabase/functions/_shared/ia/chat.ts`, `supabase/functions/b7-ia/index.ts` (função publicada), `js/ia.js`, `js/ia-chat.js`, `sw.js`, `js/auth.js` (versão).

## Testes executados
Função publicada, dados reais, app local:
- o mesmo pedido do print, pela função: 2 propostas (Arena Deck · Misturinha na Deck · Noite do Pop Rock), sem a marca interna aparecer no texto em fluxo;
- o mesmo pedido pela tela do assistente: a frase fixa e **dois cartões**, com os títulos "Flyer animado — Misturinha na Deck" e "Flyer animado — Noite do Pop Rock"; conferido em captura;
- "Cancelar" no primeiro cartão: só ele virou "Cancelado. Nada foi criado."; o segundo continuou com os botões.

## Não testado
- **Tocar em "Criar demanda"** (criaria uma demanda de verdade na Arena Deck; não toquei).
- Pedido de uma demanda só depois da mudança (o caminho é o mesmo, mas não repeti).
- Mais de 5 demandas num pedido; cliente que não existe; conta de videomaker.
- Reabrir a conversa pelo histórico: os cartões não são guardados, só o texto (já era assim).

## Rastros do teste
Três conversas de teste no histórico do assistente do Kevin, com o pedido da Arena Deck. Nenhuma demanda foi criada.
