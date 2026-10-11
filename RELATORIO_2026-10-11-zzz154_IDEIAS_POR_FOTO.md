# Relatório — Ideias por foto (zzz154, 11/10)

Pedido do Kevin: "briefing por foto". Tirar foto da vitrine, do produto ou do
cardápio do cliente, e a IA sugere ideias de conteúdo que já viram rascunho na
linha editorial.

## Como usar
1. Botão **+** do topo → **Ideias por foto**. Nas telas de Linha editorial ele
   aparece primeiro.
2. Escolher o **cliente** e o **mês da linha** (este ou o próximo). Se quiser,
   dizer o que é a foto ("vitrine nova", "prato do dia").
3. **Tirar ou escolher a foto.** No celular, o Android oferece a câmera ou a galeria.
4. O assistente abre numa conversa nova, com o cliente em foco e a foto anexada,
   e devolve **3 ideias** (Reel, Card, Carrossel ou Story), cada uma com o motivo.
5. Cada ideia vem com o cartão **"Adicionar conteúdo à linha editorial"**: um
   toque e ela entra na linha do mês.

## Como funciona
- É o assistente de sempre. Ele já lia imagem (zzz128) e já propunha conteúdo
  para a linha (zzz127). O "Ideias por foto" junta as duas coisas: escolhe o
  cliente, anexa a foto reduzida e escreve o pedido.
- A IA lê a estratégia e o tom do cliente (linha editorial, posicionamento),
  então as ideias combinam com ele.
- Quem pode: administrador e coordenação, as mesmas pessoas que criam conteúdo
  na linha. Some se o recurso "imagem no assistente" estiver desligado.
- A foto não é guardada, igual às outras imagens do assistente.

## Testes
- Navegador com a IA simulada:
  - "Ideias por foto" aparece no menu +;
  - escolher cliente e foto abre o assistente com o cliente em foco;
  - o pedido vai com a imagem;
  - a resposta mostra o cartão de adicionar conteúdo.
- `testes/` ok.
- **Não testado:** com a IA de verdade e no celular.

Versão `2026-10-11-zzz154`, cache `v359`.
