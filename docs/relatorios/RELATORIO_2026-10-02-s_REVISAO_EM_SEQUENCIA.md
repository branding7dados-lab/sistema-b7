# Relatório 2026-10-02-s — Revisão de Design em sequência

Só front-end (`js/design.js`, `styles/design.css`). Sem migration. Nenhuma regra de revisão mudou: são a mesma peça aberta e os mesmos botões de sempre; o que entrou foi a navegação entre as peças da fila.

## Por quê

Há 39 peças em "Revisão interna", enviadas entre 4 e 14 dias atrás. Para revisar, era preciso abrir a peça no quadro, decidir, fechar, achar a próxima e abrir de novo, 39 vezes.

## O que a auditoria mostrou

- A revisão em si já estava completa: aprovar, pedir ajuste, decidir slide a slide em carrossel e stories, "aprovar carrossel inteiro".
- Quem produziu a peça não pode aprová-la (regra existente, mantida).
- O que não existia era ir de uma peça para a próxima sem voltar ao quadro.

## O que entrou

- **Botão "Revisar em sequência"** na Produção de Design, na linha do "Precisa de você". Aparece quando há peça para a pessoa revisar.
- Ao clicar, abre a **peça mais antiga** da fila. No topo da peça fica uma faixa: "Revisão em sequência · peça 3 de 39 · 2 revisadas", com barra de progresso.
- **Ao aprovar ou pedir ajuste, a próxima peça abre sozinha.**
- **Pular ›** deixa a peça para depois; **‹ Anterior** volta. No fim, as peças puladas voltam antes de a sequência encerrar.
- **Sair da sequência** continua na peça atual, sem abrir a próxima sozinha.
- Quando acaba: a peça fecha e aparece "Fila de revisão concluída: N peças revisadas".

## Regras da fila

- Entram as peças em "Revisão interna" que respeitam os filtros da barra (cliente, designer, prazo…). Dá para revisar só as peças de um cliente: filtre o cliente e clique no botão.
- Não entram as peças que a própria pessoa produziu.
- Em carrossel e stories, a próxima só abre depois do fechamento da revisão ("Aprovar carrossel" ou "Enviar ajustes ao Designer"), não a cada slide.
- Fechar a peça, ou abrir outra pelo quadro, encerra a sequência.

## Arquivos

- `js/design.js`, `styles/design.css`.
- `js/auth.js` versão `2026-10-02-s`; `sw.js` cache `v146`.

## Testes realizados

Em página local, com **dados simulados** (3 peças em revisão, 1 produzida pela própria pessoa, 1 em criação):

- O botão aparece; a fila abre pela mais antiga e mostra "peça 1 de 3" (a peça da própria pessoa fica de fora).
- Aprovar → a segunda abre sozinha, "1 revisada".
- Pular → vai para a terceira. Pedir ajuste nela (com mensagem) → volta para a segunda, que tinha sido pulada.
- ‹ Anterior mostra a peça já aprovada, sem botão de aprovar.
- Aprovar a última → a peça fecha, aviso "Fila de revisão concluída: 3 peças revisadas", e o botão some.
- As chamadas ao banco foram exatamente as três esperadas (aprovar, ajuste com a mensagem, aprovar).
- "Sair da sequência": aprovar depois disso não abre a próxima.
- Esc encerra a sequência; abrir uma peça avulsa pelo quadro não mostra a faixa.

- **No site, com os dados reais e só leitura** (sessão aberta no navegador daqui): o botão aparece, abre a peça mais antiga com "peça 1 de 39" e o botão "Aprovar internamente" ativo; "Pular" leva à "peça 2 de 39"; Esc fecha. Não aprovei nem pedi ajuste em nada.

## O que NÃO foi testado

- Aprovar ou pedir ajuste de verdade, com dados reais (não fiz: são decisões da revisão).
- Carrossel e stories dentro da sequência (o avanço depende do fechamento, que usa o mesmo caminho testado, mas não exercitei um caso multiparte).
- Celular.
