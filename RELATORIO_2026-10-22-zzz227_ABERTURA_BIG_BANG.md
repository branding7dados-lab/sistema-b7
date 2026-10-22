# Relatório zzz227 — Abertura "Big bang de ideias"

Pedido do Kevin: "Quero uma animação de abertura mais foda que essa que está agora."

## O que mudou
A abertura de cinema continua: céu, ignição, clarão, flare, raios, logo voando para o lugar e a onda de luz que monta o sistema. O som segue sincronizado. Por cima dela entra uma camada de **partículas** (`js/abertura-particulas.js`, desenhadas em `<canvas>`):

| Tempo | O que acontece |
|---|---|
| 0–1,6 s | centenas de pontos de luz giram como uma galáxia, com rastro |
| 1,6–3,1 s | a galáxia se fecha em espiral e os pontos **montam a lâmpada do B7**, cada um com a cor do pixel do logo |
| 2,9–3,3 s | a carga de luz sobe por dentro dos pontos |
| 3,4 s | ignição: a lâmpada de verdade acende por cima e os pontos **explodem em faíscas** |
| 4,4–5,2 s | outros pontos saem da lâmpada e **escrevem o "Branding7"** da esquerda para a direita, junto com a palavra |

- O relógio é o da própria animação CSS. Se a aba fica em segundo plano, as duas param juntas.
- As partículas seguem a peça real na tela: crescem, tremem e recuam junto com a lâmpada.
- O tamanho do brilho acompanha o tamanho da lâmpada, então no celular não estoura.
- Se o aparelho não acompanha (quadros lentos), metade das partículas deixa de ser desenhada e o rastro sai.

## Quando não roda (fica a abertura de antes, sem mudança)
- Versão curta (recarregar, entre o login e o sistema).
- "Reduzir movimento" ligado, ou modo leve.
- Configurações → Aparência → **"Partículas na abertura"** desligado. A chave é deste aparelho e continua depois de sair da conta.
- Imagem do logo que não pode ser lida (ex.: arquivo local) ou que demorou demais para carregar.

Vale também para "Testar abertura" e para o Painel de TV ("Só a animação da B7" e vinheta).

## Testes feitos
- Quadros em 0,6 s, 1,4 s… 6 s no computador e no celular. Vídeo de 30 quadros por segundo da sequência inteira.
- Abertura some no fim sem deixar o canvas para trás.
- "Testar abertura" roda com partículas.
- Recarregar mostra a curta sem partículas.
- Com a chave desligada, fica a abertura antiga.
- Nenhum erro no console.

## Não testado
- Em aparelho Android real e no programa de Windows (se o programa abrir os arquivos localmente, a abertura volta sozinha à antiga).
