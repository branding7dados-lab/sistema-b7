# Relatório zzz216 — Usuários, acessos e funções (itens 1, 2, 3, 9, 11 e 12)

Pedido do Kevin: travar a leitura no banco (1), histórico de acessos (2), conferência de acessos (3), pedido de acesso (9), funções personalizadas (11) e função secundária com nível próprio (12).

## 11 — Funções personalizadas
- Em **Funções e acessos** há uma aba **+ Nova função**: nome, "o que faz", **função de base** (Coordenador, Designer ou Videomaker) e o pacote de módulos com nível.
- A **base** decide o Painel e o trabalho que a pessoa pode receber (não mudou a regra de quem recebe trabalho). O **pacote** decide o que ela abre.
- A função aparece na escolha de "Função principal" de cada conta. Dá para renomear, trocar a base e excluir (só quando ninguém a tem como principal).
- Banco: tabela `funcoes_personalizadas`, `perfis.funcao_personalizada`, RPCs `funcao_personalizada_salvar` e `funcao_personalizada_excluir` (só administrador, ficam no histórico).

## 12 — Outras funções com nível próprio
- No editor da conta, bloco **Outras funções**: para cada função, Não / Ver / Editar / Total / **Atua como**.
  - Ver/Editar/Total abrem os módulos daquela função **até esse nível**, sem mudar a função e sem passar a receber trabalho dela.
  - "Atua como" é o "Também atua como" de antes (recebe trabalho e ganha o Painel); só existe para as três funções do sistema.
- Banco: tabela `perfil_funcoes_secundarias`; `nivel_modulo()` passou a somar pacote da função + funções adicionais + secundárias (com teto) e a respeitar a exceção da pessoa.

## 9 — Pedido de acesso
- Equipe: numa tela só "Ver" (ou "Editar") aparece uma faixa no rodapé com **Pedir mais acesso**; numa tela sem acesso, o botão **Pedir acesso a …**. Escolhe o nível e escreve o motivo (opcional).
- Os administradores recebem aviso no sino; em **Usuários e acessos** aparece o bloco **Pedidos de acesso** com Aprovar (podendo dar outro nível) ou Recusar (com motivo opcional). A pessoa recebe aviso com a resposta.
- Banco: tabela `acesso_pedidos` (um pendente por pessoa e módulo), `acesso_pedir`, `acesso_pedido_cancelar`, `acesso_decidir`, `acesso_pedidos_listar`.

## 3 — Conferência de acessos
- Bloco em Usuários e acessos que só aponta (não muda nada): aprovam sem ser da coordenação; podem excluir clientes sem ser da coordenação; contas paradas há 60+ dias ainda com acesso; sem o módulo da própria função; 4+ ajustes manuais; administradores parados há 30+ dias; funções personalizadas sem ninguém. Tocar na pessoa abre o editor dela.

## 2 — Histórico de acessos
- Botão **Histórico** em Usuários e acessos (com filtro por pessoa) e **Histórico de acesso** no menu "⋯" de cada conta.
- Mostra quem mudou, quando, e o antes → depois (função, administrador, estado da conta, outras funções e o nível de cada módulo), mudanças de padrão de função, pedidos aprovados/recusados e funções criadas/excluídas.
- O `b7-auth` (publicado) passou a guardar a foto do acesso antes e depois em cada alteração. Mudanças antigas aparecem com o resumo que já existia.

## 1 — Trava de leitura no banco
- Política restritiva `mod_leitura` em 19 tabelas: Vídeo (demandas de edição, versões, comentários, pacotes, meses fechados, importação), Design (peças, versões, arquivos) e Oportunidades (todas as tabelas). Sem o módulo, a pessoa da equipe não lê esses dados nem pelo banco. Administrador e clientes não mudam.
- Ficaram **fora** de propósito (são lidas como contexto por outras telas, travar quebraria telas): Clientes, Gravações, Linhas/Conteúdos, Roteiros, Calendário e Aprovações. Quadro e Status semanal já eram travados antes.
- Leituras feitas por funções do servidor (painéis e resumos) não passam por essa trava.
- Efeito hoje: **designers deixam de ler Oportunidades** (não têm o módulo); no editor de conteúdo da linha, o seletor de oportunidade fica vazio para eles. Nenhum outro perfil atual perde leitura (conferido conta a conta).

## Testes feitos
- Banco (blocos desfeitos no fim, nada ficou gravado): pedido → aviso para 3 administradores → aprovação → nível novo + aviso para a pessoa + histórico; designer não aprova nem lê histórico; função personalizada com pacote próprio; secundária com teto; excluir função em uso recusado; trava de leitura: coordenador sem Vídeo/Oportunidades lê 0, com Design segue lendo; leitura conta a conta de todas as contas ativas.
- `b7-auth` publicado e respondendo.
- Tela local com dados de mentira: pedidos, conferência, editor com outras funções (payload `secundarias` + `perfil_definir_cargos`), criar função nova (payload da RPC), histórico, faixa "só para ver", janela de pedido (payload `acesso_pedir`), tela sem acesso com botão.
- Sintaxe dos JS alterados conferida.

## Não testado
- Com contas reais (nenhum acesso real foi mudado; nenhuma função foi criada em produção).
- Push no celular do aviso de pedido.
- Celular.
