# Relatório 2026-10-02-ze/zf — Oportunidades: geografia, feriados locais e datas mais amplas

Versões `2026-10-02-ze` e `2026-10-02-zf` (commits `096fdf1` e `b7d3935`). Edge Function `oportunidades-sync` **op3 publicada**. **Uma migration aplicada:** `migration_oportunidades_geografia.sql`.

## Resumo

O que mudou para quem usa:

- Cada cliente pode ter **cidade(s)**. Na tela do cliente, a seção Oportunidades ganhou a linha "Cidade", com busca pelo nome entre os 5.571 municípios do IBGE.
- O B7 passou a conhecer **feriados estaduais de todo o Brasil**, **feriados e aniversários das cidades dos clientes** e **datas populares/comerciais** (Dia dos Namorados, Dia dos Pais, Dia das Crianças, Black Friday, Dia do Cliente…).
- Entraram **datas de comunidade e profissão com lei ou fonte**: Dia Nacional dos Desbravadores (Lei 14.665/2023), Dia Mundial dos Desbravadores, Dia Nacional do Evangélico (Lei 12.328/2010), Dia do Farmacêutico (Lei 12.338/2010) e Dia do Contador (CFC).
- **Relevância por lugar:**
  - O aniversário da cidade do cliente é "Muito relevante".
  - Feriado da cidade ou do estado do cliente é "Relacionada".
  - Feriado de outra cidade nunca aparece para ele.
- **Ponto facultativo** virou categoria própria. Carnaval e Corpus Christi deixaram de aparecer como "Feriado nacional".
- **Página Oportunidades:** novos filtros "Tipo" (feriados / comemorativas / campanhas) e "Local" (estado ou cidade). A busca acha pelo nome da cidade.
- A **busca global** ("Buscar no B7…") passou a achar datas (ex.: "desbravadores").
- O **Calendário** não mudou de comportamento. A camada continua desligada por padrão, compromissos vêm primeiro e as datas excedentes vão para "+N mais".

## Auditoria inicial

Já existia muito do que o pedido descreve (fase 7, relatório `2026-09-30-n`):

- **Oportunidades:**
  - definição canônica (`oportunidades`);
  - datas fixas, por regra ou por ano;
  - proveniência (`oportunidade_provas`);
  - saúde das fontes e histórico de execuções;
  - sincronização semanal no servidor (pg_cron → Edge Function), idempotente, que nunca apaga;
  - fila de possíveis duplicatas sem fusão automática;
  - confiabilidade (Oficial / Verificada / Popular / Pendente);
  - relevância determinística por segmento (`cliente_segmentos` + `temas`);
  - ajustes por cliente;
  - vínculo com a Linha Editorial que não cria conteúdo;
  - cadastro manual com fonte obrigatória.
- **Banco no início:** 413 datas ativas.
  - 181 de Saúde (Ministério da Saúde, OMS, ONU);
  - 13 feriados nacionais (BrasilAPI);
  - **nenhuma** estadual ou municipal.
- **Calendário:** camada "✦ Oportunidades" no `B7.Eventos`, desligada por padrão, com datas puras sem conversão de fuso e janela visível.
- **Clientes:** **não havia cidade/UF** (a pendência 6 do relatório n). Só textos livres na Inteligência. Segmentos: 10 clientes com segmento sugerido.
- **Defeito encontrado:** a BrasilAPI marca Carnaval e Corpus Christi como "national", e o B7 os mostrava como "Feriado nacional".
- **IA:** a camada de IA não lê Oportunidades hoje. Nada foi mudado nela.

## Fontes utilizadas

| Fonte | Para quê | Tipo | Cobertura real | Licença / termos | Autenticação | Situação |
|---|---|---|---|---|---|---|
| **IBGE — API de Localidades** (`servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado`) | Lista de municípios com código IBGE (cidade do cliente) | Oficial (governo federal) | 5.571 municípios | Dados públicos do governo | Sem chave | **Integrada**, a cada 30 dias |
| **Repositório feriados-brasil** (github.com/joaopbini/feriados-brasil), pasta `feriados` | Feriados estaduais, municipais e pontos facultativos por código IBGE | Terceiros, comunitária (secundária) | 2010–2026. Para 2026: todos os estados e 3.837 municípios (8.545 feriados municipais). **2027 ainda não publicado.** | MIT (uso, cópia e modificação permitidos com atribuição). Arquivos estáticos no GitHub, sem limite declarado | Sem chave | **Integrada**, semanal. Estaduais: todos. Municipais: **só as cidades dos clientes** |
| **Mesmo repositório**, pasta `comemorativas` | Datas populares/comerciais | Terceiros (secundária) | 21 datas por ano | MIT | Sem chave | **Integrada**, a cada 30 dias |
| Planalto (leis), Igreja Adventista, CFC | Datas curadas com referência | Oficial / organização responsável | 8 datas | Consulta pública; só a referência é gravada | — | Cadastro curado (migration), com link |
| BrasilAPI, Ministério da Saúde, OMS, ONU | (já existiam) | — | — | — | — | Mantidas |

**Pesquisadas e não integradas:**

- **Feriados API (feriadosapi.com):** exige chave, e o plano gratuito cobre só as 27 capitais.
- **dadosbr.github.io:** só nacionais e estaduais, sem documentação de licença.
- **Nager.Date e Calendarific:** sem cobertura municipal útil.
- **Câmara dos Deputados (compilação oficial de datas comemorativas):** é PDF de 21 MB, sem API; continua como cadastro assistido.

## Arquitetura

Fonte → adaptador no servidor (Edge Function `oportunidades-sync`, um adaptador por fonte) → normalização (nome, escopo, natureza, datas) → `oportunidades_aplicar_lote` (deduplicação, proveniência, idempotência) → banco → relevância no navegador (determinística, a partir de segmentos e cidades) → página Oportunidades, seção do cliente, Linha Editorial e camada do Calendário.

O navegador **nunca** chama fonte externa. A busca de cidade consulta a tabela `municipios` do próprio banco.

## Modelo de dados

**Reaproveitado:** `oportunidades`, `oportunidade_datas`, `oportunidade_provas`, `oportunidade_fontes`, `oportunidade_sync_execucoes`, `temas`, `cliente_segmentos`, `oportunidade_cliente_ajustes`, `oportunidade_linhas`.

**Novo:**

- `municipios` (ibge, nome, uf): referência do IBGE.
- `cliente_municipios` (client_id, municipio_ibge, origem manual|sugerido): várias cidades por cliente.
- `oportunidades.municipio_ibge`: escopo municipal pelo código, não pelo nome. As colunas `uf` e `municipio` já existiam e passaram a ser preenchidas.
- `natureza` aceita `facultativo`.
- Temas novos: Infância e juventude, Contabilidade e finanças, Religião e comunidade.
- Fontes novas: `ibge_municipios`, `feriados_br`, `datas_br`.
- Funções:
  - `cliente_municipios_definir` (admin/coordenação);
  - `municipios_aplicar_lote` (só service_role);
  - `oportunidades_aplicar_lote` e `op_candidato_duplicata` revisadas.
- Índice `oportunidades_local` (abrangência, uf, municipio_ibge), usado pelo casamento de datas locais na sincronização.

## Geografia

- **Escopos:** internacional, nacional, estadual (UF) e municipal (código IBGE de 7 dígitos).
- **UF do cliente:** sai da cidade. Não há campo de UF solto, que poderia divergir.
- **Cidades sugeridas** (origem "sugerido", a equipe confirma), tiradas do que o próprio cadastro diz:

| Cliente | Cidades sugeridas |
|---|---|
| Mais Sorrisos | Vitória da Conquista |
| C6 Farma | Vitória da Conquista |
| Branding7 | Vitória da Conquista |
| Atacadão dos Suplementos | Vitória da Conquista + Jequié |
| Infinite Fio | Vitória da Conquista + Maceió |
| Águas Mucugê | Mucugê |

- **Chácaras Nova Andradina** ficou sem cidade: o cadastro diz "a 18 km de Vitória da Conquista, na estrada da Barra do Choça", e não dá para afirmar o município.
- **Segmentos sugeridos novos**, a partir do nicho cadastrado hoje (só para quem não tinha nenhum):

| Cliente | Segmento sugerido |
|---|---|
| BLW | Contabilidade e finanças |
| Mercato Sadia | Comércio |
| Sabor da Feira | Gastronomia |
| Dr. Fabrício | Medicina |
| Águas Mucugê | Imobiliário |
| Chácaras | Imobiliário |

- **Erro evitado:** o dataset associa o código 2922102 a Mucugê, mas o IBGE confirma que é Mundo Novo. O código de Mucugê é 2921906, conferido no IBGE.

## Feriados

- **Nacionais:** BrasilAPI, como antes. Carnaval e Corpus Christi foram corrigidos para "Ponto facultativo" e Páscoa para "Data comemorativa": a lei federal não os declara feriado.
- **Estaduais:** os 27 estados (feriado e ponto facultativo estadual).
- **Municipais:** só das cidades dos clientes. Um feriado municipal na mesma data de um feriado nacional (ex.: Sexta-feira Santa por lei municipal) não é duplicado; a exceção é aniversário de cidade.
- **Situação em produção:**
  - estaduais de BA/AL: Independência da Bahia, Emancipação de Alagoas, São João, São Pedro e Dia do Evangélico (AL);
  - municipais:
    - **Vitória da Conquista:** São João, Padroeira, Aniversário;
    - **Jequié:** Santo Antônio, São João, Dia do Evangélico, Aniversário;
    - **Maceió:** Corpus Christi, N. Sra. dos Prazeres, N. Sra. da Conceição;
    - **Mucugê:** um "Feriado municipal" sem motivo informado.

## Datas comemorativas

- **Popular / comercial:** Dia dos Namorados, Dia dos Pais (2º domingo de agosto), Dia das Crianças, Dia Mundial da Criança, Halloween, Véspera de Natal, Réveillon, Dia do Idoso, Dia da Terra, Dia do Livro, Dia Internacional da Mulher, Dia de Santo Antônio, Dia de São João, Dia do Colono, Dia do Consumidor, Dia do Cliente e Black Friday (27/11/2026 e 26/11/2027).
- **"Geral"** (aparecem para todo cliente): Namorados, Pais, Mães, Crianças, Véspera de Natal e Réveillon.
- **Regra anual:** só é usada quando a própria descrição da fonte a diz ("celebrado em 12 de junho", "segundo domingo de agosto") e bate com as datas publicadas. Senão, fica a data do ano.
- **Comunidade e profissão:** listadas no Resumo, todas com fonte gravada.

## Datas locais

- **Aniversário de cidade:** o nome "Aniversário de Jequié" só é usado quando a fonte chama a data de "Aniversário da Cidade/Município". O texto original fica na prova. Não se deduz aniversário a partir de outra data.
- **Feriado sem motivo:** quando a fonte diz só "Feriado Municipal", o B7 mostra "Feriado municipal em Mucugê" e "A fonte não informa o motivo do feriado".
- **Confiabilidade:** tudo dessa base entra como **"Pendente de verificação"**, porque a fonte é secundária. Exemplo de por que importa: o "Dia do Católico" do Acre vem marcado em 22/01, mas a descrição da própria fonte fala em 20 de janeiro.

## Relevância por cliente

Regras determinísticas, cada uma com o motivo escrito:

| Situação | Nível | Motivo exibido |
|---|---|---|
| Aniversário da cidade do cliente | **Muito relevante** | "Aniversário de Jequié, cidade do cliente (sugerida)" |
| Outro feriado da cidade do cliente | Relacionada | "Feriado em Maceió, cidade do cliente" |
| Feriado do estado do cliente | Relacionada | "Feriado estadual — AL, estado do cliente" |
| Feriado de outra cidade ou estado | Não aparece para ele | — |
| Segmento, tags, ajustes, "geral" | Como antes | — |

- **Datas religiosas:** só sobem para quem tem o segmento "Religião e comunidade" definido pela equipe. Nada é inferido do nome ou do tipo de negócio.
- **Lista padrão da página:** sem cliente escolhido, feriados de lugares onde não há cliente não aparecem. Continuam disponíveis pelo filtro "Local"/"Estadual"/"Municipal" e pela busca.

## Deduplicação

- **Datas locais:** a chave carrega o lugar (`nome + município` ou `nome + UF`). O "Aniversário da Cidade" de Jequié nunca se funde ao de Vitória da Conquista.
- **Datas amplas:** como antes. Mesmo nome ou apelido liga como nova prova. Mesma data com palavra em comum, de outra fonte, vai para revisão. Datas locais nunca entram nessa comparação.
- **Primeira importação real:**
  - "Dia das Mães", "Dia do Professor", "Dia Mundial da Saúde" e "Dia da Consciência Negra" se ligaram às datas existentes (4 ligações, sem duplicar);
  - "Dia de Finados" × "Finados" foi para a fila de Revisão.
- **Conflito entre fontes:** a precedência continua determinística.
  - Fonte oficial eleva a confiabilidade e nunca rebaixa.
  - Fonte secundária não cria "Oficial" nem eleva.
  - A natureza de uma data existente não é mudada pela sincronização: correção manual e dado curado não são sobrescritos.

## Sincronização

- **Agendamento:** o mesmo pg_cron semanal, mais o botão "Sincronizar agora" (admin).
- **Frequência:**
  - feriados locais: semanal;
  - IBGE e datas populares: a cada 30 dias.
- **Horizonte:** ano atual + seguinte, quando a fonte já publicou. O ano seguinte é opcional (404 não é erro).
- **Falha de uma fonte** não afeta as outras.
- **Lote vazio, truncado ou muito menor que o normal** não altera nada.
- **Item que some da fonte:** a prova fica inativa e nada é apagado.
- **Município do IBGE que sumir** não é apagado, porque pode ter cliente ligado.
- **Datas curadas** (provas `manual:*`) nunca são tocadas pela sincronização.
- **Nova cidade de cliente:** entra na próxima sincronização dos feriados locais, ou na hora com "Sincronizar agora".

## Calendário

Sem mudança de arquitetura: a camada usa `B7.Oportunidades.periodo` pelo `B7.Eventos`.

- **Desligada (padrão):** nenhuma data.
- **Ligada, sem filtro:** só datas com algum cliente relacionado, mais as gerais. Feriados de estados sem cliente não aparecem.
- **Grade do mês:** compromissos primeiro, o resto em "+N mais".
- **Rótulo:** a natureza "Ponto facultativo" aparece no evento.

## Linha Editorial

Sem mudança. "Usar na Linha Editorial" continua só criando o vínculo. As sugestões do mês na Linha passam a incluir o aniversário da cidade do cliente, porque ele é "Muito relevante".

## Segurança

- **Credenciais:** nenhuma chave nova; todas as fontes são públicas e sem chave.
- **Acesso às fontes:** só no servidor.
- **Leitura de `municipios` e `cliente_municipios`:** equipe interna. Anônimo e cliente do Portal não têm acesso.
- **Escrita:** só por função (admin/coordenação). Lote do IBGE e de oportunidades: só service_role.
- **RLS:** nenhuma política existente foi alterada.

## Banco de dados

- `migration_oportunidades_geografia.sql`, aplicada como `oportunidades_geografia`.
- Edge Function `oportunidades-sync` versão `2026-10-02-op3`.

## Arquivos

- **Novo:** `migration_oportunidades_geografia.sql`.
- **Alterados:**
  - `supabase/functions/oportunidades-sync/index.ts`: adaptadores IBGE, feriados_br e datas_br; natureza da BrasilAPI;
  - `js/oportunidades.js`: relevância local, cidade do cliente, filtros, folha, busca;
  - `js/database.js`: leitura de cidades, busca de município, RPC;
  - `js/ui.js`: datas na busca global;
  - `styles/oportunidades.css`;
  - `js/auth.js` e `sw.js` (versão).

## Testes realmente executados

**Automatizados:** nenhum.

**Banco (produção), dentro de transação desfeita no fim:**

- Migration parcial antes de aplicar (contagens conferidas).
- **Falhas de fonte:** lote vazio → "suspeita"; erro HTTP simulado → "falha"; lista do IBGE truncada → "suspeita"; lote de 1 item contra referência 55 → "suspeita". Em todos: 493 ativas antes e depois, 5.571 municípios, 8 datas curadas ativas.
- **Permissões com usuário simulado por papel:**
  - admin e coordenador leem e gravam a cidade;
  - designer lê e não grava;
  - autenticado sem papel lê 0;
  - anônimo: permissão negada;
  - insert direto e lote do IBGE negados para todos.

**Sincronização real (produção):**

- Diagnóstico sem gravar: IBGE 5.571 itens, feriados 55, datas populares 21.
- Primeira importação: 5.567 municípios novos, 55 feriados, 17 datas populares criadas + 4 ligadas + 1 para revisão.
- **Segunda importação (idempotência):** 0 criados em todas. Contagens idênticas antes e depois (499 / 541 / 115 / 5.571).

**Página local com o código real e dados simulados** (5 clientes: Salvador, Vitória da Conquista, Jequié, São Paulo e um sem nada):

- Relevância por cliente: sem vazamento entre cidades/estados; Desbravadores só para o segmento Religião; cliente sem nada só vê as gerais; Carnaval como "Ponto facultativo nacional".
- Filtros "Local", "Feriados", busca por cidade e por UF.
- Seção do cliente com a linha Cidade.
- Janela de cidade: buscar "jeq", adicionar Jequié, tirar a sugerida, salvar (1 chamada à função); a relevância mudou na hora.
- Folha de data municipal com "Municipal · Jequié/BA" e o motivo.
- Busca de texto ("desbrav", "jequié").

**Site publicado (`zf`), sessão real, só leitura:**

- Atacadão (Jequié + VC), Mais Sorrisos (VC) e Infinite Fio (VC + Maceió) com os motivos certos.
- Lista padrão: 96 datas em 60 dias, das quais só 3 locais (as dos clientes). Filtro Local: 11.
- Seção do cliente Atacadão com cidades sugeridas e o Aniversário de Jequié.
- Busca global "desbrav": 2 datas; 3º sábado de setembro de 2027 = 18/09, conferido.
- **Calendário** (largura 1280):
  - camada ligada mostra o Dia do Professor e manda o excedente para "+6 mais";
  - camada desligada não mostra datas;
  - sem erro no console.
- **Celular (390 px):** página sem rolagem lateral.

**Não testado:**

- Capturas de tela desta entrega: o navegador daqui não conseguiu capturar (janela oculta); a conferência foi pela estrutura da página.
- Aparelho físico; tema claro.
- Gravar a cidade de um cliente real pela tela: testado só na página local e com usuário simulado no banco.
- Sessões reais de designer e coordenador.
- Execução pelo pg_cron (vai acontecer na segunda, 05/10, 03:17 de Brasília).

## Cobertura conhecida

- **Nacional:** feriados e pontos facultativos; datas de saúde (MS/OMS/ONU); datas populares principais; 5 datas profissionais/comunidade com lei ou fonte.
- **Estadual:** os 27 estados, só 2026 por enquanto.
- **Municipal:** só as 4 cidades com cliente (Vitória da Conquista, Jequié, Maceió, Mucugê), 2026.
- **Não cobre:** "todas as datas do Brasil". Profissões fora dos segmentos dos clientes, datas religiosas além das listadas e aniversários de cidades sem cliente não estão na base.

## Limitações

- **2027 local ainda não existe na fonte:** feriados estaduais e municipais de 2027 só aparecem quando o repositório publicar o ano (a sincronização pega sozinha). Até lá, janeiro a março de 2027 não têm feriados locais no B7.
- **Qualidade da base comunitária:** 78% dos feriados municipais vêm sem motivo, e há erros pontuais de data (ex.: Acre). Por isso tudo entra como "Pendente".
- **Salvador:** não tem "Aniversário da Cidade" (29/03) na base, porque lá não é feriado.
- **Cidades sugeridas e segmentos novos** precisam ser confirmados pela equipe.

## Próximos passos

1. Confirmar as cidades sugeridas e definir as dos demais clientes. Sem cidade, feriado local não aparece.
2. Revisar "Dia de Finados" × "Finados" na aba Revisão.
3. Cadastrar, com a aba Fontes, datas de profissão dos clientes que ainda faltam (Dia do Oftalmologista, Dia do Corretor de Imóveis…), sempre com a lei ou o órgão.
