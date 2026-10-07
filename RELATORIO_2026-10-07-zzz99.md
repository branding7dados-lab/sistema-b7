# Relatório — Estilo iOS: barra de status, botões em cápsula e sombras mais leves

**Versão:** `2026-10-07-zzz99` · **Cache:** `roteiros-b7-v304`
**Pedido:** barra de status e área do entalhe; botões em cápsula; sombras mais leves.

## 1. Barra de status e área do entalhe
**O que já existia (não mexi):** a tela já ocupa a área do entalhe, o topo e a barra inferior já respeitam as margens seguras do aparelho, e a barra de status já pegava a cor do topo.

**O que mudou:**
- **A barra acompanha o que está na frente**, como no iOS:
  - janela aberta: escurece junto com o véu (antes ficava uma faixa clara acima da tela escurecida);
  - teleprompter aberto: preta;
  - assistente em tela cheia no celular: a cor do painel dele.
- **iPhone e iPad:** o app instalado passou a se declarar como aplicativo para o iOS, com o nome "Sistema B7" e barra de status no modo padrão.

**Limite do aparelho:** no iPhone, conteúdo passando *por baixo* da barra de status só existe com relógio e ícones brancos. No tema claro isso deixaria o relógio ilegível, então mantive a barra na cor do topo — ela se funde com ele, mas o conteúdo não rola por trás dela.

No computador com o app instalado, a mesma cor vale para a barra de título da janela: ela também escurece quando uma janela abre.

## 2. Botões em cápsula
- Todos os botões padrão ficaram com as pontas totalmente redondas e um pouco mais de respiro nas laterais.
- Os botões de ícone (fechar, "⋯" e afins) ficaram redondos.
- Criado um terceiro peso, **tonalizado** (fundo magenta bem claro, texto magenta), ao lado do cheio e do cinza. Ele está disponível, mas ainda **não foi aplicado em nenhuma tela**: escolher onde usar muda a ênfase de cada botão, e isso eu faço tela por tela.

**Não mudaram:** cerca de dez botões grandes de formulário (os de largura inteira em janelas como nova gravação, novo usuário e perfil), que têm formato próprio de retângulo arredondado — que é também o formato do iOS para botão grande.

## 3. Sombras mais leves
- Reduzi a força de **153 sombras** em 19 arquivos de estilo para cerca de 60% do que eram: cartões, janelas, menus, botões principais, tanto no tema claro quanto no escuro.
- **Ficaram como estavam:** anéis de foco, fios de 1–2 px que funcionam como borda, brilhos internos, e as telas de abertura, teleprompter e impressão.
- Sombras escritas de outra forma (com mistura de cores) não foram alteradas; são minoria.

## Arquivos alterados
`index.html`, `js/app.js`, `styles/*.css` (19 arquivos), `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, em 1280×800, tema claro:
- cor da barra: clara sem janela; escurece ao abrir uma janela; preta com o teleprompter marcado como aberto; volta ao fechar;
- captura da tela de Usuários: botões em cápsula, sombras mais leves, nada fora do lugar;
- captura de uma janela de teste com os quatro tipos de botão (cinza, tonalizado, contorno, cheio).

## Não testado
- **Nenhum aparelho físico**: não vi a barra de status em iPhone nem em Android, nem a área do entalhe. O comportamento no iPhone depende da versão do iOS.
- Tema escuro.
- Demais telas: a redução de sombras foi feita por regra em todos os arquivos, e só olhei a tela de Usuários. Pode haver algum cartão que ficou "chapado" demais.
- O app já instalado no iPhone pode precisar ser removido e instalado de novo para pegar as novas declarações.
