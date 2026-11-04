# Relatório de Segurança — Sistema B7 (pacote zzm, 03/10/2026)

## Resumo executivo
Fiz uma auditoria de segurança do B7 inteiro (front, banco, RLS, funções, Storage, Edge Functions, IA, push, Service Worker, segredos e histórico do Git) e corrigi o que dava para corrigir com segurança.

A base estava boa:
- RLS ligado em todas as tabelas;
- papéis lidos do banco, nunca do navegador;
- sem segredo no código nem no histórico;
- texto do banco sempre escapado antes de ir para a tela.

Encontrei, porém, **duas falhas de gravidade alta exploráveis sem login**:
1. qualquer pessoa com a chave pública do site (que é pública por natureza) podia executar todas as funções do banco, várias delas sem conferir quem chamava;
2. qualquer pessoa podia **enviar, trocar e apagar logos de clientes** no Storage.

As duas estão fechadas e testadas por fora, pela API real.

Este trabalho é **revisão de código + testes de política no banco + testes de API reais e não destrutivos**. **Não é um teste de invasão (pentest).**

## Superfície analisada
- **Front:** 50+ arquivos JS (HTML montado como texto, links, armazenamento local, logout), `index.html`, Service Worker (`sw.js`), manifest.
- **Banco:** 90 tabelas e views (RLS e políticas de cada uma), as 160 funções do `public` (quem pode executar, SECURITY DEFINER, `search_path`, SQL dinâmico), gatilhos, jobs do cron e permissões padrão.
- **Storage:** os 3 buckets e as políticas de cada um.
- **Edge Functions:** `b7-auth`, `b7-ia` (Gemini), `b7-push`, `b7-arte`, `google-agenda`, `oportunidades-sync`.
- **Segredos e repositório:** código atual e **todo o histórico do Git**, configuração pública do Auth (`/auth/v1/settings`), nomes dos segredos das funções (só nomes, nunca valores), `.gitignore`.
- **Dependências:** as bibliotecas copiadas no repositório.

## Modelo de ameaças
| Quem | Interesse | Onde é barrado |
|---|---|---|
| Anônimo, só com a chave pública | ler dados, forjar avisos, mexer em arquivos | **Antes:** funções e o bucket de logos abertos. **Agora:** nada executa sem sessão. |
| Pessoa que cria conta pelo cadastro público do Supabase Auth (está ligado) | ler dados com uma sessão válida | sem perfil no B7, não vê nada (testado: tabelas, todas as funções sem argumento e todas com argumento) |
| Cliente do Portal (hoje não há nenhum) | ver outro cliente, ler produção interna | RLS por `posso_ver_cliente`; relatórios de produção agora exigem equipe interna |
| Equipe interna (admin, coordenador, designer, videomaker) | — | modelo atual de confiança mantido (ver Riscos remanescentes) |
| Sessão roubada / navegador comprometido | usar as funções em nome da pessoa | RLS e checagem de papel no banco valem do mesmo jeito; o CSP impede mandar dados para fora |
| Outro site aberto no navegador da equipe | chamar funções lendo a resposta, embutir o B7 | CORS restrito ao endereço do app; o B7 não roda dentro de iframe |
| Conteúdo malicioso (texto, link, arquivo) | executar script no B7 | `esc()` em tudo, links só http/https, SVG fora das logos, CSP |

## Vulnerabilidades encontradas

### 1. ALTA — funções do banco executáveis sem login
- **Área:** schema `public`, 160 funções.
- **Causa:** o padrão do Supabase concede EXECUTE ao papel `anon`. Várias funções SECURITY DEFINER não conferiam quem chamava:
  - `linha_montar_snapshot` devolvia o conteúdo inteiro de uma linha editorial a partir do id;
  - `aprov_emitir` deixava forjar eventos e notificações para a equipe, com nome e texto inventados;
  - os relatórios de vídeo (`video_gestao_resumo`, `video_producao_por_cliente`, `video_relatorio_por_videomaker`, `video_carga_equipe`) entregavam nomes de clientes, números de produção e nomes da equipe;
  - funções internas de processamento e de sequência podiam ser disparadas por qualquer um.
- **Risco:** exposição de dados de clientes sem login (mitigada só pelo id ser difícil de adivinhar), avisos falsos para a equipe e alteração de contadores.
- **Correção:** nenhuma função do `public` é executável por `anon`, e o padrão para funções novas também deixou de conceder.
  - 9 funções internas deixaram de ser chamáveis por usuário logado: quem as usa por dentro roda como dono e o cron roda como `postgres` (conferido).
  - Os 4 relatórios passaram a exigir equipe interna, por um "embrulho": a função original foi renomeada para `_<nome>_base` e o cálculo não mudou.
- **Verificação:** veja a tabela de testes.

### 2. ALTA — bucket `client-logos` gravável sem login
- **Causa:** as políticas de insert, update e delete valiam para `anon` sem condição.
- **Risco:** qualquer pessoa trocava a logo de um cliente (aparece no sistema, nos PDFs e no push), apagava logos ou subia arquivos, inclusive SVG com script, no domínio do Supabase.
- **Correção:** enviar, trocar e apagar logo agora exige equipe interna. A leitura continua pública, porque push e documentos usam a URL direta. SVG saiu dos tipos aceitos, no banco e na tela (nenhuma logo atual é SVG).

### 3. MÉDIA — links do banco sem validação de esquema
- **Causa:** `esc()` impede quebrar o atributo, mas não impede `javascript:`. Os links de material e vídeo (Vídeo), de referência (Gravação), das fontes (Oportunidades) e da notificação viravam `href` sem checagem.
- **Risco:** um link `javascript:` gravado executaria código quando alguém da equipe clicasse.
- **Correção, nas duas pontas:**
  - Tela: `B7.UI.linkExterno()` só aceita http/https; `B7.UI.linkInterno()` só aceita rotas `#/`.
  - Banco: restrições recusam `javascript:`, `data:`, `vbscript:` e `file:` em `demandas_edicao.link_material`, `video_versoes.arquivo_url`, `gravacao_itens.url` e `clientes.logo_url`. Conferi antes: os dados atuais estão todos vazios ou em http(s).

### 4. MÉDIA (sem efeito real hoje) — XSS refletido na página de retorno do Google
- **Causa:** em `google-agenda`, o parâmetro `?error=` da URL ia para dentro de um `<script>` via `JSON.stringify`, que não neutraliza `</script>`. O `postMessage` usava a origem `"*"`.
- **Situação real:** o Supabase entrega essa página como `text/plain` no domínio padrão, então o script não executava (testado ao vivo).
- **Correção:**
  - `< > &` viram `\u00xx` dentro do script;
  - o `postMessage` vai só para a origem do app;
  - o app aceita a mensagem só se ela vier do servidor do Supabase.
- **Efeito colateral encontrado:** essa página de retorno aparece como texto cru depois de conectar o Google (problema funcional anterior, ver Ações manuais).

### 5. BAIXA — `b7-push` aceitava webhook sem segredo, se o segredo faltasse
- **Situação:** o segredo **está configurado**, então hoje não era explorável.
- **Correção:** sem o segredo, a função agora **recusa** (antes aceitava qualquer chamada). A comparação passou a ser em tempo constante.

### 6. BAIXA — `b7-auth`
- **Detalhe técnico nas respostas:** a resposta 500 devolvia a mensagem crua do erro (banco ou biblioteca). Agora o detalhe fica só no log.
- **Token de bootstrap/recuperação:** passou a ter comparação em tempo constante e freio de 8 erros por 15 minutos por endereço.

### 7. BAIXA — CORS `*` nas funções
- Todas usam token Bearer, não cookie, então não havia CSRF.
- Mesmo assim, agora só o endereço do app (e `localhost`/`127.0.0.1`, para teste) pode ler as respostas no navegador: módulo `_shared/cors.ts`, com a lista configurável pelo segredo `B7_ORIGENS`.

### 8. BAIXA — `search_path` mutável
- Funções auxiliares e de gatilho sem `search_path` fixo agora têm `search_path = public`. Lógica inalterada.

### 9. INFORMATIVA — repositório
- Não havia `.gitignore`. Criado (`.env*`, chaves, cache da CLI).
- O cache da CLI do Supabase (`supabase/.temp/`, com o endereço do servidor do banco, **sem senha**) saiu do versionamento. Continua no computador.

## Autenticação
Conferi o `b7-auth`:
- login por usuário com identidade técnica;
- mesma mensagem para usuário inexistente, senha errada e conta desativada (testado ao vivo: "Usuário ou senha inválidos.");
- limite de tentativas;
- troca de senha exige a senha atual;
- papel e estado lidos do banco;
- "entrar como" só para admin, nunca em conta de cliente, e auditado;
- ações administrativas sem sessão respondem 401 (testado).

Logout (`B7.Auth.sair`): encerra a sessão no Supabase, apaga as chaves `b7_` (menos o tema) e o `sessionStorage`, e recarrega a página, o que limpa a memória e o Realtime.

**Atenção:** o cadastro público do Supabase Auth está **ligado** (ver Ações manuais).

## Autorização e RLS
- **RLS:** ligado em **todas** as tabelas. As views usam `security_invoker`, menos `portal_gravacoes`, que é intencional: filtra por `posso_ver_cliente` e mostra ao cliente só o que foi liberado.
- **Tabelas que só o servidor acessa** (RLS ligado, sem política: ninguém lê pela API): `calendario_conexoes` (guarda o token do Google), `calendario_oauth_estados`, `ia_uso`.
- **Mudança de papel:** `perfis` não tem política de UPDATE nem INSERT. Papel e estado só mudam pelo `b7-auth`, com o admin conferido no banco.
- **Escrita em `demandas_edicao`:** usuário logado nem tem permissão de UPDATE direto (só pelas funções). Vi isso no teste.
- **Comentários do Portal:** já são assinados pelo gatilho `comentarios_assina`. O cliente não consegue se passar por outra pessoa.
- **Isolamento por id (IDOR):**
  - **tabelas:** as políticas dependem do papel ou de `posso_ver_cliente(client_id)`, nunca do id enviado;
  - **funções com id:** testei todas as que um usuário sem perfil pode chamar, e nenhuma devolveu dado.

## Isolamento de dados
Simulei, no próprio banco e com transação desfeita, quatro identidades:

| Identidade | Resultado |
|---|---|
| anônimo | nada executa e nada é lido |
| admin real | relatórios, painel e 23 clientes |
| designer real | relatórios de equipe, 23 clientes e 133 peças |
| logado sem perfil | 0 clientes, 0 conteúdos, 0 perfis; relatórios e envio de logo negados |

Também varri **todas** as funções SECURITY DEFINER chamáveis por usuário logado, com e sem argumentos, como o usuário sem perfil: nenhuma devolveu dado.

## Banco / RPC / Functions
- 160 funções revisadas quanto a SECURITY DEFINER, `search_path`, quem executa e checagem de papel. Todas as SECURITY DEFINER têm `search_path` fixo. Não há SQL dinâmico com entrada do usuário (só `b7_grant_anon_se_aberto`, SECURITY INVOKER, de manutenção).
- Jobs do cron (`agenda-lembretes`, `oportunidades-sync`, `notif-agendados`) rodam como `postgres` e não são afetados.

## Storage e uploads
| Bucket | Antes | Agora |
|---|---|---|
| `client-logos` (público) | anônimo gravava e apagava | só equipe interna grava; leitura pública; sem SVG |
| `avatars` (público) | sem política de escrita: só o `b7-auth`, com chave de serviço, grava, validando tipo e tamanho | igual (adequado) |
| `design-files` (privado) | leitura e envio por `design_pode_acessar` (equipe ou designer responsável), apagar só equipe; download por URL assinada curta | igual (adequado) |

Teste de fora:
- envio anônimo de logo: **recusado** (nenhum arquivo criado, conferido);
- listagem anônima de `design-files`: **vazia**.

## APIs / Edge Functions / IA
- Todas conferem a sessão no servidor (`auth.getUser`) e leem o papel do banco.
- O `b7-ia` (Gemini):
  - é só para a equipe;
  - designer não usa nas tarefas de escrita;
  - carrega o contexto **com o RLS da própria pessoa**, então não há vazamento entre clientes;
  - tem limite por pessoa (8/min, 80/h, 2 simultâneos) e tamanho máximo de pedido;
  - não guarda texto enviado nem resposta;
  - a chave do provedor fica só no segredo `GEMINI_API_KEY`.
- O `oportunidades-sync`:
  - só busca URLs fixas cadastradas no banco (não há SSRF com entrada do usuário);
  - forçar a sincronização exige admin;
  - sem admin, roda no máximo uma vez a cada 30 minutos.
- O `b7-arte` (imagem do push) exige assinatura HMAC.

## XSS / Injection / Inputs
Revisei todo HTML montado como texto. Exceto os links (item 3), não há caminho de XSS armazenado:
- `esc()` é aplicado em nomes, títulos, textos, legendas, motivos, notificações e respostas da IA;
- `toast`, `confirmar` e `perguntar` escapam o texto;
- não há `eval`/`new Function` no código nem nas bibliotecas;
- links de Design e Kanban já validavam http(s).

Não há SQL montado com texto do usuário. As consultas usam a API parametrizada do Supabase.

## PWA / Service Worker / Cache
- O `sw.js` só guarda arquivos do próprio site. Respostas do Supabase **nunca** passam por ele.
- O clique em notificação só navega para rotas `#/`.
- Nada de dado de cliente fica no Cache Storage.
- `localStorage` só guarda preferências e a sessão do Supabase (padrão da biblioteca), que é apagada no logout.

## Realtime / Notificações
- Realtime usa `postgres_changes` com o RLS de quem assina, e é encerrado ao sair da tela e no logout (recarga).
- O texto da notificação é montado no banco.
- Inscrições de push só da própria pessoa (`push_proprias`).
- O teste de push exige sessão e só manda para o próprio aparelho.

## Headers de segurança
O GitHub Pages **não deixa configurar cabeçalhos HTTP**. Implementado por `<meta>` no `index.html`:
- **CSP:**
  - script, estilo e conexões só do próprio site e do Supabase do B7;
  - imagens só https;
  - iframe só do Google Drive;
  - `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`;
  - sem `unsafe-eval`.
- `'unsafe-inline'` continua necessário: o script do tema no `<head>` e 21 atributos `on…=` na interface. Reduzir é o próximo passo.
- **Referrer-Policy:** `strict-origin-when-cross-origin`.
- **Anti-clickjacking:** o B7 fica em branco se for embutido em um iframe. `frame-ancestors` não funciona por `<meta>`.
- **Não dá pelo GitHub Pages:** HSTS, `X-Content-Type-Options`, `frame-ancestors` e `Permissions-Policy` (ver Ações manuais).

## Secrets
- **Código atual e todo o histórico do Git:** nenhuma credencial secreta encontrada (chave de serviço, chave Gemini/Google, segredo do Google, token do GitHub, chave privada, URL de banco com senha, chave VAPID privada, segredo de webhook, token de bootstrap).
- O único token encontrado é a chave **anon** (pública por definição). Hoje o app usa a chave *publishable*, também pública.
- Os segredos das funções estão só nos secrets do Supabase. A listagem foi feita só por nome; a CLI mostra apenas o resumo (hash), nunca o valor.
- **Ainda pendente, de antes:** a chave do Gemini que apareceu no chat em 01/10 deve ser **trocada** (ver Ações manuais).

## Dependências
| Biblioteca | Versão | Situação |
|---|---|---|
| supabase-js | 2.115.0 | atual |
| html2canvas | 1.4.1 | sem falha conhecida (pouco mantida) |
| **jsPDF** | **2.5.2** | falhas conhecidas de negação de serviço com imagem malformada, corrigidas na 3.x. Impacto baixo (no próprio navegador) |
| **xlsx (SheetJS)** | **0.18.5** | falhas conhecidas: poluição de protótipo (corrigida na 0.19.3) e ReDoS (corrigido na 0.20.2) **ao ler uma planilha maliciosa**. É usada na importação de planilhas de Vídeo |

Não atualizei: exige baixar as bibliotecas de fora. Fica como ação para aprovar.

## Testes realizados

**Análise estática (código):**
- varredura do HTML montado com dados do banco;
- varredura de `href`/`src` com dados;
- busca por `eval`, `innerHTML` com variáveis cruas e `insertAdjacentHTML`;
- leitura das 6 Edge Functions;
- busca de segredos no código e em todo o histórico do Git (só tipo e contagem, nada impresso).

**Testes de política no banco** (transação desfeita, com papéis simulados por `set role` + JWT), antes de aplicar:

| Identidade | Teste | Resultado |
|---|---|---|
| anônimo | `linha_montar_snapshot`, `video_carga_equipe`, `agenda_verificar_lembretes`, `sou_equipe` | **negados** (42501) |
| anônimo | enviar logo | **negado** |
| anônimo | ler clientes | **negado** |
| admin | os 4 relatórios, painel, `video_mes_fechado`, 23 clientes, view de videomakers, envio de logo | **funcionam** |
| admin | `linha_montar_snapshot` direto | **negado** (interna) |
| designer | relatório de equipe, 23 clientes, 133 peças | **funcionam** |
| logado sem perfil | relatórios e envio de logo | **negados** |
| logado sem perfil | clientes, conteúdos, perfis | **0** |
| logado sem perfil | todas as funções SECURITY DEFINER (com e sem argumentos) | nenhuma devolve dado |
| — | links `javascript:` e ` JavaScript:` | **recusados** |
| — | links https e vazio | **aceitos** |

**Testes de API reais, depois de aplicar** (de fora, só com a chave pública, sem gravar nada):

| Chamada | Resultado |
|---|---|
| RPCs sem login (snapshot, relatórios, lembretes) | 401 |
| tabelas e views | 401 |
| upload de logo sem login | recusado (conferido: nenhum arquivo criado) |
| listar `design-files` | vazio |
| `b7-ia`, `google-agenda`, `b7-push` (teste), ações admin do `b7-auth` sem sessão | 401 |
| login com senha errada | 401 genérico |
| token de recuperação errado | 403 |
| webhook do push sem segredo | 401 |
| sincronização forçada sem admin | 403 |
| CORS: origem do app | recebe a origem dela |
| CORS: localhost | recebe a origem dela |
| CORS: origem estranha | **não** recebe a origem dela |
| preflight | OK |
| retorno do Google com `?error=</script><script>…` | o código não aparece no corpo |

**Testes no navegador** (servidor local, com o CSP novo):
- a tela de login abre e a chamada ao Supabase passa;
- envio de dados para outro site, script externo e iframe externo são **bloqueados**;
- 10 telas abertas com sessão simulada: nenhuma violação de CSP;
- `linkExterno('javascript:…')` vira `''`; `linkInterno('javascript:…')` vira `#/`.

**Não feito:**
- teste de invasão;
- teste com uma conta real logada no site publicado (não tenho senha);
- teste em celular;
- teste de carga do limite de tentativas.

## Regressões
- **Testado:** admin e designer continuam com relatórios, painel, clientes, peças e envio de logo. Login responde normalmente. O CSP não bloqueou nada nas telas abertas.
- **Push:** o último aviso real saiu antes da publicação. Como o segredo do webhook já estava configurado e é o mesmo, o envio deve seguir igual, mas ainda **não foi observado** depois da publicação.
- **Não testado com conta real:** marcar gravação, importar planilha de vídeo e conectar o Google. As funções que essas telas usam continuam liberadas para quem está logado.

## Alterações no banco
Arquivo: `migration_seguranca_endurecimento.sql`. Duas migrations aplicadas: `seguranca_endurecimento` e `seguranca_search_path_fixo`.
- `REVOKE EXECUTE` de `anon` (e `PUBLIC`) em todas as funções do `public`, mais o padrão para funções novas.
- `REVOKE EXECUTE` de `authenticated` em 9 funções internas.
- 4 relatórios de vídeo embrulhados com checagem de equipe interna (originais renomeados para `_<nome>_base`).
- Políticas `logos_escrita`, `logos_troca` e `logos_remocao` refeitas; SVG fora do bucket `client-logos`.
- 4 restrições `CHECK` de esquema de link.
- `search_path = public` nas funções que não tinham.

Nada foi apagado. Nenhum dado foi alterado. As regras de quem vê o quê para a equipe interna não mudaram.

**Para desfazer:** reverter cada `REVOKE` com o `GRANT` correspondente; renomear as `_..._base` de volta; recriar as políticas antigas (estão descritas no relatório).

## Riscos remanescentes
- **Designer e videomaker têm escrita total pelas políticas `sou_equipe_interna()`** (clientes, roteiros, linhas, conteúdos), inclusive excluir. Na tela não aparece, mas por chamada direta é possível. É uma **decisão de produto** (já estava pendente com você) e não mudei sem a sua resposta.
- **Cadastro público do Supabase Auth ligado:** um estranho cria conta e entra com sessão. Testei que ele não vê nem executa nada, mas é superfície desnecessária.
- **CSP com `'unsafe-inline'`.**
- **Cabeçalhos HTTP fortes** (HSTS, `frame-ancestors`, `nosniff`) dependem de sair do GitHub Pages ou de pôr um proxy na frente.
- **xlsx e jsPDF desatualizados.**
- **Limite de tentativas de login** fica na memória da função: reinicia junto com a função.
- **O token de sessão fica no `localStorage`** (padrão do Supabase): um XSS que escapasse poderia lê-lo. O CSP reduz o envio para fora.

## Ações manuais necessárias
1. **Desligar o cadastro público:** Supabase → Authentication → Sign In / Providers → desligar "Allow new users to sign up". O B7 cria contas pelo `b7-auth` com a chave de serviço, que não depende disso.
2. **Ligar a proteção contra senhas vazadas:** Supabase → Authentication → Passwords (aviso `auth_leaked_password_protection`).
3. **Trocar a chave do Gemini** (tipo: chave de API do Google AI Studio) que apareceu no chat em 01/10, e atualizar o segredo `GEMINI_API_KEY`.
4. **Aprovar a atualização de xlsx (0.20.3+) e jsPDF (3.x)**, baixando das fontes oficiais e testando importação e PDF.
5. **Domínio próprio:** ao mudar de endereço, configurar o segredo `B7_ORIGENS` e o `APP_URL`/`GOOGLE_REDIRECT_URI`. Com hospedagem que permita cabeçalhos (ou Cloudflare), ligar HSTS, `frame-ancestors 'none'` e `X-Content-Type-Options`.
6. **Decidir** se designer e videomaker podem editar e excluir clientes, roteiros e linhas pelo banco. Hoje podem.

## Resultado
As duas falhas altas (funções e logos abertas a anônimos) e as médias de links estão fechadas e verificadas por fora, pela API real.

O acesso de quem não tem sessão, ou não tem perfil no B7, foi testado como nulo. O trabalho legítimo de admin e designer continua funcionando nos testes feitos.

O B7 **não está "100% seguro"**: os riscos remanescentes e as ações manuais acima continuam valendo. Mas a superfície exposta ficou bem menor, e as proteções agora estão no banco e no servidor, não na tela.
