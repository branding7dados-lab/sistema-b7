# Relatório zzz291 — Rodapé "Visualizando como" (prévia / acompanhar)

Kevin: quando está visualizando/acompanhando como alguém, o rodapé "Visualizar como…" devia mostrar a foto + o nome da pessoa e um botão com ícone de ciclo para voltar à conta dele, com animação.

## O que muda (js/previa-usuario.js, styles/aovivo.css)
- No rodapé da barra lateral (`#ver-como`), quando há uma **visualização ativa** (Só visualizar ou Acompanhar ao vivo), aparece:
  - a **foto** da pessoa (com anel pulsando) e **"Visualizando como — <nome>"**;
  - um botão **"↻ Voltar para minha conta"** com **ícone de ciclo contínuo que gira sozinho** (acelera no hover). Clicar sai da visualização (e encerra o acompanhamento ao vivo, se houver).
- A pessoa agora carrega a **foto** (`alvo.foto` / `avatar_url` em "Usuários"), para o avatar aparecer.
- Entrada animada do bloco. Respeita "reduzir movimento".
- O "Entrar na conta" (estar na conta de outro) continua com o seu próprio bloco e o "Voltar para minha conta" de sempre.

## Testes
- `npm test` passou. Conferido no navegador: ao acompanhar, o rodapé mostra foto + "Visualizando como Kaique" + o botão de ciclo; clicar volta para a conta.
