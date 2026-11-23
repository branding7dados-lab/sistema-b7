# Ligação B7 ↔ Núcleo 7: dados dos clientes e login unificado (desenho)

## Por quê
- Quem usa os dois sistemas hoje faz login duas vezes: a Central do Núcleo 7 abre o Sistema B7 em outra aba, com
  outra senha. O Yury quer **um login só** para a equipe e a administração.
- A Bruna (Financeiro) pediu para **puxar do Núcleo 7 o cadastro dos clientes** que já está preenchido lá, em vez
  de digitar de novo no B7.

## Decisões do Yury
- **Bilhete de entrada** (opção A): a pessoa entra no Núcleo 7 e o B7 abre já logado. A senha da equipe fica só no
  Núcleo 7.
- **O B7 mantém a própria tela de login**, para o cliente que contratou só a B7. O B7 passa a aceitar **e-mail**.
- **A Central só aparece para quem tem mais de um sistema.** Quem tem um só cai direto nele. A Central também
  aparece dentro do B7.
- **Dados dos clientes:** vêm do Núcleo 7 para o B7, **um por vez e todos de uma vez**.
- A equipe da B7 já tem conta no Núcleo 7, com e-mail. Os clientes têm o mesmo nome nos dois sistemas.
- **Ordem:** dados dos clientes primeiro, depois o login.

## São três entregas
Cada uma funciona sozinha e tem o seu plano. Este documento detalha a **Entrega 1**; as outras duas estão em
esboço e ganham desenho próprio quando chegar a vez.

1. **Puxar o cadastro dos clientes do Núcleo 7** (4.89).
2. **Entrar no B7 pelo Núcleo 7** (bilhete de entrada, e-mail nas contas do B7).
3. **Central dentro do B7** e a volta para o Núcleo 7 sem senha.

## O que já existe
- **Canal B7 → Núcleo 7:** a função `n7-sync` do B7 já fala com o banco do Núcleo 7, com os segredos `N7_URL` e
  `N7_SERVICE_KEY` (guardados no Supabase do B7, nunca no código). O combinado com o programador do Núcleo 7 é:
  o B7 só **escreve** em tabelas com final `_b7` e nunca altera nem apaga nada de lá.
- **Clientes no Núcleo 7:** tabela `clients`. Colunas que interessam: `name`, `status`, `cnpj`, `area_atuacao`,
  `segmento`, `instagram`, `website`, `logo_url`, `contract_months`, `contract_start_date`, `observations` e
  `holder_name`.
  - **Cidade e responsável ficam em dois lugares**, conforme a tela que preencheu:
    - o formulário que o próprio cliente preenche grava em `branding.address` (`city`, `state`) e em
      `branding.responsavel` (`name`, `role`, `whatsapp`, `email`);
    - a tela interna grava a cidade em `audience_location` e o cargo, e-mail e WhatsApp em
      `dados_contratuais.responsavel_*`.
  - `branding` também guarda `accesses` (senhas e acessos do cliente). **Isso nunca pode sair do servidor.**
- **Cadastro no B7:** as funções `cliente_cadastro` e `cliente_cadastro_salvar` (zzz389/zzz390), que já validam
  CNPJ, WhatsApp, e-mail e duração do contrato.

---

# Entrega 1: puxar o cadastro dos clientes do Núcleo 7

## Metas
1. **Um por vez:** na aba Cadastro do cliente, o botão **"Puxar do Núcleo 7"**. O sistema acha o cliente, mostra
   lado a lado o que está no B7 e o que está no Núcleo 7, e a pessoa escolhe o que trazer.
2. **Todos de uma vez:** na tela Clientes, **"Puxar cadastros do Núcleo 7"**. Mostra quais clientes foram
   achados e quantos campos cada um ganharia, e preenche **só os campos vazios**.
3. **Nada do Núcleo 7 muda.** O B7 só lê.

## Fora (não-metas)
- Valor, pagamento, parcelas, vencimento, situação financeira, closer, SDR: não saem do Núcleo 7.
- Mandar dados do B7 para o Núcleo 7.
- Manter os dois cadastros iguais sozinho, para sempre. Puxar é um ato de quem clica.
- Criar no B7 um cliente que só existe no Núcleo 7.

## Antimetas (falhou mesmo funcionando, se...)
- Um dado financeiro do Núcleo 7 aparecer no B7, mesmo que só na resposta do servidor.
- Puxar apagar ou trocar, sem a pessoa ver, um campo que já estava preenchido no B7.
- O cliente do portal, o designer ou o videomaker conseguirem chamar a função e ler clientes do Núcleo 7.
- Um cliente do B7 receber os dados de outro cliente (casamento de nome errado).

## Restrições
- **Sem mudança no Núcleo 7** nesta entrega: nem função, nem tabela, nem regra de acesso. Só leitura, pelo canal
  que já existe (`N7_URL` / `N7_SERVICE_KEY`).
- A chave do Núcleo 7 nunca sai do servidor do B7, não vai para o navegador e não aparece em log.
- Quem pode puxar: quem pode editar o cadastro do cliente (`pode_nivel_acao('cliente.editar')`). Na prática,
  administração, Financeiro e coordenação com a ação liberada. "Todos de uma vez" é **só administrador**
  (inclui o Financeiro).
- Gravar no B7 continua passando por `cliente_cadastro_salvar`: as mesmas validações de quem digita.
- Front em JS puro (`B7.*`), funções do Supabase em Deno, migração aplicada sozinha no merge.

## Abordagens consideradas
1. **O servidor do B7 lê direto a tabela `clients` do Núcleo 7**, pelo canal que já existe, pedindo só uma lista
   fixa de colunas. **Escolhida:** não exige mudar nada no Núcleo 7 e já é como o `n7-sync` trabalha.
2. **Uma função nova no Núcleo 7 que entrega os clientes só ao B7**, com um segredo próprio. Isola melhor o que o
   B7 pode ler, mas obriga a publicar código e criar segredo no Núcleo 7 (produção) só para ler.
   Fica para a Entrega 2, que precisa mexer lá de qualquer jeito: aí a leitura dos clientes pode migrar para essa
   função.
3. **Exportar uma planilha do Núcleo 7 e importar no B7.** Sem código do lado de lá, mas é manual a cada vez e não
   serve ao "um por vez".

## Como funciona

### A função `n7-clientes` (servidor do B7, nova)
- Recebe o pedido **com o login de quem está no B7** e confere a permissão chamando o banco como essa pessoa
  (`cliente_cadastro_pode_puxar`, nova: devolve se pode um por vez e se pode todos).
- Lê do Núcleo 7 **só** estas colunas de `clients`: `id, name, status, cnpj, area_atuacao, segmento,
  audience_location, instagram, website, logo_url, contract_months, contract_start_date, observations,
  holder_name, dados_contratuais, branding`.
  - De `dados_contratuais` usa só `responsavel_cargo`, `responsavel_email` e `responsavel_whatsapp`.
  - De `branding` usa só `address.city`, `address.state` e `responsavel.name/role/whatsapp/email`.
  - O resto desses dois campos (acessos, senhas, dados de contrato) é descartado **no servidor**, antes de
    responder: a resposta é montada campo a campo, a partir de uma lista fixa, e nunca repassa o objeto que veio.
- Ações:
  - `buscar` `{ cliente_id }` → o cliente do Núcleo 7 que casa com o do B7 (ou os candidatos);
  - `ligar` `{ cliente_id, n7_id }` → guarda a escolha quando havia mais de um candidato;
  - `todos` → para cada cliente ativo do B7, o casamento e a proposta de preenchimento (só administrador).
- Sem os segredos `N7_URL` / `N7_SERVICE_KEY`, responde "A ligação com o Núcleo 7 não está configurada", sem erro
  feio.

### Casar o cliente do B7 com o do Núcleo 7
- **1º, pelo vínculo guardado:** `clientes_interno.n7_cliente_id` (coluna nova). Depois da primeira vez, não
  depende mais do nome.
- **2º, pelo nome normalizado:** minúsculas, sem acento, sem pontuação, espaços juntos. "Mercato Sadia" casa com
  "MERCATO  SADIA." e com "Mercató Sadia".
- **Quem entra na conta:** todos os clientes do Núcleo 7, mas os de situação `cancelado` ou `inativo` só valem
  quando não há outro com o mesmo nome. Assim um cadastro antigo cancelado não atrapalha o atual, e um cliente
  pausado lá ainda é achado. A situação aparece na lista de escolha.
- **Um só com o mesmo nome:** casa e guarda o vínculo quando a pessoa aplicar.
- **Mais de um com o mesmo nome** (unidades diferentes, por exemplo): não casa sozinho. No "um por vez", a pessoa
  escolhe numa lista (nome, CNPJ, cidade). No "todos de uma vez", o cliente fica na lista "precisa escolher".
- **Nenhum:** "Não achei este cliente no Núcleo 7", com uma busca por parte do nome para escolher à mão.
- Dois clientes do B7 nunca ficam ligados ao mesmo cliente do Núcleo 7: o segundo é recusado, com o nome do
  primeiro.
- **Vínculo errado tem conserto:** a janela do "um por vez" mostra com qual cliente do Núcleo 7 está ligado e tem
  "Trocar", que abre a busca para escolher outro. Trocar o vínculo não desfaz os campos já trazidos.

### De qual campo para qual campo
| Núcleo 7 | B7 (cadastro) | Regra |
|---|---|---|
| `cnpj` | CNPJ | só os números; fora de 14 dígitos, não traz |
| `area_atuacao`, senão `segmento` | Área de atuação | |
| `branding.address` (`city` + `state`), senão `audience_location` | Cidade / estado | "Cidade - UF" |
| `instagram` | Instagram | sem o `@` |
| `website` | Site | |
| `logo_url` | Logo | só se o B7 não tiver logo e o endereço começar com `https://`. Entra também no "todos de uma vez" |
| `contract_start_date` | Início do serviço | |
| `contract_months` | Duração do contrato | 1 → 1 mês; 2–3 → 3 meses; 4–6 → 6 meses; 7 ou mais → 12 meses ou mais; 0 ou vazio → não traz. Cliente avulso no B7: não traz |
| `branding.responsavel.name`, senão `holder_name` | Responsável: nome | |
| `branding.responsavel.role`, senão `dados_contratuais.responsavel_cargo` | Responsável: cargo | |
| `branding.responsavel.whatsapp`, senão `dados_contratuais.responsavel_whatsapp` | Responsável: WhatsApp | só os números; fora de 10–13 dígitos, não traz |
| `branding.responsavel.email`, senão `dados_contratuais.responsavel_email` | Responsável: e-mail | sem `@`, não traz |
| `observations` | O que foi combinado | no Núcleo 7 esse campo é "o negociado, promessas, objetivos" |

O **nome** do cliente não é trazido (é por ele que se casa). Campo do Núcleo 7 vazio nunca apaga o do B7.

### Um por vez (aba Cadastro)
- O botão **"Puxar do Núcleo 7"** fica no resumo do topo da aba, para quem pode editar.
- Abre uma janela com uma linha por campo: **Campo · No B7 · No Núcleo 7**, e uma caixa de marcar.
  - Campo vazio no B7 e preenchido lá: já vem **marcado**.
  - Preenchido nos dois, com valores diferentes: vem **desmarcado**, com os dois valores visíveis. A pessoa marca
    se quiser trocar.
  - Igual nos dois, ou vazio lá: não aparece.
- "Trazer N campos" grava pelo `cliente_cadastro_salvar` e guarda o vínculo. Se o banco recusar um valor, a janela
  diz qual campo e não grava nada daquele clique.
- Nada para trazer: "O cadastro do B7 já tem tudo o que está no Núcleo 7."

### Todos de uma vez (tela Clientes, só administrador)
- **"Puxar cadastros do Núcleo 7"** abre uma janela com três grupos:
  - **Achados, com campos a preencher** (ex.: "Mercato Sadia: CNPJ, cidade, responsável");
  - **Precisa escolher** (mais de um com o mesmo nome) e **Não achados**, cada um com o atalho para o "um por vez";
  - **Já completos**, só a contagem.
- Um botão: **"Preencher os campos vazios de N clientes"**. Só preenche campo **vazio**; nunca troca valor.
- Grava cliente a cliente. Se um falhar, os outros seguem, e o relatório final lista os que falharam e por quê.
- Ao fim: "N clientes preenchidos, M campos", mais os que ficaram de fora.

## Banco (B7), migração `zzz391`
- `clientes_interno.n7_cliente_id text`, com índice único (um cliente do Núcleo 7 para um do B7).
- `cliente_cadastro_pode_puxar() returns jsonb` → `{ um: boolean, todos: boolean }`.
- `cliente_cadastro` passa a devolver `interno.n7_cliente_id`; `cliente_cadastro_salvar` aceita gravá-lo, com a
  mesma permissão de sempre.
- `cliente_cadastro_salvar` aceita também `logo_n7` (um endereço `https://`): grava `clientes.logo_url` **só se o
  cliente estiver sem logo**. Assim a logo entra na mesma gravação dos outros campos: ou grava tudo, ou nada.

## Já decidido pelo Claude (pode mudar)
- Os nomes: função `n7-clientes`, coluna `n7_cliente_id`, botões "Puxar do Núcleo 7" e "Puxar cadastros do
  Núcleo 7".
- A logo é guardada como o endereço que está no Núcleo 7 (não é copiado o arquivo). Se um dia esse endereço sair do
  ar, a logo some no B7 e é só enviar de novo.
- O arredondamento da duração do contrato da tabela acima.
- "Todos de uma vez" olha os clientes **ativos** do B7 (não os arquivados, os de teste nem os desativados).
- Observações do Núcleo 7 vão para "O que foi combinado", não para "Observações".

## Para quem for construir decidir
- O visual das duas janelas, no estilo das janelas atuais.
- Quantos clientes do Núcleo 7 ler por pedido (paginação), desde que "todos de uma vez" funcione com algumas
  centenas de clientes.

## Testes
- **Regras puras** (Node): normalizar nome, casar (um, vários, nenhum, vínculo guardado), a tabela de campos
  (CNPJ inválido, telefone curto, duração 0/2/5/24, logo `http://`, cidade vinda de `branding.address` e de
  `audience_location`, responsável vindo de cada um dos dois lugares), o cancelado que não atrapalha o ativo de
  mesmo nome, e que a resposta não carrega nenhuma chave fora da lista (com um cliente de exemplo cheio de campos
  financeiros e com `branding.accesses` preenchido).
- **Banco** (Postgres local): `n7_cliente_id` único; `cliente_cadastro_pode_puxar` para admin, Financeiro,
  coordenação com e sem a ação, designer e cliente do portal; migração 2×.
- **Navegador** (Chromium, função simulada): janela "um por vez" com campo vazio marcado, campo diferente
  desmarcado, escolher entre dois candidatos, erro do banco; "todos de uma vez" com os três grupos e o relatório.
- **O que só dá para conferir no ar:** a leitura de verdade do Núcleo 7. Depois do merge, o Yury (ou a Bruna)
  testa com um cliente real, e eu confiro o log da função.

---

# Entrega 2: entrar no B7 pelo Núcleo 7 (4.90)

## O que já existe
- **Núcleo 7:** login por e-mail e senha (`entrarPelaPortaUnica`). A equipe (`app_users`) vai para `/` (a N7 Gestão).
  A Central fica em `/central` e lista os sistemas liberados para a pessoa (`useSistemasLiberados`): super admin
  abre tudo; **a N7 Gestão vem liberada para toda a equipe**; os outros só com liberação em Usuários. O Sistema B7
  abre em **aba nova**, sem login (`window.open`). O Núcleo 7 não pede código de verificação no login.
- **B7:** login por nome de usuário e senha na função `b7-auth`. Cada conta tem por dentro uma identidade técnica
  (`<id>@b7.local`). O "entrar como" já abre a sessão de uma pessoa sem senha (link mágico na identidade técnica).
  Administrador pode ter **verificação em duas etapas** (`dois_fatores.ts`).
- **As contas do B7 não têm e-mail.** `perfis.email_resumo` existe, mas é o e-mail para receber o resumo, opcional.

## Metas
1. Clicar em **Sistema B7** na Central do Núcleo 7 abre o B7 **na mesma aba, já logado**, sem digitar senha.
2. **Quem tem só o B7 cai direto nele** depois de entrar no Núcleo 7. A Central só aparece para quem tem mais de um
   sistema.
3. As contas do B7 ganham **e-mail**, e a tela de login do B7 aceita **e-mail ou nome de usuário**.
4. O cliente que contratou só a B7 continua entrando pela tela do B7, como hoje.

## Fora (não-metas)
- Juntar as contas num banco só, ou copiar senhas de um sistema para o outro.
- Trocar a senha num sistema e ela mudar no outro.
- Clientes do portal do B7 entrando pelo Núcleo 7 (fica para depois; nesta entrega é a equipe e a administração).
- Sair de um sistema derrubar o outro.

## Antimetas
- Alguém entrar no B7 com a conta de outra pessoa (bilhete reaproveitado, copiado ou forjado).
- Um bilhete que vale por muito tempo ou que serve mais de uma vez.
- Passar por cima da verificação em duas etapas do B7.
- A senha do Núcleo 7 ou o token de login dele aparecerem num endereço (URL), num log ou no B7.

## Como funciona: o bilhete
1. A pessoa está logada no Núcleo 7 e clica em **Sistema B7**.
2. A Central chama uma função nova do Núcleo 7, **`b7-bilhete`**, com o login da pessoa. A função confere que a
   pessoa é da equipe, está ativa e tem o Sistema B7 liberado, e devolve um bilhete:
   `{ e: <e-mail>, n: <nome>, x: <vale até, 60 s>, j: <número único> }`, assinado com HMAC-SHA256 com um segredo que
   só os dois servidores têm (`B7_PONTE_SEGREDO`).
3. A Central leva a pessoa para `https://sistema.branding7.com.br/#/ponte?b=<bilhete>` **na mesma aba**. O bilhete
   vai depois do `#`, que o navegador não manda para nenhum servidor nem guarda nos registros de acesso.
4. O B7 tira o bilhete do endereço na hora (para ele não ficar no histórico) e manda para a `b7-auth`
   (`acao: 'ponte'`), que:
   - confere a assinatura (comparação em tempo constante) e a validade;
   - confere que o número único **nunca foi usado** e o marca como usado (tabela `ponte_usados`, apagada depois de
     1 dia);
   - acha a conta pelo e-mail (`perfis.email`, conta ativa, que não seja de cliente);
   - abre a sessão do mesmo jeito que o "entrar como";
   - **se a pessoa tem verificação em duas etapas no B7, pede o código como no login normal**;
   - registra na auditoria: "entrou pelo Núcleo 7".
5. Qualquer falha leva para a tela de login do B7, com o motivo em português: bilhete vencido ("Volte para a Central
   e clique de novo"), conta sem e-mail ("Peça ao administrador para pôr o seu e-mail em Pessoas e acessos"), conta
   desativada.

## E-mail nas contas do B7
- Coluna nova **`perfis.email`**, única (sem diferenciar maiúsculas), opcional. A identidade técnica não muda.
- **Pessoas e acessos** ganha o campo **E-mail** ao criar e editar uma pessoa da equipe.
- Para não digitar todos: **"Ligar com o Núcleo 7"** em Pessoas e acessos (só o administrador pleno). O B7 lê, pelo
  canal da Entrega 1, o nome e o e-mail da equipe do Núcleo 7 (`app_users`, só `name`, `email`, `is_active`), casa
  pelo nome e mostra a lista para conferir antes de salvar. Quem não casar fica sem e-mail até alguém pôr à mão.
- **Login do B7 aceita e-mail:** se o que foi digitado tem `@`, a `b7-auth` procura a conta pelo `perfis.email`; o
  resto do login (senha do B7, tentativas, duas etapas) não muda.

## Quem cai direto e quem vê a Central (Núcleo 7)
- Depois do login no Núcleo 7, para a equipe: **um sistema liberado → vai direto para ele** (se for o B7, já com o
  bilhete); **mais de um → Central**.
- **Atenção:** hoje a N7 Gestão vem liberada para toda a equipe. Com a regra acima, quem tem a Gestão e o B7 vê a
  Central. Para a equipe da produção cair direto no B7, a Gestão precisa estar **desligada** para ela em Usuários do
  Núcleo 7. (Ver a pergunta para o Yury abaixo.)

## O que muda no Núcleo 7 (produção) — o Yury vê e aprova antes
- Função nova `b7-bilhete` (só lê `app_users` da própria pessoa e assina o bilhete).
- Segredo novo `B7_PONTE_SEGREDO` (colocado pelo Kevin no painel do Supabase, dos dois lados; nunca no código nem no
  chat) e o endereço do B7 em `B7_URL`.
- `CentralPage`: o Sistema B7 passa a abrir na mesma aba, com o bilhete.
- `portaUnica`: depois do login, um sistema só → direto; mais de um → Central.
- Nenhuma tabela nem regra de acesso do Núcleo 7 muda.

## Abordagens consideradas
1. **Bilhete assinado, de 1 minuto e uso único (escolhida pelo Yury).**
2. **Mandar o token de login do Núcleo 7 para o B7 conferir lá.** Mais simples, mas o token vale ~1 hora e dá acesso
   ao Núcleo 7 inteiro: se vazasse do endereço, abriria os dois sistemas.
3. **Login do B7 conferir a senha no Núcleo 7.** A senha passaria pelo servidor do B7, e o B7 dependeria do Núcleo 7
   no ar para qualquer login.

## Já decidido pelo Claude (pode mudar)
- O bilhete vale **60 segundos** e uma vez só.
- A **verificação em duas etapas do B7 continua valendo** para quem entra pelo Núcleo 7 (o Núcleo 7 não pede código
  no login).
- O e-mail casa sem diferenciar maiúsculas e sem espaços.
- O e-mail do bilhete vem **só do login conferido do Núcleo 7** (o JWT), nunca de uma tabela que a pessoa possa editar.
- Mudar o e-mail de uma conta segue a hierarquia do "entrar como": administrador comum não muda o de super admin; o do admin supremo, só ele. Toda mudança fica na auditoria.
- **Clientes do portal não entram pelo bilhete** nesta entrega: conta de cliente recebe "Entre pela tela do B7".
- "Voltar à Central" dentro do B7 (Entrega 3) é só um link para a Central do Núcleo 7: quem veio de lá continua
  logado no Núcleo 7 naquele navegador.

## Testes
- **Regras puras** (Node): assinar e conferir o bilhete; vencido; assinatura trocada; campo trocado; formato
  estranho; e-mail com maiúsculas.
- **Banco** (Postgres local): `perfis.email` único; uso único do número do bilhete; login por e-mail.
- **Navegador** (Chromium, servidor simulado): `#/ponte` entra e limpa o endereço; bilhete vencido leva ao login com
  o aviso; pede o código quando a pessoa tem duas etapas; Pessoas e acessos com o campo E-mail e o "Ligar com o
  Núcleo 7".
- **Núcleo 7:** a função `b7-bilhete` com o mesmo teste de regras; a Central e o login conferidos no navegador do
  projeto deles (Playwright), sem número de telefone real.
- **No ar:** o Yury entra no Núcleo 7, clica em Sistema B7 e cai logado; uma pessoa só do B7 cai direto.

# Entrega 3: Central dentro do B7 (4.91)
- **Quem vê:** a equipe do B7 que tem **mais de um sistema** da casa no Núcleo 7, pela mesma regra da Central de lá
  (`_shared/sistemas-n7.ts`, cópia de `sistemaLiberado`). Quem tem só o B7 não vê nada; cliente do portal nem
  pergunta.
- **Como o B7 sabe:** a função `n7-clientes` (ação `meus_sistemas`) acha a conta do Núcleo 7 pelo e-mail que a pessoa
  tem em `perfis_email` (cada um lê o seu) e devolve só os nomes dos sistemas. Guardado na sessão do navegador por
  10 minutos. Sem e-mail, sem conta lá ou com o Núcleo 7 fora do ar: não mostra nada.
- **Onde:** "Central" no pé da barra lateral (acima de "Visualizar como…") e "Central dos sistemas" no menu da conta
  (que também é o do celular). Leva para `https://adm.nucleosete.com.br/central` (segredo opcional `N7_CENTRAL_URL`)
  na mesma aba.
- **Voltar sem senha:** quem entrou pela Central continua logado no Núcleo 7 naquele navegador. Quem entrou direto no
  B7 faz login no Núcleo 7 (lá já é o mesmo e-mail).
