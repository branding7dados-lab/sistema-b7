# Relatório 2026-09-30-n — Fase 7: Oportunidades de conteúdo

O pacote é `atualizacao-2026-09-30-n.zip`, com o patch `atualizacao-2026-09-30-n.patch` (diferença em relação ao pacote m).

Neste pacote:

- O **banco** já está aplicado em produção.
- A **Edge Function** `oportunidades-sync` já está publicada (versão 2, `op2`).
- O **agendamento semanal** no pg_cron já está ativo.
- **Só falta publicar o front-end.**

Nada foi feito com IA generativa, crawler genérico, contorno de anti-bot ou Núcleo7.

## Oportunidades

Cada **oportunidade** é uma data canônica, por exemplo "Dia do Cirurgião-Dentista, 25/10", com os seguintes campos:

- **Identificação:** nome, apelidos (`aliases`) e descrição.
- **Tipo de data** (`tipo_data`):
  - `fixa`: dia e mês;
  - `regra`: `nth:M:DS:N` (N-ésimo dia da semana do mês; −1 = último, −2 = penúltimo), `ultimo_dia:M` ou `mes_inteiro:M`;
  - `datas`: datas explícitas por ano, guardadas em `oportunidade_datas`.
- **Duração:** de 1 a 31 dias.
- **Classificação:**
  - natureza: comemorativa, feriado ou campanha;
  - abrangência: internacional, nacional, estadual ou municipal (com UF e município);
  - categorias (temas) e tags;
  - indicador `geral`.
- **Controle:** confiabilidade, estado de revisão e fontes (provas).

Situação em produção:

| Item | Valor |
|---|---|
| Oportunidades ativas | **419** |
| Por tipo | 356 fixas, 22 por regra, 41 com datas por ano |
| Confiabilidade | 406 **Oficial**, 13 **Verificada** (feriados da BrasilAPI) |
| Com mais de uma fonte | 28 (por exemplo, OMS + Ministério da Saúde, ONU + Ministério da Saúde) |
| Na fila de revisão | 6 possíveis duplicatas |

As ocorrências de cada ano são resolvidas no navegador a partir da definição, e isso funciona para qualquer ano futuro. Regras da resolução:

- 29/02 só aparece em ano bissexto.
- A campanha que começou antes da janela visível aparece no primeiro dia visível, marcada "Em andamento".
- Uma campanha que atravessa a virada do ano aparece em janeiro.

Nenhuma data pura passa por `new Date('AAAA-MM-DD')`.

## Fontes

| Fonte | Autoridade | Método | Sincronização | Status |
|---|---|---|---|---|
| Ministério da Saúde — Calendário da Saúde | Oficial | Automática: adaptador HTML próprio | Semanal (backend) | OK — 168 itens; 10 frases sem data interpretável ficam de fora e aparecem no log |
| OMS — campanhas oficiais | Oficial | Automática: adaptador HTML | Semanal | OK — 26 itens (4 sem data fixa, como "Walk the Talk", ficam de fora); 15 nomes oficiais em português para casar com o Ministério da Saúde |
| ONU — dias e semanas internacionais | Oficial | Automática: adaptador HTML | Semanal | OK — 249 itens. Dia de ano-base vira data fixa; dia móvel vira data do ano (sem inventar regra) |
| BrasilAPI — feriados nacionais | Operacional (API pública) | Automática: JSON do ano atual e do seguinte | Semanal | OK — 13 feriados, confiabilidade **Verificada** |
| Planalto — legislação federal | Oficial | Verificação manual (cadastro com link da lei) | — | 2 datas: Dia do Professor (Decreto 52.682/1963) e Dia das Mães (Decreto 21.366/1932) |
| Conselhos profissionais (CFO, CFM…) | Oficial | Verificação manual | — | 1 data: Dia do Cirurgião-Dentista (CFO) |
| Câmara dos Deputados — publicação "Datas comemorativas…" | Oficial | Cadastro assistido (não há API) | — | Nenhuma importada ainda (ver Pendências) |
| Calendarr (agregador) | Secundária | **Não integrada** | — | Uma fonte secundária nunca cria "Oficial": entra no máximo como Pendente |
| Cadastro manual verificado | Oficial | Tela de admin (link ou referência obrigatórios) | — | Pronto para uso |

A saúde de cada fonte fica registrada em `oportunidade_fontes`:

- última tentativa e último sucesso;
- status (`ok`, `falha`, `suspeita`, `nunca`);
- itens lidos, média de referência, criados, atualizados e erro.

Cada execução fica em `oportunidade_sync_execucoes`.

## Confiabilidade

- **Oficial:** lei, órgão público, organismo internacional ou conselho profissional.
- **Verificada:** fonte pública confiável sem ato próprio (feriados da BrasilAPI) ou dado conferido pela equipe.
- **Popular / comercial:** datas de mercado. Só entram por cadastro manual.
- **Pendente de verificação:** o que vier de fonte secundária.

Regras:

- Uma fonte oficial **eleva** a confiabilidade de uma oportunidade e nunca a rebaixa.
- A confiabilidade aparece como selo, com explicação no *tooltip*, na folha, na página e no Calendário.

## Sincronização

O fluxo é: **pg_cron** (toda segunda-feira às 06:17 UTC, 03:17 em Brasília) → `net.http_post` → Edge Function `oportunidades-sync` → `oportunidades_aplicar_lote`, que só pode ser executada pelo service_role. O navegador nunca busca fonte externa: o Calendário só lê o banco.

Proteções:

- **Idempotência:** a chave é o par (fonte, referência). Numa segunda sincronização real, com as fontes forçadas a "vencidas", o resultado foi **0 criados** em todas as fontes: MS 168 atualizados, BrasilAPI 13, OMS 26, ONU 249. Os totais de oportunidades, provas e datas não mudaram (419 / 457 / 57).
- **Falha de fonte:** status `falha`, erro registrado e **nada alterado**.
- **Lote vazio ou menor que 50% do normal:** status `suspeita` e **nada alterado**.
- **Item que sumiu da fonte:** a prova fica inativa ("não aparece mais na fonte desde…"). A oportunidade **não é apagada**.
- **Anti-martelada:** a função só busca fontes vencidas (frequência × 0,9) e roda no máximo uma vez a cada 30 minutos. Uma segunda chamada imediata retornou "sincronização recente".
- **"Sincronizar agora"** (tela Fontes) exige um JWT de admin. A chamada anônima com `forcar` retornou **403**.
- **Erro ao gravar** um lote é registrado como falha da fonte.

## Normalização

1. **Chave canônica** `op_normalizar`: minúsculas, sem acento, sem pontuação.
2. **Mesma referência na mesma fonte:** a oportunidade é atualizada.
3. **Mesmo nome ou apelido:** vira uma nova fonte da mesma oportunidade. Exemplo: "Dia do Dentista" é apelido de "Dia do Cirurgião-Dentista".
4. **Mesma data fixa + palavra-chave em português informada pelo adaptador:** o item é vinculado. Exemplo: "World TB Day" é ligado ao "Dia Mundial de Combate à Tuberculose".
5. **Dúvida:** a oportunidade é criada com `revisar` e aponta a possível duplicata.
   - Nesta rodada a regra foi refinada: exige mesma data **e** radical de palavra em comum no nome (6 letras, que pega cognatos PT/EN) **e** que a outra oportunidade venha de **outra** fonte.
   - Datas diferentes da mesma lista oficial nunca são tratadas como duplicata.
   - A fila caiu de 41 falsos alarmes para **6 casos reais** (por exemplo, "Dia Internacional contra a Discriminação Racial" × "International Day for the Elimination of Racial Discrimination").
6. **Nada é unido automaticamente.** O admin decide na aba Revisão:
   - **Unir:** as fontes, os ajustes e os vínculos passam para a oportunidade mantida;
   - **Não é duplicata;**
   - **Desativar.**

## Segmentos dos clientes

- **Tabela de temas** com hierarquia:
  - Saúde, com Odontologia, Medicina, Farmácia, Ótica e Nutrição;
  - Beleza, com Estética;
  - Educação, Trânsito, Gastronomia, Comércio, Família, Meio ambiente, Cultura, Tecnologia, Esporte, Direito, Imobiliário, Agro e Marketing.
- **Um cliente pode ter vários segmentos** (`cliente_segmentos`, origem `manual` ou `sugerido`).
- **Segmentos sugeridos**, para você confirmar na tela do cliente:

  | Cliente | Segmento sugerido |
  |---|---|
  | Mais Sorrisos | Odontologia |
  | Natu Restaurante | Gastronomia |
  | AutoEscola Modelo | Trânsito |
  | AutoEscola Sudoeste | Trânsito |
  | Óticas Almeida | Ótica |
  | C6 Farma | Farmácia |
  | Ensino Plus | Educação |
  | Instituto Aprender e Crescer | Educação |
  | Infinite Fio | Estética + Medicina |
  | Atacadão dos Suplementos | Nutrição |

- **Edição:** na Visão geral do cliente, botão "Editar", com chips agrupados por tema. Admin e coordenação editam. Ao salvar, os segmentos passam a `manual`.

## Relevância

A relevância é determinística e explicável: cada nível vem com o **motivo** por escrito.

| Regra | Nível | Motivo exibido |
|---|---|---|
| Ajuste "ignorar" ou "não relevante" | fora (só para esse cliente) | "Ignorada para este cliente" |
| Ajuste "relevante" | Muito relevante | "Marcada como relevante pela equipe" |
| Categoria = segmento do cliente | **Muito relevante** | "Relacionada ao segmento Odontologia (sugerido)" |
| Tag = palavra do próprio segmento (sem as palavras do tema-pai) | **Muito relevante** | "Correspondência: tag …" |
| Categoria = tema-pai, quando o segmento cobre o tema todo (Medicina, Farmácia) | **Relacionada** | "Tema Saúde — segmento Medicina" |
| Data "ampla" do tema-pai (nome é só o tema, por exemplo "Dia Mundial da Saúde") | **Relacionada** | "Data ampla de Saúde" |
| Data de um subtema de um segmento amplo | **Relacionada** | "Odontologia faz parte de Saúde" |
| `geral` ou feriado nacional | **Geral** | "Feriado nacional" / "Data de interesse geral" |

Datas estaduais e municipais não casam sozinhas; só entram por ajuste.

Dois excessos apareceram nos testes e foram corrigidos:

- "Ótica e **saúde** visual" casava toda data de saúde.
- "Saúde Mental" contava como data ampla para o dentista.

## Ignorar para cliente

- A opção fica na folha da oportunidade: "Ignorar para este cliente", "Marcar como relevante" e "Desfazer". Só admin e coordenação a veem (RPC `oportunidade_ajustar_cliente`).
- Ignorar para o cliente A **não muda nada para o cliente B**. Isso foi testado na unidade (Mais Sorrisos ignorada, Dr. Fabrício continua) e no Calendário (a data some com o filtro do cliente A).
- A tela do cliente mostra "N oportunidades ignoradas".

## Calendário B7

- A camada **✦ Oportunidades** é um botão de alternância, **desligado por padrão** (`op=1` na URL e na preferência da sessão). Não é um segundo calendário: é só mais um adaptador em `B7.Eventos`.
- Com a camada desligada, a base de oportunidades **nem é consultada**.
- O visual é mais leve: contorno tracejado, título em itálico, ✦ magenta, sem fundo. Na vista Dia e na agenda do celular, as oportunidades formam o grupo "Oportunidades (datas comemorativas)", depois dos compromissos.
- **Com filtro de cliente:** aparecem só as oportunidades relevantes para ele e as gerais, sem as que foram ignoradas para ele.
- **Sem filtro:** aparecem as que têm pelo menos um cliente "muito relevante" ou "relacionada", mais as gerais.
- O filtro de **Responsável** esconde a camada, porque oportunidade não é compromisso de ninguém.
- Clicar numa oportunidade abre a **folha** com:
  - data, "Faltam N dias" e a regra (por exemplo, "2º domingo de maio");
  - selos de confiabilidade, natureza, abrangência e categorias;
  - descrição e apelidos;
  - bloco "Para <cliente>", quando há filtro de cliente;
  - clientes relacionados, com motivo;
  - **fontes**, com "Ver fonte" (abre em nova aba, `noopener`) e "conferida em";
  - linhas vinculadas;
  - "Usar na Linha Editorial".

## Linha Editorial

"Usar na Linha Editorial" segue três passos:

1. Escolher o cliente. Os relacionados aparecem primeiro, e o cliente do filtro já vem selecionado.
2. Escolher a linha. A linha do mês da data é sugerida.
3. Escrever uma observação, se quiser.

O resultado é gravado com o RPC `oportunidade_vincular_linha`, que **só cria o vínculo**. A tela diz isso explicitamente: nenhum conteúdo, roteiro, design, vídeo ou gravação é criado. No teste de banco, admin e coordenação vincularam e a tabela `conteudos` ficou em 279 → 279.

A Linha Editorial ganhou:

- **Visão geral:** seção discreta "✦ Oportunidades" com as vinculadas (data, observação, "Remover") e sugestões do segmento do cliente no mês que ainda não foram usadas.
- **Criativo:** campo opcional **"Oportunidade"**. Só aparece quando a linha tem alguma oportunidade vinculada e grava `conteudos.oportunidade_id` via RPC.

## Mobile

- No celular, as oportunidades entram pela agenda do dia (abaixo de 760 px), como grupo próprio.
- A folha abre como folha de baixo, e os clientes relacionados quebram linha.
- A página "Oportunidades" empilha os filtros.
- Testado em 390×844, sem rolagem horizontal na agenda nem na folha.

## Permissões

| Recurso | admin | coordenador | designer / videomaker | cliente / anon |
|---|---|---|---|---|
| Ler oportunidades (camada, folha) | ✓ | ✓ | ✓ (sem ações) | ✗ |
| Página `#/oportunidades` (Próximas) | ✓ | ✓ | ✗ | ✗ |
| Abas Revisão e Fontes, Sincronizar agora, Adicionar data verificada | ✓ | ✗ | ✗ | ✗ |
| Ignorar / relevante por cliente, segmentos, Usar na Linha | ✓ | ✓ | ✗ | ✗ |

A nova rota `oportunidades` entrou na lista da coordenação e no menu (grupo Operação).

## Segurança / RLS

- **Leitura:** `sou_equipe_interna()`. `oportunidade_fontes` e `oportunidade_sync_execucoes` são só para `sou_equipe()`. `anon` não tem acesso.
- **Escrita direta:** negada em todas as tabelas. Tudo passa por RPC com checagem de papel.
- **`oportunidades_aplicar_lote`:** só `service_role`. Admin chamando direto recebeu **NEGADO**.

Teste real no banco, com JWT simulado por papel e rollback:

| Papel | Leitura | Ações |
|---|---|---|
| admin | lê 419 oportunidades e 9 fontes | ajusta, vincula, muda estado e segmentos; insert direto e lote **negados** |
| coordenador | lê 419 oportunidades e 9 fontes | ajusta, vincula e muda segmentos; estado, insert direto e lote **negados** |
| designer | lê 419 oportunidades, 0 fontes | ajuste, vínculo, estado, segmentos, insert e lote **negados** |
| autenticado sem papel interno | 0 oportunidades, 0 segmentos, 0 provas | — |
| anon | permissão negada | ajuste negado |

Outras garantias:

- Os links de fonte abrem com `target=_blank rel="noopener noreferrer"`.
- Todo texto vindo das fontes passa por `esc()`.
- O cron usa a chave **pública** anon, a mesma do front-end, que não dá poderes de admin. Nenhuma credencial vazada foi usada.

## Performance

- As definições (cerca de 420 linhas, mais provas e datas) são lidas **uma vez** e ficam em cache por 10 minutos. As ocorrências e a relevância são calculadas no navegador.
- A camada só é carregada quando é ligada. O cache por janela de `B7.Eventos` continua valendo.
- Toda ação (ignorar, vincular, segmentos) invalida os dois caches e recarrega sem piscar.
- O Painel da coordenação mostra **uma linha só**, "N oportunidades relevantes nos próximos 15 dias · M clientes · Ver", calculada da mesma base e escondida quando é zero.

## Banco / migrations

Todas já aplicadas em produção:

- `migration_oportunidades.sql`: esquema, temas, fontes, RLS e RPCs (aplicado antes).
- `oportunidades_sync_nucleo` e `oportunidades_sync_robustez`, agora exportadas no estado final em **`migration_oportunidades_sync.sql`**: `op_item_valido`, `oportunidades_aplicar_lote` e `oportunidades_posso_sincronizar`.
- `migration_oportunidades_duplicatas.sql`: `op_palavras` (radical de 6 letras), `op_candidato_duplicata` e o passo 4 do lote; a fila foi reavaliada.
- `migration_oportunidades_seed.sql`: 3 datas verificadas com prova e os segmentos **sugeridos**.
- `migration_oportunidades_cron.sql`: job `oportunidades-sync`, semanal.
- `oportunidades_grants_ajuste`: `oportunidades_posso_sincronizar` sem execução para anon.
- Edge Function `oportunidades-sync` **v2** (`op2`) publicada, com `verify_jwt` ligado. O código está em `supabase/functions/oportunidades-sync/index.ts`.

## Arquivos alterados

**Novos:**

- `js/oportunidades.js` (módulo `B7.Oportunidades`)
- `styles/oportunidades.css`
- `migration_oportunidades_sync.sql`, `migration_oportunidades_duplicatas.sql`, `migration_oportunidades_seed.sql`, `migration_oportunidades_cron.sql`
- `supabase/functions/oportunidades-sync/index.ts` (op2)

**Alterados:**

- `js/eventos.js`: domínio e adaptador `oportunidade`; `filtrarOportunidade`.
- `js/calendario.js`: camada, URL `op=1`, linha e folha.
- `js/database.js`: leitura da base e RPCs.
- `js/app.js`: rota.
- `js/permissoes.js` e `js/nav.js`: rota, menu e ícone.
- `js/dashboard.js`: seção do cliente.
- `js/linha.js`: seção da linha e campo do criativo.
- `js/painel-coord.js`: linha do Painel.
- `index.html`: script e CSS.
- `sw.js`: cache **v112**, com os novos arquivos no precache.

## Tests

Só o que foi executado de fato:

1. **Unidade** (Node, com dados reais exportados do banco: 98 oportunidades, datas, provas, temas e segmentos): **36/36 ok** nos fusos America/Sao_Paulo, Asia/Tokyo e Pacific/Honolulu. Cobertura:
   - datas: regras N-ésimo, último e penúltimo; 29/02 em 2027 e 2028; ano futuro (2031, 2035); mês inteiro; campanha cruzando o ano; feriado por datas;
   - relevância: dentista para odontologia, AutoEscola e cliente sem segmento, Medicina relacionada, correção da Ótica, correção de "Saúde Mental", data ampla;
   - ajustes: ignorar para A e não para B;
   - filtros da camada: cliente, desligada, responsável;
   - busca por apelido e filtros da página.
2. **Interface** (Playwright + Chromium, 43/43 ok):
   - Calendário:
     - camada desligada: sem chips e sem consulta à base;
     - ligar a camada: chips aparecem, com `op=1` na URL e `aria-pressed`;
     - filtro Mais Sorrisos: vê o Dentista e não o Professor; AutoEscola não vê o Dentista.
   - Folha: fonte do CFO em nova aba, selo Oficial, "Faltam 25 dias", "Para Mais Sorrisos".
   - Usar na Linha: sugere a linha de outubro, grava `vincular:lout:2026-10-25`, uma única chamada e **nenhuma criação**; o vínculo aparece.
   - Ignorar: o ajuste é gravado, aparece "Desfazer" e a data some do calendário do cliente.
   - Mobile 390 px: grupo próprio e nenhuma rolagem horizontal (agenda e folha).
   - Página: 3 abas para admin; busca "dentista" guardada na URL; cliente + "muito" com o motivo.
   - Fontes: "Falhou" visível e botão de sincronizar; cadastro manual exige fonte e grava a regra `nth:8:0:2`.
   - Papéis: coordenador sem abas de admin; designer sem acesso à página.
   - Cliente: segmento sugerido, lista e gravação dos segmentos. Linha: vinculada com observação.
   - Sem erros de JavaScript. Capturas em modo escuro conferidas.
3. **Regressão do Calendário:** as suítes da fase 6 (`cal_t`, `cal_int`, `cal_rt`) rodaram de novo sem regressão.
4. **Banco real:**
   - primeira sincronização completa: 4 fontes OK;
   - **segunda sincronização real**: 0 criados em todas as fontes; contagens idênticas;
   - trava de 30 minutos confirmada;
   - `forcar` anônimo retornou 403;
   - RLS por papel conforme a tabela acima (com rollback);
   - vínculo não cria conteúdo (279 → 279).

## Fontes não automatizadas

- **Câmara dos Deputados:** a publicação de datas comemorativas não tem API. O caminho é cadastro assistido pela aba Fontes → "Adicionar data verificada", com a fonte "Câmara" e o link.
- **Planalto:** a verificação é manual, lei a lei (link obrigatório). Por enquanto: Dia do Professor e Dia das Mães.
- **Conselhos profissionais (CFO, CFM, CRF…):** verificação manual. Por enquanto: Dia do Cirurgião-Dentista.
- **Calendarr e outros agregadores:** não integrados de propósito. São secundários, e o sistema nunca os trataria como "Oficial".
- **Datas comerciais** (Dia dos Pais, Black Friday, Dia do Cliente…): não há ato oficial para a maioria. Entram só por cadastro manual, como "Popular / comercial".

## Pendências

1. **Confirmar os segmentos sugeridos** dos 10 clientes e definir os dos demais, como ClimaPro, Sabor da Feira, Direito a Vista e Águas Mucugê. Sem segmento, o cliente só vê as datas gerais.
2. **Revisar as 6 possíveis duplicatas**: Oportunidades → Revisão.
3. **Muitas datas da ONU e algumas da OMS ficam com o nome em inglês.** Não há tradução automática, por regra (sem IA). As que coincidem com o Ministério da Saúde já foram ligadas às versões em português. Nas demais, pode-se acrescentar o nome em português como apelido pelo cadastro manual.
4. **Frases do Ministério da Saúde sem data interpretável** ficam de fora: 10 por rodada, listadas no retorno da função. Exemplos: "Primeira terça-feira de maio…", "3ª Semana…", "Mês Mundial do Alzheimer".
5. **Datas comerciais e da Câmara** ainda não foram cadastradas; a tela para isso está pronta.
6. **Estaduais e municipais:** o modelo aceita UF e município, mas o cliente ainda não tem UF cadastrada. Por isso essas datas só entram por ajuste manual.
7. **Publicar o front-end** (zip n). O backend já está no ar.
