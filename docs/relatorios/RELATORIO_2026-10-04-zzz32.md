# Relatório zzz32 — "Puxar para atualizar" suave

Pedido (vídeo): "Esse troço de atualizar tá feião, animação sem uma entrada e saída suavizada, toda grotesca".

## O que estava errado
- Ao soltar, a lâmpada pulava para a posição de "atualizando".
- A tela era redesenhada do zero: o conteúdo novo entrava sem o deslocamento e subia por baixo da lâmpada, encavalando no título; aparecia o esqueleto de carregamento; no Vídeo, o painel refazia toda a abertura de cinema.
- No fim, lâmpada e rótulo sumiam secos.

## Como ficou
- Ao soltar: a lâmpada **assenta com mola** e a página inteira fica baixa e **levemente esmaecida/desfocada** (quem desce agora é o painel, que não é trocado — nada mais sobe por baixo da lâmpada).
- **Atualização silenciosa** no Vídeo: sem esqueleto e sem repetir a abertura; o odômetro, o anel e a barra **deslizam** do valor antigo para o novo assim que os dados chegam (o véu sai na hora para você ver).
- Rótulo troca com um fade + foco ("Atualizando…" → "✓ Atualizado").
- Saída: a lâmpada **encolhe e sobe sumindo**, o rótulo sai primeiro, e a página **volta deslizando** junto.

Testado gravando a tela com toque simulado (puxar → soltar → dados novos → volta).

Versão `2026-10-04-zzz32`, cache `roteiros-b7-v237`.
