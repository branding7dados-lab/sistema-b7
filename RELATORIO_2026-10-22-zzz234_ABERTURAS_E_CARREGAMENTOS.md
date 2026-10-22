# zzz234 — 5 aberturas novas e 5 telas de carregamento

Pedido do Kevin: "quero 5 novos modelos de abertura, a mesma coisa pro carregamento".

## Aberturas novas
Cada uma tem cena própria (desenhada em `js/abertura-cenas.js`), logo e palavra no CSS (`styles/abertura.css`) e trilha própria (`js/abertura-som.js`).

| Estilo | Duração | O que acontece |
|---|---|---|
| Tinta | 4,2 s | gotas de tinta nas cores da marca se abrem e giram até o centro; o logo nasce da tinta (2,3 s) |
| Glitch | 4,2 s | terminal com "B7_SISTEMA" digitado, faixas quebradas, estouro (1,7 s) e o logo entra seco |
| Aurora | 4,2 s | céu estrelado com cortinas de aurora; o logo aparece devagar (1,6 s) |
| Neon | 3,8 s | o letreiro liga piscando, com faíscas e brilho na parede; a palavra pisca depois |
| Mosaico | 4,2 s | quadrados viram das bordas até o centro e se abrem revelando o logo |

Todas terminam com o logo em repouso (o voo para a barra continua igual) e seguem as regras de leveza: o logo só mexe transform/opacidade; o canvas usa 1x no celular.

## Telas de carregamento (versão curta)
Relâmpago (o atual, continua padrão), Pulso, Órbita, Barra, Brilho e Pontos. Trocam só o indicador, em cima da mesma cena de estrelas.

## Onde escolher
- Cada pessoa: Configurações → Aparência → "Estilo da abertura" e "Tela de carregamento". O aviso traz "Ver agora" (antes ele mandava tocar em "Testar abertura", botão que só o administrador vê).
- Administrador: modal "Abertura do sistema" ganhou "Tela de carregamento" para todos, com botão Testar.

## Banco
`migration_abertura_cenas.sql` (já aplicada): `abertura_definir` aceita os estilos novos e `carregamento`; `abertura_config` preenche os padrões; `sistema_avisos` devolve `carregamento`.

## Conferido
- Quadros de cada abertura e de cada carregamento (desktop) e trilha renderizada offline sem erro.
- `npm test` passou (inclui o repouso final dos 9 estilos).
