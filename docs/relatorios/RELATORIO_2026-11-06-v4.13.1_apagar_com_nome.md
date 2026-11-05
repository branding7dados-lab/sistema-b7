# v4.13.1 — Apagar pede o nome

- `B7.UI.confirmar({ digitar })`: o botão só libera com o nome digitado (sem diferença de maiúsculas/espaços).
- Aplicado em: apagar roteiro (editor), mandar gravação para a lixeira, excluir linha editorial, excluir para sempre na Lixeira. Cliente já pedia o nome.
- Banco (PENDENTE — a aprovação no Supabase expirou): `supabase/sql/migration_proteger_roteiros.sql` impede apagar de vez gravação com roteiros vivos e deixa os conteúdos quando a linha editorial é apagada.
