# v4.4.3: arrumar a casa por dentro

Pedido do Kevin: opção 3, "arrumar a casa por dentro", sem nada visível para a equipe.

## Pasta principal: de 626 arquivos para 19
- **424 relatórios** (`RELATORIO_*.md`) foram para `docs/relatorios/`.
- **165 arquivos SQL** (`migration_*.sql`, `supabase_setup.sql` e `diagnostico_responsavel_2.sql`) foram para `supabase/sql/`.
- **12 documentos** (BOOTSTRAP, IA, PUSH, CENTRAL…) e o PDF da revisão de 04/10 foram para `docs/`.
- **Apagados por serem sobra:** duas capturas de tela de teste (`t_save.png`, `t_m_erro.png`) e dois ZIPs de build de setembro. Continuam no histórico do git.
- `README.md` e `VERSOES.md` passaram a apontar os caminhos novos. O relatório de cada versão agora vai em `docs/relatorios/`.
- O teste de permissões lê as migrações do caminho novo.
- O app Android e o programa do Windows não mudaram: eles já copiavam só `index.html`, `js`, `styles` e `assets`.

## Código sem uso
Foram removidas de `js/database.js` 16 funções que nenhuma tela, teste ou módulo chamava (58 linhas). Antes de remover, foi conferido se `memoria.js` ou `movimento.js` as chamavam pelo nome. As funções:
- `reordenarPilares`, `definirPilarDoConteudo`, `demandasDoMaterial`, `registrarKanban`;
- `designDoConteudo`, `arquivosVersaoDesign`, `versoesDaLinha`;
- `confirmarLinhaImportacaoVideo`, `backfillCompetenciaVideo`, `demandasCompetenciaNaoConfiavelVideo`;
- `backfillResponsavelVideo`, `demandasResponsavelNaoConfiavelVideo`, `comentariosVersaoVideo`;
- `competenciasFechadasVideo`, `gerarDemandaAgrupadaVideo`, `desvincularCalendario`.

As funções do banco que elas chamavam continuam existindo, e nada foi apagado no Supabase.

## Para o Kevin decidir
- **Os relatórios e os SQLs são públicos.** O GitHub Pages publica o repositório inteiro, então qualquer pessoa que souber o endereço abre `…/docs/relatorios/…` ou `…/supabase/sql/…`. Não há senhas neles, mas há detalhes internos do banco. Para fechar isso, é preciso trocar a publicação para "GitHub Actions", publicando só os arquivos do app, em Settings → Pages → Source. Feita a troca, o workflow pode ser criado.
- A tabela `_teste_ddl` no banco é uma sobra de teste. Ela pode ser apagada com autorização.

## Conferência
- `node --check` em todos os JS: nenhum erro.
- `npm test` passou: fumaça de todas as telas, permissões, memória, IA e tempo real.
