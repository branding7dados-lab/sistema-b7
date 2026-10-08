# Relatório — Folha "Mais" do celular redesenhada e animada

**Versão:** `2026-10-07-zzz103` · **Cache:** `roteiros-b7-v308`
**Pedido:** melhorar e animar a folha "Mais" (print do Kevin, tema escuro).

## O problema do desenho antigo
Cada seção era uma caixa grande com ícones de app soltos dentro. Seções com um único destino (Principal, Meu trabalho) viravam uma caixa quase vazia, e todos os ícones tinham a mesma cor.

## O que mudou
**Desenho**
- Os destinos viraram **blocos compactos em duas colunas**: ícone colorido à esquerda, nome ao lado.
- As caixas das seções saíram; ficou só o título pequeno de cada uma.
- **Uma cor por destino**, como os ícones de Ajustes do iOS (Clientes azul-petróleo, Aprovações verde, Design rosa, Produção roxo, e assim por diante). Os ícones são cheios, em branco.
- A tela em que você está aparece com o bloco tingido da cor dela e um contorno.
- Fundo cinza-lilás com blocos brancos no tema claro; blocos translúcidos no escuro.
- A folha cabe inteira sem rolar num celular comum (antes rolava).

**Animação**
- Os blocos **entram em cascata**, de baixo para cima, com mola.
- O ícone de cada bloco chega um instante depois, com um pequeno giro que assenta.
- Ao tocar, o bloco encolhe de leve.
- Quem pede menos movimento no aparelho, ou usa o modo leve, não vê essas animações.

Nenhum destino foi acrescentado, tirado ou trocado de seção.

## Correção junto
O aviso "Nova versão do B7" aparecia **por cima** da folha aberta, tampando destinos. No celular, ele agora espera a folha ou janela fechar. O aviso obrigatório (o de "atualizar todos") continua aparecendo sempre.

## Arquivos alterados
`styles/nav.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, em tamanho de celular (375×812), tema claro, conta de administrador:
- duas capturas da folha aberta, conferidas visualmente (duas colunas, cores por destino, ícones cheios);
- medidas: 15 destinos, a folha não rola, e sobra espaço acima dela;
- o aviso de versão fica inativo com a folha aberta e volta ao fechar.

## Não testado
- **A animação.** O navegador de teste não roda animações; para a captura eu as desliguei. A cascata e o giro do ícone precisam ser vistos no celular.
- **Tema escuro**, que é o do print do Kevin: escrito, não visto.
- Contas com menos destinos (designer, videomaker) e o bloco "onde você está".
- Aparelho físico.
