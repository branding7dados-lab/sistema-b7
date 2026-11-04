# Relatório zzz285 — Equipe ao vivo (parte 2): acompanhar ao vivo

Continuação da parte 1. Só super admin / admin supremo.

## O que entra
- Em "Equipe ao vivo", cada pessoa online ganha o botão **Acompanhar**. O super passa a ver a tela da pessoa ao vivo:
  - a tela vai para a **mesma rota** que a pessoa está (segue a troca de tela);
  - **rola junto** (proporcional, porque as telas podem ter alturas diferentes);
  - mostra o **cursor da pessoa** com o primeiro nome. O cursor do super NÃO vai para a pessoa.
  - barra no topo "Acompanhando Fulano · Parar"; ao parar, a tela do super volta para onde estava.
  - se a pessoa minimiza ou sai, a barra mostra "esperando".
- **Selo na tela de quem é acompanhado:** enquanto houver alguém acompanhando, aparece **"Tela compartilhada"** (canto inferior). É a ciência mínima combinada: a pessoa tem como saber. O selo aparece para QUALQUER acompanhamento — não dá para acompanhar sem ele (nem um cliente adulterado consegue, porque o selo nasce do próprio pedido de olhar).

## Tempo real e custo
- Tudo pelo mesmo canal `b7-aovivo` (Supabase Realtime), por broadcast: `av-olhar` (começar/manter), `av-parar`, `av-tela` (rota + rolagem + cursor).
- Só se transmite enquanto há de fato alguém acompanhando. Sem ninguém olhando, nada sai. Cursor no máximo ~12×/s, rolagem ~7×/s, só durante o acompanhamento.
- O super manda um "ping" a cada 9 s; se sumir, o lado da pessoa derruba o acompanhamento sozinho em ~26 s (e o selo some).
- Aba escondida de quem é acompanhado para de transmitir e tira o selo.

## Termos
- Já coberto pela linha da seção 2 (zzz284): o uso do Sistema pode ser acompanhado, inclusive em tempo real.

## Testes
- `testes/aovivo.test.mjs` ampliado (exporta acompanhar; trava de permissão). `npm test` passou.
- Conferido em duas telas simuladas: o selo "Tela compartilhada" na pessoa; a barra + o cursor da pessoa no super.

## Observações
- A rolagem é por janela (window). Telas com rolagem interna própria ainda não espelham a rolagem interna — melhoria para depois, se precisar.
