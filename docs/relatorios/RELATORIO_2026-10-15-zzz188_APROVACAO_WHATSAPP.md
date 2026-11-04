# zzz188 — Aprovação pelo WhatsApp e Portal pausado

- **Botão "Cliente respondeu"** no bloco de aprovação (linha editorial, roteiro) quando a versão está aguardando: escolhe Aprovou / Pediu ajustes / Recusou, o canal (WhatsApp padrão) e o que o cliente disse. RPC nova `aprov_registrar_externa` (aplicada) — mesma regra do Design: só Administrador/Coordenador, grava origem externa + canal, emite o evento normal.
- **Portal pausado** (`B7.PORTAL_PAUSADO = true` em `js/aprovacoes.js`): some "Enviar pelo Portal do Cliente" do Design; o envio da linha explica que só marca como enviada. Nenhuma conta de cliente está ativa hoje.
- A linha do Dr. Fabrício (Outubro 2026, v1) continua "Aguardando cliente" até alguém clicar em "Cliente respondeu → Aprovou".
