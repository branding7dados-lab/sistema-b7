# zzz241: o miolo das seções no estilo do modelo

Pedido do Kevin, com um print da página "Conta e segurança" do Canva: "não gostei desse design de quando eu clico dentro das seções, vamos tirar os ícones de dentro das seções e deixar algo mais normal… com nossa identidade visual".

## O que mudou dentro das seções
- **Cabeçalho:** título grande (30px) e a descrição embaixo, sem o ícone.
- **Grupos:** título grande, em letra normal, e a explicação logo abaixo (antes a explicação ficava depois da lista).
- **Cartões:** borda fina, cantos de 14px, sem sombra. As linhas são separadas por traço de ponta a ponta.
- **Linhas:**
  - sem ícone;
  - título em negrito e explicação embaixo;
  - à direita, o controle (chave, lista, contador) ou, nas linhas clicáveis, um **botão contornado com a ação**. O botão ganha a cor da marca ao passar o mouse; nas ações perigosas, como Sair, ele fica vermelho.
- **Rótulo do botão** (`acaoDe` em `L()`):
  - o verbo do próprio título, quando ele começa por um (Sair, Buscar, Atualizar, Limpar, Instalar, Testar, Enviar, Publicar, Editar, Exportar, Restaurar, Configurar, Visualizar, Refazer);
  - "Baixar" ou "Verificar" para os apps;
  - "Alterar" quando a linha mostra um valor (ex.: Recursos → "Todos");
  - "Abrir" nos demais casos.
- O mosaico da Administração saiu: todas as seções usam o mesmo estilo.
- O menu de seções, à esquerda no computador e como primeira tela no celular, continua com os ícones coloridos.

## Conferido
- Capturas no computador, em tema claro e escuro: Conta, Equipe e acessos, Aparência e Sistema da equipe.
- Capturas no celular, com a seção Conta aberta.
- `npm test` passou.

## zzz242: menos "Abrir"
Kevin: "achei que ficou muito repetitivo esse trem de abrir toda hora".
- O botão contornado aparece só quando a linha **faz** algo: Sair, Buscar, Atualizar, Limpar, Instalar, Testar, Enviar, Publicar, Exportar, Restaurar, Visualizar, Refazer, e Baixar/Verificar nos apps.
- A linha que só abre outra tela ou janela fica com uma setinha discreta à direita, que acende com a cor da marca ao passar o mouse. A linha inteira continua clicável.
