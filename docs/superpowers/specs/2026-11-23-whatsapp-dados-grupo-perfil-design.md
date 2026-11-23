# WhatsApp do B7: dados do grupo e perfil do contato (4.85.0)

## Por quê
Na Central, a equipe só vê a conversa e o painel do cliente. Para saber **quem está num grupo**, quem é
admin, qual é a descrição, ou **quem é um contato** (foto, recado, empresa, grupos em comum), hoje é
preciso pegar o celular. O Yury quer ver isso no B7 e, sendo administrador, **mexer** no grupo
(membros, admins, nome, descrição, foto, link, regras) sem sair do sistema.

## Metas
- Clicar no topo da conversa (foto ou nome) abre **Dados do grupo** ou **Perfil do contato**, num painel
  por cima da coluna da direita. No celular, em tela cheia.
- Grupo:
  - foto, nome, descrição, data de criação, número de membros e "via <número>";
  - lista de membros com foto, nome, número e os selos **Admin**, **Equipe B7** e **Número da B7**.
- Contato:
  - foto grande, nome, número, recado;
  - conta comercial, com descrição, e-mail e site;
  - cliente ligado e **grupos em comum** com os números da B7 que a pessoa vê.
- Clicar num membro (ou no nome de quem escreveu numa mensagem do grupo) abre o perfil dele. No perfil,
  "Conversar" abre a conversa privada no mesmo número.
- **Só o administrador mexe** (decisão do Yury):
  - adicionar e remover membros;
  - tornar ou tirar admin;
  - trocar o nome e a descrição no WhatsApp;
  - trocar a foto;
  - ver, copiar e revogar o link de convite;
  - escolher "só admins enviam" e "só admins editam os dados".

  A equipe vê tudo, sem os botões de mudar, e o servidor também recusa o pedido.

## Anti-metas
- Uma ação sair pelo número errado (vale a regra da 4.84: o número da conversa).
- Remover membro, revogar link ou mudar regra sem confirmação.
- Botão de mexer que não funciona sem dizer por quê: com o número da B7 sem admin no grupo, os botões
  ficam desligados com "O número <nome> não é admin deste grupo".
- Abrir os dados travar a conversa ou deixar a tela vazia enquanto o WhatsApp responde.

## Jeitos considerados
| | Como | Escolha |
|---|---|---|
| A | Na hora: cada abertura pergunta ao WhatsApp | ❌ "grupos em comum" fraco; 1–3 s por abertura |
| B | Tudo guardado no banco, mantido só pelos avisos do webhook | ❌ fica errado se um aviso se perder |
| **C** | Abre com o que está guardado e atualiza na hora; o guardado é mantido por abertura, por aviso de entrada e saída e pela atualização de contatos a cada 6 h | ✅ escolhida pelo Yury |

## Banco (migração `zzz385_wa_grupo_membros.sql`, aplicada sozinha no merge)
- **`wa_grupo_membros`**:
  - colunas: `numero_id uuid`, `grupo_jid text`, `membro_jid text` (pode ser `@lid`), `telefone text`
    (só dígitos, quando se sabe), `admin text` (null | 'admin' | 'superadmin'), `atualizado_em`;
  - chave primária: `(numero_id, grupo_jid, membro_jid)`;
  - índices: `(numero_id, telefone)` e `(numero_id, membro_jid)`;
  - RLS de leitura: `wa_pode_ver_numero(numero_id)`; escrita só pelo servidor.
- **`wa_conversas`** ganha os dados do grupo: `descricao text`, `criado_wa timestamptz`, `dono_jid text`,
  `so_admins_enviam boolean`, `so_admins_editam boolean`, `membros_qtd int`, `membros_em timestamptz`
  (última atualização da lista).
- **`wa_grupos_em_comum(p_jid text) returns table (numero_id uuid, grupo_jid text, nome text, foto_url text)`**
  (security definer):
  - acha os grupos dos números que quem chama pode ver em que esse contato está;
  - casa pelo `membro_jid` ou pelo telefone (os 8 últimos dígitos, como o Otto já faz).

## Servidor (`wa-evolution`)
Leitura, para quem vê o número (`podeAcao` normal):
- **`grupo_dados {jid}`**:
  - chama `/group/findGroupInfos`;
  - grava os campos novos em `wa_conversas` e a lista em `wa_grupo_membros` (troca a lista inteira daquele
    grupo e número);
  - devolve `{ grupo: {...}, membros: [{ jid, telefone, nome, foto, admin, equipe, b7 }], b7_admin }`. O
    `nome` e a `foto` vêm de `wa_contatos`. `equipe` diz se o telefone está na equipe do Otto
    (`numerosDaEquipe`, exportada). `b7` diz se é um número cadastrado em `wa_numeros`. `b7_admin` diz se o
    número da conversa é admin do grupo.
- **`contato_perfil {jid}`**:
  - chama `/chat/fetchProfile` (nome, recado, foto, comercial, descrição, e-mail, site), com
    `fetchProfilePictureUrl` se faltar foto;
  - atualiza `wa_contatos.foto_url`;
  - devolve o perfil e `grupos` de `wa_grupos_em_comum`.

Ações, só administrador (entram em `ACOES_ADMIN`, sempre pelo número da conversa):
- **`grupo_membros {jid, acao: add|remove|promote|demote, participantes: [telefone ou jid]}`**
  (`/group/updateParticipant`). Devolve o resultado por participante (o WhatsApp pode recusar um, ex.:
  privacidade não deixa adicionar) e atualiza `wa_grupo_membros`.
- **`grupo_editar {jid, nome?, descricao?}`** (`updateGroupSubject` / `updateGroupDescription`). O nome
  também passa para `wa_conversas.nome`, a menos que `nome_fixo` esteja ligado.
- **`grupo_foto {jid, path}`** (imagem já subida em `wa-midia/envio/`, como os anexos)
  (`updateGroupPicture`).
- **`grupo_convite {jid, revogar?}`** (`/group/inviteCode` ou `revokeInviteCode`), que devolve `{ link }`.
- **`grupo_regra {jid, so_admins_enviam?, so_admins_editam?}`** (`/group/updateSetting`: announcement /
  not_announcement / locked / unlocked).

Manutenção do guardado:
- **webhook**: o evento `GROUP_PARTICIPANTS_UPDATE` entra em `EVENTOS` e no `wa-entrada`. `add`/`remove`/
  `promote`/`demote` atualizam `wa_grupo_membros` daquele número.
- **atualização de contatos** (`contatos`, a cada 6 h): também chama `fetchAllGroups?getParticipants=true`
  e regrava os membros de todos os grupos do número.

## Telas (`js/central-wa.js` + novo `js/wa-info.js`, `B7.WaInfo`)
- `B7.WaInfo.abrirGrupo(conv)` e `B7.WaInfo.abrirContato(jid, numeroId)` desenham o painel `.wz-info`
  dentro de `#wz` (por cima de `#wz-lado`; no celular, tela cheia). Têm ✕ e Esc para fechar.
- O painel mostra na hora o que está guardado: `wa_conversas` e `wa_grupo_membros` lidos pela própria
  tela, com RLS. Depois atualiza com a resposta do servidor e mostra "atualizando…" discreto.
- Topo da conversa: foto e nome abrem o painel. O "Renomear" continua no menu ⋯ (deixa de ser o clique
  no nome). No grupo, o nome de quem escreveu uma mensagem abre o perfil dessa pessoa.
- Membros:
  - busca por nome ou número quando o grupo tem mais de 12 pessoas;
  - ordem: números da B7, depois admins, depois o resto, por nome.
- Administrador:
  - botões e o menu ⋯ de cada membro (ver perfil, conversar, tornar ou tirar admin, remover);
  - "+ Adicionar": procura nos contatos ou aceita um número digitado (DDI + DDD + número);
  - lápis no nome e na descrição;
  - trocar foto;
  - link de convite (copiar, revogar);
  - duas chaves de regra.
- Confirmação (`B7.UI.confirmar`) para remover, revogar o link e mudar as regras.
- Perfil do contato: "Conversar" abre a conversa privada se ela já existe no mesmo número. Se não existe,
  o botão some, porque a Central não abre conversa nova; isso fica fora desta entrega.

## Fora desta entrega
- Criar grupo novo, sair do grupo, aprovar pedidos de entrada.
- Bloquear contato.
- Começar conversa nova com quem nunca falou com o número.

## Ordem de publicação
Merge só: a `zzz385` roda sozinha (automação de 23/11) e o site e as funções esperam o banco.
O evento novo do webhook passa a valer quando o admin abre Configurações → Números, porque
`estado(n)` religa o webhook com a lista nova de eventos. O relatório lembra disso.

## Decisões de quem construiu (conferir)
1. **"Administrador"** é o administrador do B7 (`ehAdmin`, o mesmo de `ACOES_ADMIN`), e o servidor confere isso.
   Os botões também ficam desligados quando se sabe que o número da conversa não é admin do grupo
   (`b7_admin === false`). Se não dá para saber (`null`), eles ficam ligados e o servidor repassa o erro do
   WhatsApp.
2. **O próprio número no grupo**: casa o telefone do membro (ou o `phoneNumber` que o Evolution manda
   junto do `@lid`) com `wa_numeros.numero`, com todos os dígitos. Sem telefone conhecido: `b7_admin = null`.
3. **Grupos em comum**: casa por `membro_jid` igual, ou pelo telefone com todos os dígitos. O telefone vem
   do membro, de `wa_contatos.numero` ou do próprio jid `@s.whatsapp.net`. Contato só com `@lid` e sem
   número conhecido pode ter a lista incompleta, e o painel diz isso.
4. **Preencher a primeira vez**: a atualização de contatos (`contatos`, chamada ao abrir a Central, no
   máximo a cada 6 h) passa a trazer os membros de todos os grupos, com `fetchAllGroups?getParticipants=true`,
   por número e com 120 s. Até lá, cada grupo aberto já fica guardado.
5. **Quem lê os membros**: quem vê o número, igual às mensagens do grupo, que já mostram quem escreve.
   `wa_grupos_em_comum` filtra por `wa_pode_ver_numero`, ou seja, por quem chama.
6. **Foto do grupo**: a tela aceita imagem (JPG, PNG ou WebP, até 5 MB) e sobe em `wa-midia/envio/`. O
   servidor manda ao Evolution o link assinado, como em `enviar_midia`. Não há corte: o WhatsApp centraliza.
7. **Sem resposta do WhatsApp**: mostra o que está guardado com "Não deu para atualizar agora · Tentar de
   novo". Sem nada guardado, mostra só a mensagem e o botão. Com o número desconectado: "O número <nome>
   está desconectado".
8. **"Conversar"**: procura a conversa privada no mesmo número por `membro_jid` e por
   `<telefone>@s.whatsapp.net`.
9. **Evento `GROUP_PARTICIPANTS_UPDATE`**: lido com cuidado, porque os participantes podem vir como texto ou
   objeto e o formato muda de versão para versão; formato desconhecido é ignorado. Atualiza `membros_qtd` e
   não cria mensagem na conversa.
10. **Nome do grupo**: o painel mostra o nome do WhatsApp. Se a equipe deu outro nome no B7, ele aparece
    embaixo como "No B7: …".
11. **Chaves de regra**: ficam desligadas até chegar a resposta atual do WhatsApp.
12. Versão 4.85.0.

## Decisões deixadas para quem constrói
- O desenho fino do painel, no estilo `wz-` atual (claro e escuro).
- Os textos curtos das confirmações e dos erros, em português simples.

Versão: **4.85.0**, com registro em `js/novidades.js`.
