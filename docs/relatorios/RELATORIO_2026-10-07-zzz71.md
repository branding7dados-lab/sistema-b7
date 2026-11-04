# Relatório — Configurações com abas e mais opções

**Versão:** `2026-10-07-zzz71` · **Cache:** `roteiros-b7-v276`
**Pedido:** "acho que as configurações pode ter muito mais coisa!"
**Escolhas do Kevin:** Tela inicial, Teleprompter padrão, Calendário e listas, Google Agenda, Inteligência artificial, Este aparelho, Segurança da conta — organizadas em **abas no topo**.

## Como ficou
Cinco abas (cada pessoa só vê as que têm algo para ela):

| Aba | O que tem | Quem vê |
|---|---|---|
| **Geral** | Tela inicial · Visão padrão do Calendário · Teleprompter (velocidade, letra, contagem, espelho) · Barra recolhida e atalhos · Folha de abertura · Limpar filtros | equipe (cada linha conforme o acesso) |
| **Aparência** | Tema, densidade, animações, desempenho · Abertura (som, rever) | todos |
| **Conta** | Último login · Sair da conta · Sair de todos os aparelhos | todos |
| **Admin** | Usuários e acessos · Google Agenda · Inteligência artificial · Backup | administrador |
| **Sistema** | Versão · Buscar atualização · Instalar como aplicativo · Limpar dados deste aparelho · Banco de dados | todos (banco: administrador) |

A aba aberta por último fica lembrada no aparelho.

## Itens novos
- **Tela inicial:** escolhe o que abre ao entrar (só entre as telas que a pessoa pode abrir). Vale quando o B7 abre sem endereço; link direto continua valendo. Se a pessoa perder o acesso àquela tela, volta ao padrão sozinho.
- **Calendário → visão padrão:** Mês, Semana ou Dia.
- **Teleprompter:** velocidade, tamanho da letra, contagem e espelho já prontos ao abrir. É a mesma preferência que o próprio teleprompter já gravava.
- **Limpar filtros guardados:** Calendário, Produção, Vídeo e Design.
- **Google Agenda (admin):** mostra a conta conectada e a última sincronização; tocar abre o Calendário já com a janela da conexão.
- **Inteligência artificial (admin):** liga/desliga o assistente nos Roteiros e nas Linhas editoriais **para toda a equipe**.
- **Buscar atualização**, **Instalar como aplicativo** (quando o navegador oferece) e **Limpar dados deste aparelho** (memória das telas, arquivos guardados e filtros; não sai da conta nem toca no banco).
- **Sair de todos os aparelhos**, com confirmação.

## Mudança de comportamento (atenção)
**"Sair da conta" agora encerra só o aparelho em uso.** Antes, apesar de a tela dizer "só neste aparelho", o sair derrubava a conta em todos os aparelhos. Quem quiser derrubar em todos usa o item novo "Sair de todos os aparelhos".

Ao sair, o aparelho passa a manter também a tela inicial, a visão do Calendário e os ajustes do teleprompter (são preferências do aparelho, sem dado de ninguém).

## Banco de dados
`migration_sistema_config.sql` (aplicada). Só acréscimo:
- tabela `sistema_config` (hoje com uma linha, `ia`);
- RLS: leitura para a equipe interna; **sem política de escrita**;
- função `sistema_config_definir`, que só grava se quem chamou é administrador, só aceita a chave `ia` e valida o formato.

Nenhuma política existente foi alterada.

## Servidor
`b7-ia` (publicada): antes de qualquer chamada ao provedor, confere `sistema_config`. Recurso desligado → responde "desligado" e não chama a IA. Roteiro e análise seguem "roteiros"; linha e resumo seguem "linhas". Nenhuma chave ou segredo foi tocado.

## Arquivos alterados
`js/dashboard.js`, `styles/dashboard.css`, `js/app.js`, `js/auth.js`, `js/ia.js`, `js/calendario.js`, `supabase/functions/b7-ia/index.ts`, `migration_sistema_config.sql` (novo), `sw.js`.

## Testes executados
**Banco** (transação desfeita ao final):
- videomaker lê a configuração; não grava pela função (barrado) nem direto na tabela (0 linhas);
- administrador grava; campo estranho no valor é descartado; chave desconhecida e valor inválido são barrados;
- anônimo não lê.

**Telas** (app local, arquivos novos, sessão simulada, servidor substituído por dados de exemplo):
- administrador: 5 abas e as linhas de cada uma; designer: 4 abas (sem Admin, sem Teleprompter); cliente: 3 abas (Aparência, Conta, Sistema);
- cada controle novo gravou a preferência certa (tela inicial, visão do Calendário, velocidade, letra, contagem, espelho) e "Limpar filtros" apagou o filtro de teste;
- tela inicial: preferência válida abre a tela; valor inválido ou tela sem acesso caem no padrão;
- Calendário abriu em "Semana" com a preferência;
- IA: desligar enviou o pedido certo ao banco e atualizou a tela; com falha simulada, a chave voltou;
- Google Agenda: linha mostrou conta e sincronização; tocar levou ao Calendário com o pedido de abrir a conexão;
- "Buscar atualização" respondeu "você já está na versão mais recente";
- "Sair de todos" abriu a confirmação (não confirmei);
- sem estouro horizontal em 1400 px e 375 px; no celular as abas cabem/rolam.

**Servidor:** `b7-ia` publicada respondeu 401 a um pedido sem sessão (está no ar).

## Não testado
- Nada com conta real: sair local × sair de todos, IA desligada recusando um pedido de verdade, a janela do Google abrindo sozinha no Calendário (depende de ser gestor de verdade), instalar como aplicativo, limpar dados do aparelho.
- Aparência por captura de tela (o navegador de teste não repinta; conferi medidas e textos), tema escuro e celular físico.

## Limitações
- O liga/desliga da IA chega aos outros aparelhos no próximo carregamento da página (o servidor já recusa na hora).
- "Instalar como aplicativo" só vira botão onde o navegador oferece (Chrome/Edge); no iPhone fica a orientação do menu Compartilhar.
- "Avisos e sons" não entrou (não foi escolhido): continua em Perfil → Avisos.
