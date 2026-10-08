# Relatório — Confirmações montadas à mão também viram alerta; menu "⋯" fecha ao abrir janela

**Versão:** `2026-10-08-zzz106` · **Cache:** `roteiros-b7-v311`
**Relato:** print da janela "Excluir C6 Farma?" ainda no formato antigo, com o menu "⋯" do cliente aberto e nítido por cima do fundo desfocado.

## Por que a zzz105 não pegou essa janela
O desenho de alerta foi aplicado à peça padrão de confirmação. Mas o sistema tem **34 janelas montadas à mão** nas telas, sem usar essa peça — a de excluir cliente é uma delas, porque tem o campo de digitar o nome.

## O que mudou
1. **Toda janela que é só pergunta vira alerta, sozinha.** Ao abrir, o sistema confere: se a janela tem apenas título, texto e até dois botões, ganha o desenho de alerta — mesmo montada à mão em alguma tela. Janelas com campos, listas ou mais botões continuam como formulário.
2. **Excluir cliente** passou a usar o alerta, com o campo de digitar o nome dentro dele (rótulo e campo centralizados) e o botão "Excluir cliente" em vermelho. A regra é a mesma: o botão só libera com o nome digitado certo.
3. **O menu "⋯" fecha quando uma janela abre.** Ele ficava aberto e nítido por cima do fundo desfocado. Vale também para o menu do botão direito.

## Arquivos alterados
`js/ui.js`, `js/dashboard.js`, `styles/global.css`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local, na tela de Clientes, sem tocar em nenhum cliente real (as janelas de teste foram montadas com a mesma marcação):
- menu "⋯" de um cliente aberto, depois uma janela aberta: o menu fechou;
- janela só com título, texto e dois botões, montada à mão: recebeu o alerta sozinha;
- janela com um campo, montada à mão: **não** virou alerta (continua formulário);
- a janela de excluir cliente no formato novo, conferida em captura.

## Não testado
- As 34 janelas uma a uma. A regra é automática; alguma pergunta com texto muito longo pode ficar apertada na caixa estreita.
- O fluxo real de excluir um cliente (não executei, para não apagar nada).
- Celular e tema escuro.
