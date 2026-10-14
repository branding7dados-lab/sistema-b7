# Relatório — sistema de cores, tela de aparência e Configurações (zzz163, 14/10)

## 1. "Quando muda a cor" — o que estava errado
Ao trocar a cor (por exemplo para Floresta), boa parte do sistema **continuava
roxa e rosa**: o item marcado no menu lateral, o cabeçalho do Panorama, o
cartão do perfil, sombras dos botões, eventos do calendário, brilhos das
telas. Motivo: mais de 180 lugares do visual tinham o roxo/rosa da B7
**escritos à mão**, em vez de usar "a cor do sistema".

Agora esses lugares usam a cor escolhida. Com a cor padrão B7 **nada muda**:
comparei as telas antes e depois, pixel a pixel, no claro e no escuro.

Ficaram de fora de propósito (continuam com cor fixa):
- cores de **status** (atrasado, em andamento, em dia, erro) — mudar com a
  paleta faria "em andamento" ficar verde igual a "em dia";
- os ícones coloridos das listas (estilo Ajustes do iPhone);
- a abertura, a tela de login, o Painel de TV, o teleprompter, o "Meu dia" e
  as folhas que vão para o cliente (PDF e imagem do status semanal) — são da marca.

## 2. Tons neutros acompanham a cor
O fundo, as bordas e os cinzas dos textos do B7 têm um "puxado" para o lilás.
Com outra cor isso destoava (verde em cima de fundo lilás). Agora, fora do
padrão B7, os neutros giram para o tom da cor escolhida — mesma claridade,
então a leitura não muda. A paleta Grafite fica com cinzas quase puros.

## 3. Sua cor (qualquer cor)
- Dá para digitar o **código da cor** (ex.: #1E88E5) além do seletor.
- O B7 **garante a leitura**: se a cor escolhida for clara demais (um amarelo,
  por exemplo), ela é escurecida até o texto branco do botão ficar legível, e
  no tema escuro clareada até dar para ler sobre o fundo. A tela avisa quando
  ajustou.

## 4. Tela "Minha aparência" / "Aparência do sistema"
- Prévia maior e mais fiel: menu lateral com o item marcado, topo com o botão
  Criar, cabeçalho escuro, cartão, etiqueta, botões e chave liga/desliga.
- Cores em **bolinhas** com o ✓ na escolhida (antes eram cartões grandes).
- No celular a prévia fica **presa no alto**, menor, e as opções rolam por baixo.
- Trocar de cor faz a tela inteira **esmaecer suave** para a nova cor (onde o
  navegador permite; respeita "animações desligadas").
- Fechar a janela por qualquer caminho (Esc, tocar fora) agora **desfaz** a
  prévia. Antes só o botão Cancelar desfazia — com Esc a cor ficava aplicada
  sem estar salva.
- Administrador: botão **"Voltar ao padrão B7"**. Pessoal: **"Usar a da equipe"**.

## 5. Configurações
- **Procurar um ajuste**: campo no alto que procura em todas as abas ao mesmo
  tempo (ex.: "som", "senha", "backup").
- Abas com ícone (no computador).
- Na aba Aparência, **"Cor do sistema" virou a primeira linha**, com as
  bolinhas ali mesmo: tocar troca na hora, só para você. "Mais opções" abre a
  janela completa (menu, botões, brilho, sua cor).

## 6. Novidades
Este pacote entrou nas Novidades do B7 (a equipe vê o cartão ao atualizar).

## Arquivos
- `js/admin-extra.js` — neutros por paleta, `--base-*`, contraste na cor
  personalizada, nova janela, `escolherRapido` e `bolinhas`.
- `js/dashboard.js` — cor rápida, procurar ajuste, ícones das abas.
- `styles/*.css` — cores fixas trocadas pelas da paleta; `styles/sistema.css`
  (janela de aparência) e `styles/dashboard.css` (Configurações).
- `js/novidades.js`, `js/auth.js` (versão zzz163), `sw.js` (cache v367).
