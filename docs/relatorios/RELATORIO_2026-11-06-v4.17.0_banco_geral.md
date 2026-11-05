# v4.17.0 — Banco geral de roteiros (sem cliente e sem gravação)

- Banco: `roteiros.client_id` já aceitava vazio (4.15.0); roteiro com cliente e gravação vazios = Banco geral. Regras de acesso não mudam (equipe/design leem; cliente e portal não têm acesso a roteiros).
- Editor: `#/gravacao/banco-geral/roteiros` (cabeçalho "Banco geral · Sem cliente"); `?ia=novo` cria um roteiro novo ao abrir.
- Roteiros (`#/roteiros`): botão "Novo roteiro"; `roteirosRecentes` traz roteiros sem gravação agrupados como "Banco geral" ou "Banco de roteiros" do cliente.
- "Mover para…" e "Duplicar para…": Banco geral, banco do cliente atual, gravação do cliente atual, ou outro cliente (banco ou gravação). `B7.DB.duplicarRoteiroPara` copia roteiro + cenas.
- Rota `#/gravacao/banco-*` sempre vai para o editor (antes um link de grupo podia cair na tela de gravação).
- Testado com dados simulados: abrir o banco geral, mover para outro cliente (destino correto), lista de Roteiros com os dois bancos.

## 4.17.1
- Voltar no editor do banco: banco geral → Roteiros; banco do cliente → aba Gravações do cliente (antes ia para #/gravacao/banco-…, que reabria o editor: preso).
- Barra lateral marca "Roteiros" no banco de roteiros (antes "Gravações").
