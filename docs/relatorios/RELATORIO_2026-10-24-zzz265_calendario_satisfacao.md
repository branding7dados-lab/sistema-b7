# zzz265 — Portal: calendário e pesquisa de satisfação

## Calendário (`js/portal-calendario.js`, rota `#/meu-calendario` do cliente)
- Lê `portal_producao` (data_postagem) e `portal_gravacoes` (data_gravacao) — só o que já é liberado ao cliente.
- PC: grade do mês com até 3 itens por dia (+N); celular (≤760px): agenda por dia.
- Miniaturas: `B7.DB.aprovacoesSnapshots(ids)` (id + snapshot) → primeira imagem de `arquivos_efetivos/arquivos` → `urlArquivoDesign` (cache na sessão).
- Item com aprovação abre `#/revisar/<id>`. Classes com prefixo `pcal-` (o `pc-` já existia no painel).

## Satisfação (`migration_satisfacao.sql`, aplicada: satisfacao_1, satisfacao_2)
- `cliente_satisfacao` (uma resposta por pessoa/empresa/mês; leitura só equipe interna).
- `satisfacao_pendente(p_client)` (a partir do dia 20, sem resposta no mês) e `satisfacao_responder(...)` (upsert + aviso à coordenação; ≤6 = "Atenção").
- `js/portal-satisfacao.js`: cartão 0–10 no Início (`#ph-extra`), comentário com frase conforme a nota, agradecimento animado.

## Outros
- Menu do portal, rotas, permissões (+teste), boas-vindas com o item Calendário.
- Prints conferidos: calendário PC e celular; cartão de satisfação PC (nota escolhida) e celular.
