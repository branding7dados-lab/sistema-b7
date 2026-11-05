# v4.12.1 — Revisão pelos registros do servidor

- Logs da API (24 h): só 6 respostas de erro. As 4 de 400 vinham de `videomaker_id=eq.null` no Painel, de um celular Android com versão antiga em cache (o Painel já evitava isso desde a 4.5). Agora `painelDemandasAtivas`/`painelEntregas` também recusam sem usuário, na camada do banco.
- Avisos de segurança do Supabase: nada crítico do sistema. As views `promo1010_*` (de outro site no mesmo projeto) só mostram contagens, sem dados pessoais. Pendente no painel do Supabase: ligar "Leaked password protection" (Auth).
- `_teste_ddl`: o drop foi pedido de novo, mas a confirmação não foi respondida a tempo.
- Medição: o sistema carrega 115 scripts (4,6 MB de JS + 1,7 MB de CSS, sem minificar) na abertura.
