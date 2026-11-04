# zzz269 — Permissões por ação, acesso que vale na hora e chamado em tempo real

## O que o Kevin pediu
1. Chamado: a mensagem enviada não atualizava em tempo real.
2. Permissões mais específicas: definir se a pessoa pode criar gravação, criar demanda de design, abrir uma tela… por função e por usuário.
3. "Aprovo o acesso e continua dizendo que está sem acesso."
4. Para a equipe, telas com cara de produção, não de administração.

## Causas encontradas
- **Chamado**: a conversa não estava no tempo real do banco (`suporte_mensagens` fora da publicação `supabase_realtime`); a tela só se atualizava a cada 40 s e só quando o chamado mudava.
- **"Aprovei e continua sem acesso"** — duas causas:
  1. A sessão (módulos e níveis) só era lida ao abrir o sistema; a aprovação só valia depois de sair e entrar (a própria notificação dizia "recarregue a página").
  2. Regras do banco presas ao cargo: o quadro de Produção (`kanban_*`) só abria para admin/coordenador, mesmo com o módulo liberado (caso real: Allissan, que tinha Produção liberada e via o quadro vazio). Demandas de vídeo só para coordenação/videomaker. E 28 funções do banco (criar demanda de design, mover peça, cancelar gravação…) checavam o cargo fixo, ignorando qualquer liberação.

## O que mudou

### Banco (`migration_acoes.sql`, aplicada como acoes_1_catalogo, acoes_2_portoes, acoes_2b_initplan, acoes_3_leitura)
- Catálogo `acoes` com 26 ações (gravações, roteiros, linhas, design, vídeo, quadro, aprovações, clientes), cada uma com o **padrão** = a regra de antes.
- `funcao_acoes` (por função) e `perfil_acoes` (por pessoa, permitir/negar).
- `pode_acao(acao)`: administrador sempre; senão pessoa → função → padrão (cargo na lista + nível no módulo, ou liberação explícita do módulo).
- `minhas_acoes()` entra na sessão (`minha_sessao.acoes`); `acoes_painel()`, `funcao_acao_definir`, `perfil_acao_definir` (só admin, com auditoria).
- Os 28 portões das RPCs passaram a perguntar `pode_acao(...)`; as escritas diretas em gravações, roteiros, cenas, linhas, conteúdos e clientes também.
- Quadro de Produção: quem tem o módulo vê; criar/editar/apagar pede a ação.
- Vídeo: quem tem o módulo vê as demandas. Design: "Ver as peças de todos" virou ação.
- Tempo real: `suporte_mensagens`, `suporte_chamados`, `perfil_modulos`, `perfil_acoes`, `funcao_modulos`, `funcao_acoes`.
- **Conferido antes de ligar**: para cada pessoa da equipe, o resultado novo × a regra antiga em todas as ações. A única diferença foi a da Allissan no quadro (a liberação que já tinha sido dada passou a funcionar). Teste em transação desfeita: Pedro (designer) sem a ação não cria demanda de design; com a ação liberada, cria.

### Tela
- **Configurações → Funções e permissões → "O que cada um pode fazer"**: aba *Por função* (tabela Sim/Não, contorno = mudado do padrão) e *Por pessoa* (Como a função / Sim / Não).
- `B7.Perm.pode(acao)`; botões de criar (Criar do topo, Nova gravação em todas as telas, Nova demanda de Design/Vídeo/Produção, Nova linha no Painel) e arrastar (quadro de Design e de Produção) seguem a ação.
- **Acesso vivo** (`js/auth.js`): mudança de acesso chega pelo tempo real (e ao voltar para a aba / a cada 10 min); o menu é remontado e a tela redesenha quando a pessoa não está digitando.
- "Visualizar como" usa as ações da pessoa.
- Recusa do banco ("Só a equipe…") ganha o complemento "peça à administração para liberar em Funções e permissões".
- **Chamado em tempo real** (`js/suporte.js`): mensagem nova aparece na hora; a lista e o andamento se atualizam guardando o rascunho e o foco.
- **Menu da equipe com cara de produção** (`js/nav.js`): "Meu dia", "Meu trabalho", "Produção da equipe"; o Panorama vira "Visão do mês" e só aparece para quem tem Clientes.

### Pedido extra: videomaker sem "Nova gravação" na tela de Gravações
- Causa: uma regra antiga de estilo (`body.b7-so-leitura`, zzz64) escondia o botão de todo mundo que não fosse admin/coordenador, ignorando o acesso. No Calendário o botão aparecia porque lá a regra era outra.
- Agora o botão segue a ação `gravacao.criar`; o padrão de "Criar gravação" e "Editar a gravação" passou a incluir o videomaker com Gravações em Editar/Total (migração acoes_5_videomaker_grava). Testado: Kaique cria gravação (transação desfeita).

## Testes
- `npm test` verde; `permissoes.test.mjs` com 175 conferências (inclui as ações e que toda ação usada na tela existe no banco).
- Prints PC e celular da tela nova de permissões; telas do designer e da coordenação com e sem ações.

## O que falta / próximo passo
- Ver com o Kevin quais telas ainda parecem "de administrador" para a equipe (o menu já mudou; dá para ir tela a tela).
- O tempo real do chamado e o acesso vivo dependem do Realtime do Supabase. Não dá para simular aqui, então conferir com duas contas de verdade.
