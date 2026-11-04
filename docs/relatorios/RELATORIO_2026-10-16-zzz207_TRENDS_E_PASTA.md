# Relatório — Trends com etiquetas, sugestão por cliente, lote e pasta de referências

**Versão:** `2026-10-16-zzz207` · **Cache:** `roteiros-b7-v410`
**Pedido (Kevin):** melhorar o sistema de trends e referências (etapa 2 do plano combinado).

## O que mudou (Trends)
- **Etiquetas e cliente:** cada trend tem etiquetas (palavras-chave: nicho, assunto, formato; até 8) e, opcionalmente, "só para este cliente". Etiquetas aparecem no cartão e viram filtro (as mais usadas ficam em chips no topo). Ao editar, aparecem as etiquetas já usadas para reaproveitar com um clique.
- **Sugerir para um cliente:** escolha o cliente e a lista passa a mostrar só as trends que combinam, da que mais combina para a que menos, com "Combina por: …". O perfil do cliente vem da linha editorial mais recente (posicionamento, tom, proposta, objetivo, pilares, títulos/temas dos conteúdos) e do nome. A trend pontua pelas palavras em comum (etiqueta pesa 3, nome 2, nota 1, sem acento/plural, ignorando palavras genéricas). Trend feita para o cliente vai no topo; de outro cliente ou já usada por ele fica de fora; as sem relação ficam escondidas (a contagem aparece). Sem IA: é instantâneo e previsível.
- **Em lote:** cada cartão tem uma caixinha; com trends escolhidas aparece a barra "N escolhidas · Adicionar à gravação…". Escolhe cliente e gravação (a próxima data primeiro; ou uma gravação nova "Trends") e todas entram como **referência** na lista "O que vamos gravar". Pula trend sem link e link que já está na gravação; registra o uso na trend ("Cliente").
- **Pasta de referências do cliente:** botão ao sugerir para um cliente, e link no card "Preparação" da gravação ("Ver todas as referências deste cliente"). Mostra as referências já postas nas gravações dele e os links da linha editorial (de cada conteúdo e do mês) com a escolha de cada um (só edição / edição e gravação / a decidir).

## Banco de dados (aplicado; `migration_trends_etiquetas.sql`)
Duas colunas novas em `trends`: `etiquetas text[]` e `client_id uuid`. As trends existentes ficam como estão (sem etiqueta, para vários clientes). Nada apagado.

## Arquivos
`js/trends.js`, `js/gravacao.js`, `styles/sistema.css`, `js/novidades.js`, `js/auth.js`, `sw.js`, `migration_trends_etiquetas.sql`.

## Testes
Sintaxe (`node --check`). A pontuação foi executada em Node com exemplos (clínica odontológica: "POV: primeiro dia na clínica" → combina por "clínica"; "Antes e depois do clareamento" com etiqueta "saúde" → "saúde, clareamento"; "Receita de macarrão" → 0, escondida; palavras genéricas como "antes/depois/dica" não contam). Colunas conferidas no banco. A parte visual e o fluxo do lote não foram testados logados aqui.
