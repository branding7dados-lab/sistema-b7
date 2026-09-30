# Relatório 30/09 (g) — Pendências das fases 3 e 4

## 1. Admin + Designer (e Coordenador + Designer) agora pode ser atribuído
- **Tela Usuários** (`js/usuarios.js`): nova função extra **Designer**. Ela só aparece quando o papel é Administrador ou Coordenador de mídias; nos outros papéis some e é desmarcada.
- **`b7-auth`**: aceita `designer` como função extra só para `admin` e `coordenador`, e descarta em silêncio nos demais papéis, como já fazia com `coordenador`. **Publiquei a versão `2026-09-30-g` (v17).** Testei a regra em 7 combinações:

  | Combinação | Resultado |
  |---|---|
  | admin | ✓ |
  | coordenador | ✓ |
  | coordenador + videomaker + designer | ✓ |
  | admin + coordenador + designer | ✓ |
  | videomaker | descartada |
  | designer (redundante) | descartada |
  | cliente | erro |

- **Por que só esses dois papéis:** Administrador e Coordenador já são "equipe" no banco, ou seja, leem e editam todo o Design. `design_atribuir` e `linha_concluir` já aceitavam os dois como responsável. Num Videomaker, a função exigiria permissões que o papel não tem.
- **Quem pode receber peças** (`B7.DB.listarDesigners`): agora entra também quem tem a função extra. Assim a pessoa aparece como responsável possível na peça, na Linha Editorial e no filtro "Designer" da Produção de Design, o mesmo que os links do Painel usam.
- **Aviso "Nova demanda de Design disponível":** ia só para quem é Designer pelo papel. Agora vai também para quem tem a função extra (migration abaixo).

## 2. "Visualizar como…" no Design e no Vídeo
- **O problema:** o Painel já mostrava o trabalho da pessoa em prévia, mas a Produção de Design ("comigo") e a Edição de vídeo ("minha fila"), abertas a partir dele, filtravam pelo **id do admin**, então apareciam vazias.
- **A correção:** `meuId` de `js/design.js` e `js/video.js` agora usa a pessoa em prévia, a mesma regra do Painel.
- **Segurança:** a prévia continua bloqueando toda escrita (`js/previa-usuario.js`).
- **Testado:** admin vendo o Alissan → KPI "Em criação" 5 = 5 peças na lista. Antes dava 0.

## 3. O que continua como decisão (não é pendência)
- **Escolher a função principal manualmente:** a especificação da fase 4 pediu para não criar essa preferência agora. A ordem fixa (coordenação → vídeo → design) vale para o gráfico inicial, e o seletor do gráfico já lembra a escolha no aparelho.
- **"Vencem hoje" do Design:** no Painel composto conta só o que está nas mãos do designer; no Painel do Designer segue o filtro "Para hoje". A diferença é intencional.

## Banco / migrations
- `migration_funcao_extra_designer.sql` (**aplicada**): troca uma única condição dentro de `design_processar_evento`. O aviso de "Design disponível" passa a incluir `tenho_funcao_extra('designer', p.id)`. O resto da função não muda. A migration é idempotente e para com erro se não encontrar o trecho esperado.
- Nenhuma tabela nova. O check de `perfis_funcoes_extra` já aceitava `designer`.

## Arquivos alterados
- `supabase/functions/b7-auth/index.ts` (publicado)
- `js/usuarios.js`
- `js/database.js` (`listarDesigners`)
- `js/design.js`
- `js/video.js` (`meuId`)
- `migration_funcao_extra_designer.sql`
- `sw.js` (v105)

## Tests (executados)
- Regra de funções extras do `b7-auth`: 7 combinações (tabela acima).
- Função publicada: confirmei pela leitura do Supabase que a versão no ar é a `2026-09-30-g`.
- Migration: confirmei que a condição nova está na função e que ela continua `security definer`.
- Prévia no Design: 5 = 5 (antes 0).
- Regressão: Painel composto (Coordenador + Designer, Designer + Videomaker) sem erro de JS e sintaxe de todos os `js/*.js`.

## Pendências
- **Atribuir de fato:** em Usuários e acessos, marcar "Designer" em quem for receber peças. Hoje ninguém tem essa função extra no banco.
- **Validar com login real** (continua): Kevin (Admin + Coordenador + Videomaker, agora no Painel composto), Mateus e Alissan.
