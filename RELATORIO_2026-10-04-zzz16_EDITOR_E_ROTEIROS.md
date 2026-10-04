# Pacote zzz16: editor de roteiro (celular) e lista de Roteiros

Versão `2026-10-04-zzz16`, cache `roteiros-b7-v221`.

## Editor de roteiro (celular)
- **Topo:**
  - cliente e gravação com mais espaço (antes ficavam "AutoE…", "Gravaçõ…");
  - status em selo menor;
  - Imprimir virou um botão discreto só com ícone, em vez do bloco de degradê.
- **Abas Editor / Prévia:** a aba escolhida ganha fundo rosado com contorno.
- **Roteiros como pílulas com número + título** ("01 Curso para passar na p…"), no lugar dos quadrados só com número. O escolhido fica no degradê. No computador o trilho vertical não mudou.
- **"ROTEIRO 01" numa linha só,** e os controles de fonte ficaram mais compactos.
- **Estágio do roteiro** quebra em grade de 2 colunas em vez de cortar "Aprovado interi…".
- **"Ainda não enviado ao cliente":** texto à esquerda e botão de envio largo.
- Margens laterais menores, sobrando mais espaço para escrever.

## Lista de Roteiros
- **Cabeçalho:** título maior. No celular, "Nova gravação" vira um "+" quadrado ao lado da troca Lista/Cards.
- **Estágios em pílulas soltas** com ponto colorido e contagem, a escolhida em tinta (como em Clientes e Usuários).
- **Busca em pílula,** com o texto "Buscar roteiro, cliente ou gravação…".
- **Filtros como pílulas** com rótulos curtos ("Mês", "Cliente", "Recentes"). No celular os três ficam numa linha só; antes eram três linhas de largura inteira.
- **Grupos por gravação:**
  - cantos maiores e logo de 46 px preenchendo o quadro;
  - selo de "Grava 05/10 · amanhã" rosado;
  - barra de andamento um pouco mais grossa;
  - entrada em cascata.

Toda a lógica (filtros, ordem, vista, abrir roteiro ou gravação) continua igual.

## Testes
`npm test` passou. Conferido em prints de 390 px (claro e escuro) e de 1280 px.
