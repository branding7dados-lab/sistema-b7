# Relatório 2026-10-02-p — Resumo do mês por cliente (PDF)

Só front-end. Sem migration; só leitura do que já existe. Não é tela nem módulo novo: é um documento.

## O que é

Uma folha A4 por cliente e mês, para levar à reunião com o cliente.

- **Onde:** página do cliente → menu "⋯" → **Resumo do mês (PDF)**. Aparece para administrador e coordenação.
- **Como:** escolhe o mês (os últimos 12), confere a prévia e clica em "Baixar PDF".
- **O que traz:**
  - Conteúdos publicados sobre o planejado no mês (e quantos estão programados).
  - Artes finalizadas sobre as peças da linha do mês.
  - Vídeos entregues sobre as demandas do mês.
  - Gravações realizadas sobre as do mês (canceladas não contam).
  - Conteúdos por formato (Reels, Cards, Carrosséis, Stories), publicado × planejado.
  - A lista dos conteúdos do mês, com data, formato, título e situação (até 22; o resto vira "+ N conteúdos").

## De onde vêm os números

Sempre pelo **mês de referência** que cada tela já usa, não pela data em que algo foi mexido:

- Conteúdos: os da linha editorial daquele mês; "publicado" é a situação marcada na linha.
- Artes: as peças de Design ligadas à linha do mês. **Peça manual, sem linha editorial, não entra.**
- Vídeos: demandas com a competência do mês (descartadas ficam de fora).
- Gravações: as com a competência do mês.

Nada é gravado e nada novo é calculado no banco.

## Arquivos

- `js/resumo-mes.js` (novo), `js/database.js` (`resumoMensal`), `js/dashboard.js` (item no menu do cliente), `index.html`, `styles/print.css`, `sw.js`.
- `js/auth.js` versão `2026-10-02-p`; `sw.js` cache `v143`.

## Testes realizados

Em página local, com **dados simulados**:

- Mês cheio (27 conteúdos, 11 artes, 9 vídeos, 4 gravações com 1 cancelada): os quatro números e os formatos batem com os dados; 22 linhas na lista e "+ 5 conteúdos"; a folha não estoura a página e o rodapé fica dentro dela.
- Mês sem nada: zeros, "Sem linha editorial neste mês" e "Não há linha editorial para este mês".
- Trocar o mês refaz a consulta com o ano e o mês certos.
- "Baixar PDF": gerou um PDF de 1 página (cerca de 430 KB), com o nome `CLIENTE_RESUMO_MÊS_ANO.pdf`; a área de impressão ficou limpa depois.
- Sintaxe de todos os arquivos alterados.

## O que NÃO foi testado

- Com você logado e dados reais (a consulta nova ao banco não foi executada com sessão).
- Cliente com logo (a imagem vem de outro endereço; se o navegador barrar na captura, o PDF sai sem o logo).
- Abrir o PDF e conferir a olho; celular.

## Limites conhecidos

- "Conteúdos publicados" depende de a equipe marcar o conteúdo como Publicado na linha editorial.
- É um resumo de produção. Não traz métrica de rede social (alcance, seguidores), porque o sistema não tem esse dado.
