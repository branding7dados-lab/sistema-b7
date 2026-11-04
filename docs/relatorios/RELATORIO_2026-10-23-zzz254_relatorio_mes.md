# zzz254 — Relatório do mês por cliente e por pessoa

- Banco: `relatorio_mes(ano, mes)` (só coordenação/administração; `migration_relatorio_mes.sql`, já aplicada).
  - Por pessoa: artes (finalizadas no mês) e vídeos (entregues no mês), quantos dentro do prazo, versões
    médias por arte, e o que está atrasado hoje.
  - Por cliente: posts planejados × publicados (pela data de postagem), artes e vídeos entregues e quantos
    atrasaram, aprovações enviadas/aprovadas/com ajuste e o tempo médio de resposta pelo portal.
  - Clientes de teste ficam de fora; só aparece quem teve movimento no mês.
- Tela: `js/relatorio.js`, aberto pelo botão "Relatório do mês" no Panorama (mês que está na tela),
  com abas Clientes/Equipe e "Baixar planilha" (CSV com ; e acentos, abre no Excel).
- Conferido com outubro/2026 real: 3 pessoas e 15 clientes com movimento.
- O "Resumo do mês" para mandar ao cliente (página do cliente) continua como estava.
