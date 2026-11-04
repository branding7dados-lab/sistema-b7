# zzz302 — Gestão → Equipe, Usuários em 3 grupos e Funções mais arejadas

Tudo aqui é só do administrador.

## 1. Gestão → Equipe (novo)
- Aba **Equipe** na Gestão (`js/colaboradores.js`), com leitura única no banco: `gestao_colaboradores(p_de, p_ate)`. A função é security definer e confere `sou_admin()`.
- **Período:** este mês, mês passado, últimos 30 dias ou esta semana. Atrasos e fila contam o que está aberto hoje.
- **Números da equipe:** entregas no período (vídeo + design), % de vídeos entregues até o prazo, atrasados agora e trabalho sem responsável.
- **Um cartão por pessoa** (Colaboradores × Parceiros B7 × Todos):
  - Mostra: entregas, pontualidade, barra das últimas 8 semanas, atrasados, itens que pedem atenção, na mão, com o cliente, ajustes pedidos, gravações e itens gravados.
  - Situação da pessoa:
    - **Com atraso:** tem prazo vencido.
    - **Pede atenção:** algo vence em até 2 dias, parado há mais de 7 dias ou em standby.
    - **Em dia** ou **Sem fila** nos outros casos.
- **Detalhe da pessoa:** "O que precisa" em frases curtas, a lista do que pede atenção e da fila (cada item abre o vídeo ou a peça) e as próximas gravações.
- Atalho em Usuários: menu ⋯ → **Ver entregas** abre `#/gestao?aba=equipe&p=<id>`.
- Fontes: `demandas_edicao` (entregue_em, prazo, editing_status), `demandas_edicao_eventos` (correção = ajuste), `design_deliverables` (finalizado_em, status, updated_at), `design_versoes` (ajuste_solicitado), `gravacoes` (concluida_em/gravada_em) e `gravacao_itens` (gravado_por). Clientes de teste ficam de fora.
- Design quase não tem prazo cadastrado. Por isso, para design, conta "parado há mais de 7 dias" em vez de atraso.

## 2. Usuários e acessos
- Três grupos no alto: **Parceiros B7** (freelancers e parceiros de fora), **Colaboradores** (equipe interna, administradores incluídos) e **Clientes**. Cada um tem ícone e contagem.
- Marcar alguém como Parceiro B7: menu ⋯ → **Marcar como Parceiro B7** (ou **Mover para Colaboradores**). Grava em `perfis.parceiro` pela função `perfil_parceiro_definir`, que só o administrador pode chamar.
- Saíram os 6 quadradinhos de números. Os filtros finos (online, pedem atenção, acesso personalizado, desativadas) aparecem só quando têm alguém. Desativadas ficam recolhidas no fim.
- Cabeçalho mais limpo no celular: Histórico e Funções viraram ícones, e Novo usuário ocupa o resto.

## 3. Funções e permissões
- "Quem abre o quê": uma função (ou uma pessoa) por vez, módulo a módulo, em cartões. Some a tabela larga que cortava a coluna Videomaker no celular.
- "O que cada um pode fazer": uma função por vez, com interruptor em cada ação. Os botões, as regras e a gravação são os mesmos.

## Banco
- `migration_gestao_colaboradores.sql` (aplicada).

## Conferido
- Função testada com o perfil do administrador; números reais conferidos (ex.: 20 peças paradas há 11 dias, 1 vídeo atrasado há 11 dias).
- `testes/colaboradores.test.mjs` (8 checagens); `npm test` completo.
- Prints em celular e PC das três telas.
