# Publicação pelo GitHub Actions (site compactado)

- `.github/workflows/site.yml`: a cada push no `main`, monta `_site/` com `.github/publicar/montar.mjs` (só index/HTMLs legais, manifest, sw.js, assets/, js/, styles/), compacta JS/CSS com esbuild (JS/CSS: 5,99 MB → 4,12 MB, sem contar gzip), roda `sintaxe.mjs` + `fumaca.mjs` na versão compactada e só então publica.
- Deixam de ser públicos: docs/, supabase/, testes/, emails/, app-android/, app-desktop/, README/VERSOES.
- Testado localmente: fumaça (todas as telas) e a tela de jogos na versão compactada, sem erros.
- Ativação: Settings → Pages → Source → "GitHub Actions". Até lá, o workflow falha no passo de publicar e o site segue pelo modo antigo.

## Correção (06/11)
- A compactação renomeava `VERSAO` em js/auth.js; site, app de PC e Android leem essa linha para saber da versão nova, então ninguém via atualização ("não foi possível conferir agora"). `montar.mjs` agora não compacta js/auth.js, e o workflow falha se a linha sumir.
