# Relatório — Ícones no estilo iOS, etapa 2: topo, Configurações, Painel, Vídeo e Gravações

**Versão:** `2026-10-08-zzz104` · **Cache:** `roteiros-b7-v309`
**Pedido:** os grupos 1, 2 e 3 da lista de ícones.

## O que mudou
**81 ícones trocados** em dez arquivos:

| Onde | Trocas |
|---|---|
| Barra do topo, "+ Criar" e "Sua conta" | 14 |
| Peças compartilhadas (busca, janelas) | 6 |
| Assistente de IA | 2 |
| Configurações e telas de cliente (mesmo arquivo) | 31 |
| Painel (os quatro painéis) | 13 |
| Produção de Vídeo | 7 |
| Gravações | 8 |

**Como ficaram**
- Um **mesmo desenho para a mesma coisa** em todas essas telas. Antes havia, por exemplo, cinco calendários, seis "pessoas", três lupas e quatro documentos ligeiramente diferentes; agora cada um é um só, igual ao da navegação.
- Formas no espírito do iOS: cantos mais redondos, pessoa com ombros fechados, casa e documento com quinas arredondadas, triângulo de alerta e de "play" com pontas suaves, lápis, impressora e cadeado redesenhados.
- **Traço na mesma espessura** da navegação nos botões e nos botões de ícone.

**O que ficou igual de propósito**
Setas, "+", "X", visto, reticências e as listas de linhas: já são traços simples, iguais aos do iOS. Também não mexi em ícones que só existem num lugar e já estavam no padrão (sol, lua, raio, som, banco de dados, wi-fi, sino, câmera, estrela, link, alfinete).

## Arquivos alterados
`js/topo.js`, `js/ui.js`, `js/ia-chat.js`, `js/dashboard.js`, `js/painel.js`, `js/painel-coord.js`, `js/painel-design.js`, `js/painel-multi.js`, `js/video.js`, `js/gravacao.js`, `styles/global.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local:
- **folha com os 87 ícones diferentes** desses arquivos, desenhados lado a lado e conferidos numa captura: todos aparecem inteiros, sem desenho quebrado nem vazando do quadro, e com a mesma família de formas;
- as telas de Configurações, Painel, Produção de Vídeo e Gravações abrem normalmente depois da troca, com os ícones presentes (contagem conferida).

## Não testado
- **Cada ícone no lugar onde é usado.** Vi todos na folha de teste, em tamanho grande e traço escuro; não vi um por um dentro dos botões e cartões, em tamanho pequeno e nas cores reais. Algum pode ter ficado pesado ou fino demais no contexto.
- Tema escuro e celular.

## O que ainda falta
Design, Produção (quadro), Calendário, Publicações, Status semanal, Usuários, Linhas e conteúdo, Teleprompter, Portal do cliente e os documentos/impressões — cerca de 150 desenhos, muitos repetidos dos que já foram redesenhados aqui.
