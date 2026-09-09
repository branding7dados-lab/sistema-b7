# Sistema de Roteiros B7

Ferramenta interna da B7 / Branding7 para escrever, organizar e imprimir roteiros
de gravação. A organização é **cliente → gravação → roteiros → cenas**: uma
gravação é um grupo de roteiros de um cliente, e vários clientes podem ter
gravações no mesmo dia sem nenhum conflito. Os dados ficam num banco central (Supabase), então qualquer
computador da equipe abre o mesmo endereço e encontra tudo como foi deixado.

**Como funciona por dentro, em uma frase:** o GitHub Pages hospeda a interface, o
Supabase guarda os dados, e tudo que você digita é salvo sozinho — não existe
botão "Salvar".

---

## Instalação — passo a passo

Você não precisa saber programar. Siga na ordem.

### PASSO 1 — Criar o projeto no Supabase

1. Entre em <https://supabase.com> e crie uma conta (o plano gratuito basta).
2. Clique em **New project**.
3. Dê um nome (ex: `roteiros-b7`), crie uma senha de banco (guarde, mas você não
   vai usar no dia a dia) e escolha a região **South America (São Paulo)**.
4. Espere uns dois minutos até o projeto ficar pronto.

### PASSO 2 — Abrir o SQL Editor

No menu lateral do Supabase, clique em **SQL Editor** e depois em **New query**.

### PASSO 3 — Criar (ou atualizar) as tabelas

Abra o arquivo `supabase_setup.sql` deste projeto, copie **todo** o conteúdo,
cole na janela do SQL Editor e clique em **Run**.

Se você já tinha rodado a versão anterior (que criava a tabela `gravacoes`), pode
rodar este arquivo tranquilo: ele renomeia para `gravacoes` preservando todos os
registros e ids. Nada é apagado.

Deve aparecer "Success". Se aparecer erro, copie a mensagem — ela costuma dizer
exatamente o que faltou.

O mesmo arquivo cria o bucket `client-logos` no Storage, usado pelas logos dos
clientes. Se você já tinha rodado uma versão anterior, rode de novo: ele só
acrescenta o que falta, sem apagar nada.

### PASSO 4 — Copiar as chaves

No Supabase, vá em **Project Settings → API** (ícone de engrenagem). Você precisa
de dois valores:

| No Supabase aparece como | Para que serve |
|---|---|
| **Project URL** | endereço do seu banco |
| **anon public** (ou **publishable key**) | chave que o site usa para conversar com o banco |

Nunca copie a chave **service_role**. Ela é secreta e daria acesso total a
qualquer pessoa que abrisse o site.

### PASSO 5 — Colocar no config.js

Abra o arquivo `js/config.js` e substitua os dois `COLE_AQUI`:

```javascript
window.B7_CONFIG = {
  SUPABASE_URL: 'https://abcdefgh.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5...'
};
```

Salve o arquivo. Se você abrir o sistema sem fazer isso, ele mostra uma tela
explicando o que falta em vez de quebrar.

### PASSO 6 — Criar o repositório no GitHub

1. Em <https://github.com>, dentro da organização **Branding7**, clique em
   **New repository**.
2. Nome sugerido: `roteiros-b7`. Deixe **Public** (o GitHub Pages gratuito exige
   repositório público).
3. Crie sem README (você já tem um aqui).

### PASSO 7 — Subir os arquivos

O jeito mais simples, sem usar terminal:

1. No repositório vazio, clique em **uploading an existing file**.
2. Arraste **todos** os arquivos e pastas deste projeto de uma vez
   (`index.html`, `styles/`, `js/`, `assets/`, `manifest.json`, `sw.js`,
   `.nojekyll`, `supabase_setup.sql`, `README.md`).
3. Clique em **Commit changes**.

O arquivo `.nojekyll` parece inútil, mas não é: sem ele o GitHub ignora algumas
pastas. Não apague.

### PASSO 8 — Ativar o GitHub Pages

No repositório: **Settings → Pages**. Em **Source**, escolha **Deploy from a
branch**; em **Branch**, escolha `main` e a pasta `/ (root)`. Salve.

Espere um ou dois minutos.

### PASSO 9 — Abrir o endereço

Vai ficar assim:

```
https://branding7dados-lab.github.io/roteiros-b7/
```

Abra, crie uma gravação e comece. Salve esse link nos favoritos de todos os
computadores da equipe.

---

## Como usar no dia a dia

**Workspace do cliente** — clicar num cliente abre o espaço dele, não uma lista:
capa com a logo, breadcrumb, métricas próprias (gravações, roteiros, em andamento,
gravadas), última gravação em destaque, roteiros recentes, atividade recente e
ações rápidas contextuais. Três abas: Visão geral, Gravações (com filtros por
status e busca) e Roteiros.

**Clientes com logo** — no cadastro e na edição do cliente existe um campo de
logo, sempre opcional. Aceita PNG, JPG, WEBP e SVG até 2 MB, com prévia antes de
salvar e arraste-e-solte. A imagem vai para o Supabase Storage (bucket
`client-logos`), e na tabela fica só a referência. Cliente sem logo usa o avatar
de iniciais — nada no sistema depende da logo existir. As logos dos clientes
nunca são recoloridas, cortadas ou distorcidas; aparecem inteiras sobre uma
superfície neutra.

**Editar e excluir cliente** — no menu `⋯` do card ou no cabeçalho da página do
cliente. Trocar o nome não afeta gravações, roteiros e cenas, porque o sistema
trabalha pelo identificador. Excluir mostra quanto conteúdo será apagado junto e
pede o nome digitado para confirmar.

**Sidebar** — navegação fixa à esquerda: Dashboard, Clientes, Gravações,
Roteiros recentes, Importar/Exportar e Atalhos. Dá para recolher no botão do
rodapé; no celular ela vira gaveta. O rodapé também mostra o estado da conexão
com o banco.

**Dashboard** — abre direto ao entrar. Mostra o resumo, as gravações mexidas
recentemente ("Continue de onde parou") e os clientes. A busca do topo procura
cliente, gravação e título de roteiro ao mesmo tempo.

**Criar uma gravação** — botão **Nova gravação**: escolhe o cliente (ou cria um
na hora) e dá um nome livre ("Conteúdos Setembro", "Campanha Cashback",
"Institucionais"). A data é opcional — sem data, a folha impressa simplesmente
não mostra campo de data. O editor abre já com o primeiro roteiro pronto.

**Baixar roteiros** — botão *Baixar* no editor (ou `D`). Abre a central de
exportação: escolhe PDF ou PNG, marca quais roteiros e se inclui a folha de
abertura. O PDF sai em A4 real; o PNG sai em alta resolução (≈300 dpi). Os nomes
saem prontos, tipo `MERCATO_SADIA_ROTEIRO_03_CASHBACK.pdf`. Mesmo com o sistema
no modo escuro, o arquivo sai no layout claro de impressão.

**Visualização rápida** (`V` no editor) — painel lateral com o resumo do roteiro
e uma miniatura da folha, sem precisar abrir o editor inteiro.

**Apresentar roteiros** — modo tela cheia para mostrar ao cliente: só a folha, o
logo da B7 e a navegação. Nada de sidebar, botões administrativos ou notas
internas. Setas navegam, ESC sai.

**Estágio do roteiro** — Em criação, Em revisão, Aprovado internamente, Pronto
para gravar e Gravado. Muda com um clique dentro do roteiro e fica registrado na
atividade.

**Nota interna B7** — campo dentro do roteiro para recado da equipe. **Nunca**
entra na folha, no PDF, no PNG nem na impressão.

**Arquivar e Lixeira** — arquivar tira a gravação da Central sem apagar nada.
Excluir manda para a lixeira, também sem apagar: de lá dá para restaurar (com os
roteiros e cenas intactos) ou excluir em definitivo, com confirmação forte.

**Fixados** — clientes e gravações podem ser fixados; aparecem numa área própria
no topo do dashboard.

**Atividade recente** — linha do tempo com o que realmente aconteceu: criação,
mudança de estágio, arquivamento, restauração e download.

**Atalhos** — `Ctrl+K` abre as ações rápidas (nova gravação, novo cliente,
buscar roteiro e as gravações recentes). A tecla `/` vai direto para a busca.

**Atalhos** — `Ctrl K` ações rápidas · `/` busca · `N` nova gravação · `C` novo
cliente · `F` modo foco · `P` imprimir · `Ctrl S` salvar agora · `?` lista de
atalhos. As letras só valem fora de campos de texto, então nunca atrapalham
enquanto você escreve um roteiro.

**Configurações** (na barra lateral) — tema, densidade da interface (confortável
ou compacta), barra lateral, folha de abertura padrão na impressão, backup e
estado da conexão. Essas preferências ficam no navegador de cada pessoa.

**Fixar cliente** — o alfinete no card do cliente joga ele para o topo da lista,
para todo mundo da equipe.

**Modo claro e escuro** — botão de sol/lua no topo, em qualquer tela. Na primeira
vez o sistema segue o tema do computador; depois que você escolher, a escolha
manda e fica guardada naquele navegador. A folha A4 e a impressão **não** seguem
o tema: continuam claras sempre, porque representam o papel.

**Imprimir** — o modal traz de um lado as instruções e as configurações do Chrome,
do outro a seleção de roteiros em cards clicáveis, com contador, Todos/Nenhum e a
folha de abertura como opção separada. O botão fica desabilitado sem nenhum
roteiro marcado.

**Ctrl + K** — abre as ações rápidas: criar gravação, criar cliente, abrir
gravação recente e buscar cliente/gravação/roteiro no banco, tudo com navegação
por ↑ ↓ Enter Esc.

**Editor** — três áreas: o trilho numerado à esquerda (arraste para reordenar os
roteiros), o painel de escrita no meio e a folha A4 à direita, exatamente como
sai impressa.

**Cenas** — quatro tipos: Gancho, Narrativa, Narração e CTA. Cada um tem seu
tratamento na folha. Escolher **Narração** faz aparecer o campo obrigatório
**Sugestão de cenas**; enquanto ele estiver vazio, o cartão fica marcado em rosa
no editor (esse alerta nunca sai na impressão). Passe o mouse entre duas cenas
para inserir uma no meio, e arraste pelo `⠿` para reordenar.

**Observação de gravação** — campo separado da fala, para direções como "plano
fechado" ou "mais energia". Sai na folha como nota de produção, nunca misturada
ao texto do roteiro.

**Tamanho da letra** — no modo `auto` (padrão), o sistema reduz a fonte só o
necessário para caber na folha, e nunca passa de 100%. Você pode assumir o
controle com `A−` e `A+` (de 58% a 115%). Se nem no mínimo couber, a folha ganha
uma borda vermelha avisando — que também não é impressa.

**Imprimir** — botão **Imprimir** (ou `Ctrl+P`): escolha quais roteiros entram e
se quer a página de abertura com cliente, data e índice. Na janela do Chrome,
deixe **Margens: Nenhuma** e marque **Gráficos de plano de fundo**, senão o
gradiente do gancho sai branco. Cada roteiro ocupa uma folha A4.

**Status** — Rascunho, Pronto para gravar ou Gravado. Clique no badge ao lado do
nome da gravação para trocar. Aparece no dashboard e na lista do cliente.

**Modo foco** — no menu `⋯` do editor. Esconde o trilho e alarga a área de
escrita.

**Instalar como aplicativo** — no Chrome, ícone de instalar na barra de
endereços. Vira uma janela própria chamada "Roteiros B7". Os dados continuam
vindo do Supabase.

---

## Sobre salvamento

Não existe botão Salvar. O indicador no topo mostra o estado real:

| Indicador | Significa |
|---|---|
| **Salvando…** | está enviando para o banco |
| **Salvo ✓** | tudo o que você digitou está no Supabase |
| **Erro ao salvar** | algo falhou — clique no indicador para tentar de novo |
| **Sem conexão** | você está offline |

Digitação é salva cerca de meio segundo depois que você para de escrever. Ações
estruturais (criar, excluir, duplicar, reordenar, mudar status) vão para o banco
na hora.

**Sem internet:** o que você digitar em campos de texto fica guardado numa fila
no navegador e sobe sozinho quando a conexão voltar — o indicador mostra quantas
alterações estão pendentes. Já criar, excluir ou duplicar fica **bloqueado**
enquanto estiver offline, com aviso na tela. Isso é proposital: essas operações
dependem do banco gerar identificadores, e fingir que funcionaram seria o
caminho mais curto para perder roteiro. Se o navegador for fechado com
alterações pendentes, ele avisa antes.

---

## Segurança — leia antes de divulgar o link

O sistema roda **sem login**, por decisão de projeto. Consequência, sem rodeios:

- quem tiver o endereço do site consegue ler, editar e apagar os roteiros;
- a chave que fica no `config.js` é pública por natureza — ela vai para o
  navegador de qualquer visitante, e isso é normal para esse tipo de chave;
- não existe isolamento por pessoa, nem histórico de quem alterou o quê.

Isso é aceitável para uma ferramenta interna de roteiros. **Não coloque aqui
nada sigiloso** (dados de contrato, valores, informação de cliente que não possa
vazar). Trate o endereço como se fosse a senha: compartilhe só com a equipe.

Se um dia quiser fechar o acesso, o caminho é ativar o Auth do Supabase e trocar
o `using (true)` das políticas no `supabase_setup.sql` por uma regra baseada em
`auth.uid()`. A estrutura das tabelas continua igual.

---

## Backup

Mesmo com o banco na nuvem, o menu `⋯` tem **Exportar backup** — gera um `.json`
com clientes, gravações, roteiros e cenas. Guarde no Drive de vez em quando.
**Importar backup** devolve tudo para o banco (registros com o mesmo id são
sobrescritos pela versão do arquivo; nada é apagado).

O Supabase gratuito também pausa projetos sem uso por cerca de uma semana — não
apaga nada, mas você precisa entrar no painel para religar. Um backup mensal
resolve o susto.

---

## Identidade visual

As logos oficiais ficam em `assets/brand/` (com os originais intactos em
`assets/brand/originais/`). Qual versão é usada em cada lugar do sistema,
as cores e a tipografia estão documentados em **`BRAND.md`**. Regra curta:
fundo escuro pede a versão branca, fundo claro pede a colorida, e a logo nunca
é redesenhada nem recebe efeito.

## Estrutura dos arquivos

```
index.html                 a casca do sistema (sidebar + dashboard + editor)
styles/global.css          cores, tipografia, botões, modais, toasts
styles/dashboard.css       dashboard, busca e área de clientes
styles/editor.css          trilho, painel de escrita, prévia
styles/print.css           a ficha A4 e as regras de impressão
js/config.js               ← o único arquivo que você edita
js/vendor-supabase.js      biblioteca do Supabase (local, sem CDN)
js/supabase.js             cria a conexão e guarda preferências locais
js/database.js             todas as consultas ao banco, em um lugar só
js/ui.js                   toasts, modais, confirmação, datas
js/autosave.js             salvamento automático e fila de offline
js/print.js                desenho da folha A4 e impressão
js/dashboard.js            dashboard, clientes, gravações, busca
js/editor.js               editor de roteiros e cenas
js/backup.js               exportar e importar
js/app.js                  rotas e inicialização
assets/brand/              logos oficiais (ver BRAND.md)
supabase_setup.sql         cria o banco (rodar uma vez)
manifest.json + sw.js      instalação como aplicativo
.nojekyll                  obrigatório para o GitHub Pages
```

O banco tem quatro tabelas encadeadas: **clientes → gravacoes → roteiros → cenas**.
Apagar um cliente apaga o que está abaixo dele, em cascata.

---

## Problemas comuns

**"Falta ligar o banco"** — o `config.js` ainda está com `COLE_AQUI`, ou a URL
está errada.

**A tela fica carregando e depois dá erro** — URL do Supabase incorreta, projeto
pausado por inatividade, ou a rede da empresa bloqueando. Abra o painel do
Supabase e confira se o projeto está ativo.

**Publiquei uma correção e o site continua igual** — dê um recarregamento forçado
(`Ctrl+Shift+R`). O sistema busca sempre a versão nova primeiro, mas o navegador
pode segurar por alguns segundos.

**O gradiente sai branco na impressão** — falta marcar **Gráficos de plano de
fundo** nas opções de impressão do Chrome.

**Erro de nome duplicado ao criar cliente** — já existe um cliente com esse nome.
É proposital, para não acabar com "Mercato Sadia" três vezes na lista.

---

## Central de Conteúdo

Além dos roteiros, o sistema organiza o planejamento de conteúdo de cada cliente:

```
CLIENTE
 ├── Inteligência        contexto permanente da marca (1 registro por cliente)
 │    ├── Produtos
 │    └── Provas / cases
 ├── Onboarding mensal   o que muda naquele mês
 └── Linha editorial     planejamento do mês
      ├── Pilares        sobre o que falar e em que proporção
      └── Conteúdos      Reel · Card · Carrossel · Story
           ├── Slides    (carrossel)
           ├── Frames    (stories)
           └── script_id → roteiro existente (vídeo)
```

Um conteúdo de vídeo **não** duplica o texto do roteiro: ele aponta para um
roteiro do sistema pelo `script_id` e abre o editor que já existe.

### Preparação para B7 AI

Nada de IA está implementado. O que existe é a estrutura de dados para que um
serviço futuro consiga montar o contexto de um cliente sem precisar de
refatoração.

**Entidades de contexto.** Para gerar qualquer coisa para um cliente, um
serviço futuro consultaria, a partir de `clientes.id`:

| Entidade | Tabela | Chave | Conteúdo |
|---|---|---|---|
| Marca | `cliente_inteligencia` | `client_id` | nicho, descrição, observações |
| ICP | `cliente_inteligencia` | `client_id` | campos `icp_*` |
| Público | `cliente_inteligencia` | `client_id` | campos `publico_*` |
| Brand voice | `cliente_inteligencia` | `client_id` | campos `voz_*` (inclui o que evitar) |
| Posicionamento | `cliente_inteligencia` | `client_id` | `posicionamento`, `puv`, `percepcao` |
| Produtos | `produtos` | `client_id` | benefícios, diferenciais, objeções |
| Provas | `provas` | `client_id` | cases, números, depoimentos |
| Mês | `onboardings` | `client_id` + `mes`/`ano` | campanhas, datas, o que evitar |
| Plano do mês | `linhas_editoriais` | `client_id` + `mes`/`ano` | objetivo, canais, posicionamento do mês |
| Pilares | `pilares` | `linha_id` | nome, percentual, etapa do funil |
| Histórico | `conteudos` | `client_id` | tudo o que já foi planejado e publicado |
| Roteiros | `roteiros` | `content_id` | Script DNA: `pilar`, `funil`, `formato`, `tema` |

**Fluxo conceitual** (ainda não implementado):

```
Cliente + contexto disponível + onboarding do mês + linha editorial + histórico
        ↓
     B7 AI
        ↓
Ideias · Conteúdos · Roteiros
```

**Contexto disponível, não checklist.** Toda informação estratégica é opcional
no banco (`default ''`, sem `not null` de conteúdo). Um cliente sem ICP, sem
brand voice e sem cases funciona em todas as telas. A regra para o serviço
futuro é a mesma da interface: usar o que existe, não exigir o que falta.
Quanto mais preenchido, mais contexto — nunca um bloqueio.

**Script DNA.** Os campos `pilar`, `funil`, `formato`, `tema` e `content_id` em
`roteiros` são metadados opcionais, preenchidos automaticamente quando um
conteúdo é vinculado a um roteiro. Nenhum deles impede a criação de um roteiro
avulso, como sempre foi.

### Módulos da Central de Conteúdo

| Tela | Rota | O que faz |
|---|---|---|
| Inteligência | `#/cliente/<id>/inteligencia` | contexto permanente, produtos e provas |
| Onboarding | `#/cliente/<id>/onboarding` | contexto do mês, com duplicar mês anterior |
| Linhas editoriais | `#/cliente/<id>/linhas` | lista e criação |
| Linha editorial | `#/linha/<id>` | visão geral, estratégia, pilares, criativos, postagens |
| Banco de ideias | `#/cliente/<id>/ideias` | ideias soltas, com "transformar em conteúdo" |
| Arquivados | aba dentro do cliente | gravações e linhas arquivadas, com desarquivar |

**Documento da linha editorial.** Gerado em `js/print-linha.js`, com capa, visão
geral, posicionamento, pilares, criativos e tabela de postagens. A divisão em
folhas é medida no DOM, não fixa: um carrossel de 10 slides ocupa o que
precisar, e a escala automática entra só quando um conteúdo sozinho não cabe.
Os roteiros dos vídeos entram em três modos — Resumo (padrão: título, objetivo
e gancho), Completo (todas as cenas) ou Não incluir.


## B7 Trends Radar

Módulo de inteligência de tendências. Documentação completa em `TRENDS.md`:
arquitetura, o que cada plataforma permite hoje, fórmula do Trend Score, cache
e o que precisa ser configurado.

Antes de usar, três passos manuais:

1. rodar `migration_trends.sql` no SQL Editor do Supabase;
2. publicar a função: `supabase functions deploy trends-search`;
3. configurar a chave: `supabase secrets set YOUTUBE_API_KEY=...`

Sem isso o módulo abre e informa que nenhuma fonte está configurada — nenhum
dado é simulado.


## Linha editorial — exportação

Dois formatos, mesmo conteúdo do Supabase:

- **Documento A4** — vertical, para consulta, envio e impressão.
- **Apresentação 16:9** — horizontal (338,7 × 190,5 mm), para reunião e tela
  compartilhada. Layout próprio, não é o A4 deitado.

Em ambos: capa opcional (sem ela entra uma abertura compacta), campos vazios
não aparecem, notas internas nunca entram e o roteiro vinculado entra apenas
pelo título — o texto completo continua na ficha de gravação.

A paginação é por conteúdo: seções curtas dividem a mesma página em vez de
cada uma exigir folha própria. Um mês com um único conteúdo cabe em uma página.

O botão **Visualizar** abre o preview no formato escolhido, com navegação e
indicador de página, mostrando exatamente o que o PDF vai gerar.

Pilares saíram da linha editorial. Os dados antigos continuam no banco: o que
foi removido foi a dependência na interface e nas exportações.


## B7 Status Semanal

Acompanhamento de sete dias que vai para o cliente em PNG ou PDF 4:5.
Documentação completa em `SEMANA.md`.

Antes de usar, rode `migration_semana.sql` no SQL Editor do Supabase. É o único
passo manual: o módulo não usa secrets nem Edge Functions.


## Central de Produção e Google Agenda

A tela inicial passou a ser a Central de Produção: três categorias com números
clicáveis. Documentação em `CENTRAL.md`.

Antes de usar: rode `migration_central.sql` no SQL Editor. Para a agenda,
publique a função `google-agenda` e configure as credenciais OAuth do Google
(Client ID e Client Secret — API key não serve).
