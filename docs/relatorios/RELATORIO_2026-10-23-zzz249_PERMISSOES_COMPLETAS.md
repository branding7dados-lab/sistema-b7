# zzz249: sistema de permissões e funções completo

Pedido do Kevin: "preciso que o sistema de permissões e funções seja completo." Escolha dele: **completo e seguro**. O banco passa a obedecer a matriz, sem ninguém ganhar nem perder acesso no dia da troca.

## O que estava incompleto (raio-x)
- A tela de Funções e acessos dava a cada pessoa um nível por módulo (Sem, Ver, Editar ou Total). O banco, porém, só conferia isso nas ações feitas por funções do banco (design, vídeo, gravações, calendário, aprovações, oportunidades). Nas **tabelas de conteúdo**, a escrita era liberada pelo **cargo** (`sou_equipe()`): Clientes, Linhas editoriais, Roteiros, Gravações e Status semanal.
  - Coordenador com Roteiros em "Ver" ainda editava.
  - Designer que ganhava "Clientes: Editar" não conseguia editar.
  - Quem não podia alterar via a alteração **sumir em silêncio** (o banco ignorava, sem erro).
- WhatsApp era aberto a toda a equipe, e Lixeira e Agenda da equipe eram só do admin, sem como dar ou tirar.

## O que mudou
### Banco (aplicado no Supabase; registro em `migration_permissoes_niveis.sql`)
- **`pode_nivel(módulo, mínimo)`:**
  - admin sempre pode;
  - para a equipe, é preciso ter o nível **e** ser equipe de gestão (como antes) **ou** ter uma **concessão explícita** da administração (`concessao_explicita`): exceção na conta da pessoa ou função personalizada.
- **Políticas das tabelas de conteúdo** (18 tabelas, via ALTER POLICY, sem DROP):
  - criar e alterar exigem **Editar**;
  - excluir exige **Total**.
  - Módulos: `clientes` (clientes, inteligência, produtos, provas, onboardings, atividades), `linhas` (linhas, conteúdos, slides, frames, pilares, ideias), `roteiros` (roteiros, cenas), `gravacoes`, `semanas` (status semanais, itens, versões).
- **Erro claro em vez de silêncio:** a política de alteração deixa o pedido chegar e recusa com erro de permissão. A tela traduz o erro: "Seu acesso a Roteiros não deixa fazer esta alteração… peça à administração…".
- **Módulos novos na matriz:**
  - **WhatsApp:** padrão Total para as três funções, ou seja, igual a hoje. Leitura e ações do WhatsApp agora exigem o módulo.
  - **Lixeira:** padrão só admin, como hoje.
  - **Agenda e recado da equipe:** padrão só admin, como hoje. Quem recebe Editar passa a marcar ausências e aniversários e a publicar o recado.
- **Testes no banco real, dentro de transação com ROLLBACK:**
  - coordenador e admin editam;
  - designer não edita;
  - coordenador com Roteiros em "Ver" é recusado;
  - designer com "Clientes: Editar" dado na conta passa a editar;
  - a alteração recusada retorna erro 42501 em vez de 0 linhas.
  - Também conferi o nível de WhatsApp, Agenda da equipe e Lixeira de cada pessoa da equipe.

### Telas
- **Configurações → Administração → Funções e permissões** (nova):
  - **Por função:** a matriz módulo × função, com um ponto nos casos em que, para designer e videomaker, o nível vale só para o trabalho deles;
  - **Por pessoa:** o que vale para cada um hoje, com contorno onde a pessoa tem exceção; tocar no nome abre a conta;
  - **Como os níveis funcionam.**
- O menu e as rotas usam os módulos novos. O WhatsApp sai das "rotas de todo mundo", e a Lixeira deixa de ser fixa do admin.
- **Agenda e recado da equipe:** quem tem Editar vê "Ausências e aniversários" nas Configurações, com o recado.
- **Correção:** salvar uma conta dentro das Configurações não tira mais a pessoa das Configurações (vários `abrir()` viraram `reabrir()`).
- O que já existia continua: aviso de nível nas telas com "Pedir mais acesso", e botões de criar, excluir e aprovar escondidos por nível.

## Outros
Ajuda da administração (Funções e módulos, com a cópia da IA regenerada). VERSAO `2026-10-22-zzz249`, CACHE `roteiros-b7-v451`, novidade `v-zzz249`.
