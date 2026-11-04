# Relatório — Referências da linha editorial vão para a gravação

**Versão:** `2026-10-16-zzz205` · **Cache:** `roteiros-b7-v408`
**Pedido (Kevin):** "se for colocado um link de referência apenas na linha editorial, ele tem que ir pra gravação, e a pessoa tem que selecionar se é apenas edição ou se é gravação também." Se o link mudar, volta a "decidir"; a referência geral da linha entra como "referência do mês".
Esta é a **etapa 1a** do plano de Trends/Referências/Preparação de gravação (dia fixo de gravar, checklist e trends etiquetadas vêm nas próximas etapas).

## O que mudou
- **Gravação:** nova seção "Referências da linha editorial" (some quando não há nenhuma). Mostra, da linha do **mês da gravação** (mês de produção; sem ele, o mês da data; sem data, a linha mais recente do cliente): o link de cada conteúdo (`referencia_link`) e cada link do campo "Referências do mês" da linha. Cada um tem **Só edição** / **Edição e gravação**. Pendentes aparecem primeiro, em destaque, com o aviso "N para decidir"; sem pendência, "Tudo decidido".
- **Linha editorial (conteúdo Reel):** abaixo do campo do link, a mesma escolha, ao vivo ("falta escolher…").
- **Regra do link:** a escolha vale para aquele link exato. Trocou o link → a escolha antiga não vale mais e volta a "decidir".
- **Conteúdo já "Só edição" (produção):** a referência já nasce como "só edição" (marcada como automática); dá para trocar.
- Texto de ajuda no campo "Referências do mês" explicando que os links aparecem na gravação.

## Banco de dados (aplicado no projeto `rartcafydsaocdzshqcx`; arquivo `migration_referencia_uso.sql`)
- Tabela `linha_ref_uso` (linha, conteúdo opcional, link, uso `edicao|gravacao`, quem/quando decidiu), índice único por linha+conteúdo+link, RLS (leitura: admin, coordenador, designer, videomaker). Sem chave estrangeira de propósito (a criação com chave travava o banco por bloqueio de tabelas em uso; sobra de exclusão é inofensiva).
- `ref_uso_decidir(linha, conteudo, link, uso)`: grava/troca a escolha; confere o papel e que o link ainda existe na linha.
- `gravacao_referencias_linha(gravacao)`: devolve as referências do mês com a escolha (RLS de quem chama).
- Nada foi apagado nem alterado nos dados existentes.

## Arquivos
`js/gravacao.js`, `js/linha.js`, `js/database.js`, `js/novidades.js`, `styles/gravacao.css`, `styles/editor.css`, `js/auth.js`, `sw.js`, `migration_referencia_uso.sql`.

## Testes
Sintaxe (`node --check`). No banco, dentro de uma transação desfeita: com um link de conteúdo e um link da linha de teste, `gravacao_referencias_linha` devolveu as duas referências (origem, título, link, sem escolha); linha de texto sem http foi ignorada; conferido que nada ficou gravado. Hoje só existe 1 link de conteúdo em outubro (Águas Mucugê, que não tem gravação), então as gravações atuais ainda não mostram a seção. A parte visual não foi testada logada aqui: conferir pondo um link num Reel de um cliente com gravação.
