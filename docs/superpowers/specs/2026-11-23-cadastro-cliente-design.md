# Cadastro do cliente e pacotes: desenho (4.88)

## Por quê
O cadastro de cliente do B7 tem só nome, logo, observações, mensal/avulso e modo. O Yury achou "muito sem nada,
sem nexo" e pediu um cadastro no jeito do Núcleo 7 (`nucleo7/src/components/clients/AddClientDialog.tsx`), **sem a
parte de contrato e pagamento**, que fica no Núcleo 7.

A Bruna (Financeiro) precisa de três coisas:
- cadastrar o pacote do cliente;
- ver as entregas;
- acompanhar os clientes.

Ver as entregas e acompanhar os clientes já existem: Gestão → Contratado × entregue, Clientes em risco, Prazos e
retrabalho (4.87). O que falta é o **pacote** e o **cadastro**.

Decisões do Yury:
- **Pacote, opção C:** existem pacotes padrão. O cliente escolhe um e pode ter as quantidades ajustadas só para ele.
- **Entrega mínima é o pacote.** Não existe um piso separado.
- **A Bruna monta os pacotes:** o nome e o que vem na entrega de cada um.
- **Cadastro, opção 3:** criar numa janela com etapas, como no Núcleo 7. Editar numa ficha em blocos na página do
  cliente, com as mesmas partes e os mesmos campos.
- **Pacotes saem das Configurações** e ganham lugar próprio na Gestão.

## Metas
1. **Pacotes:**
   - uma aba **Pacotes** na Gestão para criar, editar e arquivar os pacotes padrão;
   - a aba reaproveita o editor que já existe em `js/pacotes.js`;
   - o atalho em Configurações → Pacotes de produção continua, levando para o mesmo editor.
2. **Pacote do cliente:**
   - no cadastro, escolher o pacote padrão;
   - opcionalmente, ajustar as quantidades de cada tipo só para aquele cliente;
   - guardar desde quando o pacote vale.
3. **Contratado × entregue** compara com o pacote **efetivo** do cliente, que é o padrão com o ajuste.
4. **Janela "Novo cliente" em 5 etapas:**
   - **1. Cliente:** quem é;
   - **2. Marca:** logo, cores e fontes (opcional);
   - **3. Pacote:** o que contratou;
   - **4. Equipe:** quem cuida na B7;
   - **5. Observações:** o que foi combinado.
5. **Aba "Cadastro" na página do cliente:**
   - as mesmas 5 partes, em blocos;
   - cada bloco tem o seu "Editar";
   - substitui a janela "Editar cliente" atual: o botão "Editar cliente" passa a abrir esta aba.

## Fora (não-metas)
- Valor, pagamento, parcelas, vencimento, situação financeira, closer, SDR e origem do lead. Isso fica no Núcleo 7.
- Histórico de pacotes. Trocar o pacote vale dali para frente e para a conta do mês corrente; os meses passados
  passam a ser comparados com o pacote novo. Fica assim por enquanto.
- A equipe responsável **não** distribui trabalho sozinha. É informação: aparece na ficha e na lista e serve de
  filtro. A atribuição de peças continua como é hoje.
- Integração com o Núcleo 7 (puxar o cadastro de lá).
- **Grupo do WhatsApp do cliente:** sai do cadastro (pedido do Yury). Ele é ligado depois, pelo WhatsApp integrado
  ao sistema. O dado que já existe em `clientes_interno.whatsapp_grupo` não é apagado; só deixa de aparecer no
  cadastro.
- A marca do cliente **não** muda sozinha o visual de nada (portal, peças, relatórios). É referência para a equipe.

## Antimetas (falhou mesmo funcionando, se...)
- O portal do cliente passar a mostrar dados internos: CNPJ, contatos do responsável, observações, equipe.
- Criar um cliente ficar mais difícil para quem só quer o nome. **Só o nome é obrigatório**; as outras etapas
  podem ficar vazias e ser completadas depois, na ficha.
- Mudar um pacote padrão apagar o ajuste dos clientes que têm ajuste.

## Restrições
- Front em JS puro (módulos `B7.*` em `js/`), Supabase com RLS, migração `zzz389_*.sql` aplicada sozinha no merge.
  A migração precisa poder rodar 2 vezes.
- **Quem cria e edita cliente não muda:** a regra de hoje (`pode_nivel('clientes', 2)`, mais o administrador). O
  Financeiro é administrador, então pode.
- **Quem cria e edita pacote também não muda:** `pode_nivel('linhas', 2)`; arquivar é `pode_nivel('linhas', 3)`.
  O Financeiro entra por ser administrador.
- **Reaproveitar o que existe**, em vez de duplicar:

  | Campo | Onde já está |
  |---|---|
  | observações | `clientes_interno` |
  | nicho, site, Instagram | `cliente_inteligencia` |
  | mensal/avulso | `clientes.contrato` |
  | modo | `clientes.modo` |
  | logo | `logo_path` / `logo_url` |
  | pacote padrão | `clientes.pacote_id` |

- Dado interno novo vai para tabela que o cliente do portal não lê (`clientes_interno` ou tabela nova com RLS só da
  equipe interna).

## Abordagens consideradas
1. **Janela com etapas para criar e editar.** É o mais parecido com o Núcleo 7, mas cansa para mexer numa coisa só.
2. **Ficha em blocos para tudo**, e criar pede só nome e logo. Editar fica rápido, mas criar vira dois passos e o
   cadastro tende a ficar incompleto.
3. **Janela com etapas para criar e ficha em blocos para editar**, com as mesmas partes. **Escolhida pelo Yury:**
   criar fica guiado e editar, que é o mais frequente para a Bruna, fica rápido.

## O cadastro: campos
**1. Cliente**
- **Nome:** obrigatório.
- **Área de atuação:** em `cliente_inteligencia.nicho`.
- **CNPJ:** novo, interno.
- **Cidade/estado:** novo, texto livre.
- **Instagram e site:** em `cliente_inteligencia`.
- **Responsável do cliente:** nome, cargo, WhatsApp e e-mail. Novo, interno.
- **Mensal ou avulso:** em `contrato`.
- **Modo:** linha editorial ou completo, o campo atual.
- **Início do serviço:** novo, uma data.

**2. Marca** (tudo opcional — pedido do Yury: "sistema de branding, tipo cores, logo")
- **Logo:** o campo de logo de hoje (`logo_path` / `logo_url`) passa para esta etapa.
- **Cores da marca:** até 8 cores. Cada uma tem o código (`#RRGGBB`, com seletor de cor) e um nome opcional
  (ex.: "principal", "apoio").
- **Fontes:** texto livre para título e para texto (ex.: "Montserrat" / "Inter").
- **Link do material da marca:** um endereço (manual da marca, pasta do Drive).
- **Estilo:** texto livre (ex.: "nunca usar preto puro", "fotos claras").
- Na ficha, as cores aparecem como quadradinhos. Tocar num copia o código.
- Quem vê: toda a equipe interna que vê o cliente (é para o design usar). Não aparece no portal.

**3. Pacote**
- Escolher o pacote padrão; a lista mostra o resumo, ex.: "12 cards + 4 Reels · 16 no mês".
- "Ajustar só para este cliente" abre as quantidades por tipo, já preenchidas com as do padrão.
- **Vale desde:** uma data. Por padrão, o 1º dia do mês corrente.
- "Sem pacote" é permitido: o cliente aparece em "sem pacote definido" na Gestão, como hoje.

**4. Equipe responsável na B7**
- Coordenação, design e vídeo, uma pessoa em cada; todos opcionais.
- A lista mostra só a equipe interna ativa da função certa: função principal ou função extra.

**5. Observações**
- Observações (o campo atual).
- O que foi combinado com o cliente: novo, texto livre, interno.

## O pacote efetivo
- `pacote efetivo = ajuste do cliente, se existir; senão os itens do pacote padrão`.
- O ajuste guarda a **lista completa** de itens no mesmo formato de `pacotes_producao.itens`. Ele não guarda
  diferenças. Assim, mudar o padrão não mexe em quem tem ajuste. Na ficha aparece "ajustado para este cliente",
  com a opção "voltar ao padrão".
- Uma função no banco devolve o pacote efetivo, e todo mundo que precisa do pacote do cliente usa essa função:
  - `_contratado` (Gestão → Contratado × entregue);
  - a "Nova linha editorial", que já sugere o pacote do cliente;
  - o portal, se mostrar o pacote.
- **A "Nova linha editorial":** hoje, aplicar um pacote na linha grava `clientes.pacote_id`. Isso continua. Quando o
  cliente tem ajuste e a linha usa o mesmo pacote dele, os conteúdos nascem com as quantidades ajustadas.

## A ficha "Cadastro"
- É uma aba nova na página do cliente (`js/dashboard.js`, visão do cliente), com os 5 blocos.
- Cada bloco mostra os valores. Campo vazio aparece como "—" com o convite "Completar".
- O "Editar" de cada bloco abre os campos ali mesmo e tem Salvar e Cancelar.
- Quem só pode ver o cliente (designer, videomaker) vê a ficha sem os botões de editar. Os campos internos (CNPJ,
  responsável, combinado, equipe) aparecem para a equipe interna e nunca para o portal.

## Regras do pacote nos casos de borda (decididas pelo Claude, pode mudar)
- **O ajuste é por item, não por tipo.** Cada linha do pacote (tipo + produção, ex.: "Reel · gravação" e
  "Reel · só edição") tem a sua quantidade. Assim a separação gravação/edição, que a "Nova linha editorial" usa,
  não se perde.
- **Trocar o pacote descarta o ajuste.**
  - No cadastro: ao escolher outro pacote, o sistema avisa "o ajuste deste cliente vai ser descartado" antes de
    salvar.
  - Pela "Nova linha editorial": se a linha usar outro pacote, `linha_aplicar_pacote` grava o novo `pacote_id` e
    limpa o ajuste. Assim o pacote efetivo nunca mistura um pacote com o ajuste de outro.
- **"Vale desde" conta:** nos meses antes dessa data, o cliente não entra no Contratado × entregue. A data pode ser
  futura; até lá, o cliente aparece como "pacote começa em <mês>".
- **Pacote arquivado em uso:**
  - continua contando como contratado, com o ajuste se houver;
  - na escolha do cadastro, aparece como "<nome> (arquivado)" só para quem já está nele;
  - não é sugerido na "Nova linha editorial", porque lá pacote arquivado já é recusado.
- **Gravação fixa:** a janela "Editar cliente" de hoje também tem a gravação fixa, que só administração e
  coordenação veem. Ela vira um **6º bloco da ficha, "Gravação fixa"**, visível para as mesmas pessoas de hoje. A
  janela de criar continua com 5 etapas.

## Já decidido pelo Claude (pode mudar)
- O nome da aba na Gestão é **Pacotes**. O editor é o mesmo de `js/pacotes.js`, sem mudar os tipos de conteúdo
  (Card, Carrossel, Reel, Story; o Reel pode ser "só edição").
- A equipe responsável fica numa tabela nova: `cliente_responsaveis` (cliente, função, pessoa), com uma pessoa por
  função.
- CNPJ, cidade/estado, responsável do cliente, combinado e início do serviço ficam em `clientes_interno` (colunas
  novas). O pacote ajustado e o "vale desde" ficam em `clientes` (`pacote_ajuste jsonb`, `pacote_desde date`), ao
  lado de `pacote_id`.
- A marca fica numa tabela nova, `cliente_marca` (cliente, cores em jsonb, fontes, link, estilo), com leitura para a
  equipe interna e escrita para quem edita cliente.
- Validação leve:
  - cor no formato `#RRGGBB`; link da marca começando com `https://`;
  - CNPJ com 14 dígitos, se preenchido;
  - e-mail com @;
  - WhatsApp só com números, de 10 a 13 dígitos;
  - quantidades do ajuste seguem a regra de `_pacote_valido`.

## Para quem for construir decidir
- O visual da janela em etapas e da ficha, seguindo o estilo atual das janelas e da página do cliente.
- Se a lista de clientes ganha um filtro por pessoa responsável, agora ou depois.

## Testes
- **SQL** (Postgres local, como `testes/sql/gestao.sh`):
  - pacote efetivo com e sem ajuste;
  - `_contratado` usando o ajuste e respeitando o "vale desde";
  - trocar o pacote limpa o ajuste;
  - dados internos não legíveis pelo papel cliente;
  - rodar a migração 2 vezes.
- **Navegador** (Chromium com banco simulado):
  - criar cliente só com nome;
  - criar com as 5 etapas;
  - marca: adicionar e remover cor, cor inválida recusada;
  - editar um bloco da ficha;
  - ajustar o pacote e voltar ao padrão;
  - aba Pacotes na Gestão.
- Revisão independente antes do merge. O merge sai com os testes do GitHub verdes.
