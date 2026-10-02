# Relatório 2026-10-02-zc — Painel: mais hierarquia, menos repetição

Só front-end (`js/painel.js`, `styles/painel.css`). **Nenhuma migration, nenhuma regra alterada**: os números, a ordem de prioridade, as fontes de dados e os links são os mesmos.

## O que você pediu

"Tá legal, mas não tá me convencendo… acho que falta alguma coisa" — o Painel, visto no celular.

## Auditoria (o que estava fraco na captura)

- **Tudo com o mesmo peso:** sete caixas roxas iguais, uma embaixo da outra. Nada dizia "isto é o que importa hoje".
- **O Painel não falava com você:** saudação, cargo e um botão. A resposta para "o que eu tenho hoje?" exigia ler quatro caixas.
- **Indicadores altos demais:** os quatro números ocupavam quase uma tela inteira antes de aparecer qualquer coisa acionável.
- **Minha semana gastava cinco linhas**, três delas para dizer "Livre".
- **Gráfico sem números:** só a semana atual mostrava o valor; as outras dependiam de passar o mouse, que não existe no celular.
- **Separador solto:** em Próximos compromissos, "· Atacadão dos Suplementos" começava a linha de baixo com o ponto.

## O que mudou

1. **Frase do dia no cabeçalho:** "Você tem **1 demanda atrasada** e **1 entrega para hoje**." Com gravação no dia, ela entra na frase. Sem nada urgente: "Nada urgente hoje. Próxima gravação: segunda, 05/10, 09:30." Usa as mesmas regras dos indicadores; se as demandas não carregarem, a frase não aparece.
2. **Indicadores compactos (celular):** número à esquerda, rótulo e detalhe ao lado. Os quatro ocupam cerca de metade da altura. Atrasadas e Vencem hoje ganham fundo levemente tingido quando têm valor.
3. **Precisa da sua atenção:** itens atrasados e que vencem hoje têm fundo na cor da urgência; o título pode usar duas linhas em vez de ser cortado.
4. **Minha semana em faixa (celular):** os dias lado a lado, como num calendário, com ícone e número (câmera = gravação, relógio = prazo, alerta = atrasada). Dia livre é um ponto discreto. Hoje continua destacado.
5. **Minha produção:** o número aparece em cima de toda barra com entrega; selo "acima da média" quando a semana atual passa da média das anteriores. Não existe selo "abaixo da média", porque a semana ainda está em curso.
6. **Próximos compromissos:** "quando · cliente" fica numa linha só, com reticências no cliente.

Resultado medido na página de teste em 390 px de largura: a tela inteira caiu de aproximadamente 1.900 px para 1.449 px de altura, e a primeira tela agora mostra frase do dia, indicadores, os itens urgentes e a semana.

## Quem mais recebe

Os Painéis do Coordenador, do Designer e o composto (várias funções) usam as mesmas peças, então recebem os indicadores compactos, a semana em faixa, o destaque dos itens urgentes e o ajuste dos compromissos. A frase do dia é só do Painel do Videomaker por enquanto.

## Testes executados

**Automatizados:** nenhum.

**Página local com o `painel.js` e os estilos reais e dados simulados, emulação de celular 390×844:**

- Cenário da sua captura (1 atrasada, 1 vence hoje, gravações na segunda): frase "Você tem 1 demanda atrasada e 1 entrega para hoje."; quatro indicadores com 72–88 px de altura; semana com cinco dias de 60 px; barras com 5, 2 e 7; selo "acima da média"; compromissos com reticências; sem rolagem lateral; sem erro no console. Tema escuro, em captura.
- Cenário sem nada urgente: "Nada urgente hoje. Próxima gravação: segunda, 05/10, 09:30."; indicadores zerados sem cor; "Tudo em dia por aqui." Tema claro, em captura.

**Site publicado, sessão real, somente leitura:** ver o fim deste relatório.

**Não testado:**

- Painéis do Coordenador, do Designer e composto em tela (só conferidos por leitura do código: usam as mesmas classes).
- Aparelho físico: só emulação no navegador.
- Tela larga de computador em captura (as regras novas de layout são do celular; em tela larga mudam só o tingimento, os números nas barras, o selo e a frase).
- Estados de erro e de carregamento com o layout novo.

## Limitações

- Na faixa da semana o tipo de cada coisa aparece só por ícone no celular; o texto completo fica para leitores de tela.
- O selo "acima da média" compara a semana atual com a média das cinco anteriores.
