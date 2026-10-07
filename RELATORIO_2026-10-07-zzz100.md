# Relatório — "Sua conta" no celular, redesenhada no padrão iOS

**Versão:** `2026-10-07-zzz100` · **Cache:** `roteiros-b7-v305`
**Pedido:** a folha "Sua conta" do celular mais bonita (print do Kevin).

## O que mudou (só a folha do celular)
- **Pessoa centralizada no alto:** foto maior com o anel colorido, nome grande, @usuário e as funções em pílulas — sem a caixa rosada com mancha de luz.
- **Blocos brancos sobre fundo cinza-lilás**, como a tela de Ajustes do iOS:
  - bloco das opções (Meu perfil, Preferências, Usuários, Visualizar como…), com um fio fino entre as linhas que começa depois do ícone;
  - bloco da Aparência, com o seletor Sistema / Claro / Escuro em trilho cinza e pílula branca;
  - bloco próprio para **Sair da conta**, centralizado e em vermelho, sem ícone.
- **Ícones menores e mais discretos** (quadrado arredondado, sem sombra), texto das linhas um pouco maior e mais leve.
- **Cabeçalho da folha:** "Sua conta" pequeno e cinza, e o fechar como botão redondo cinza.
- A folha passou a caber inteira sem rolar num celular comum; se precisar rolar, não mostra barra.

O menu da conta **no computador** não mudou. Nenhuma opção foi acrescentada, tirada ou trocada de lugar.

## Correção junto
Na versão anterior, a barra de status escurecia demais quando o que abria era uma folha do celular (ela usa um véu mais leve que o das janelas). Agora a cor é calculada com o véu da própria folha.

## Sobre a faixa preta no rodapé do print
A faixa preta embaixo (onde fica o traço de gesto do Android) é a barra de navegação do aparelho. Não tratei nesta versão: a cor dela, no app instalado, vem de uma declaração que também define a cor da tela de abertura, e mudar uma muda a outra.

## Arquivos alterados
`styles/topo.css`, `js/app.js`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, em tamanho de celular (375×812), tema claro:
- uma captura da folha aberta, conferida visualmente (pessoa centralizada, blocos, fios, seletor de aparência);
- depois dos últimos ajustes, medidas: a folha tem 667 de 812 px de altura, o conteúdo não rola, "Sair da conta" fica dentro da tela e o botão de fechar tem 30×30.

## Não testado
- A captura final depois dos últimos ajustes (altura, botão de fechar redondo) não saiu; esses foram conferidos só por medida.
- Tema escuro.
- Conta de cliente e "dentro da conta de outra pessoa" (mudam as linhas e o texto do Sair).
- Aparelho físico.
