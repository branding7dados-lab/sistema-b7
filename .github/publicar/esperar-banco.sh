#!/usr/bin/env bash
# Antes de publicar o site ou as funções: se este merge trouxe migração nova (supabase/sql/zzzNNN_*.sql),
# espera o workflow "sql" do mesmo commit terminar. Se ele falhou, não publica (o código novo depende do banco novo).
# Precisa de: checkout com fetch-depth: 0, GH_TOKEN, permissão actions: read. Uso: esperar-banco.sh <before> <sha>
set -euo pipefail
ANTES="${1:-}"; SHA="${2:-$GITHUB_SHA}"
if [ -z "$ANTES" ] || [ "$ANTES" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$ANTES^{commit}" 2>/dev/null; then ANTES="$SHA~1"; fi
novas=$(git diff --diff-filter=A --name-only "$ANTES" "$SHA" -- 'supabase/sql/zzz*.sql' || true)
if [ -z "$novas" ]; then echo "Sem migração nova — publica direto."; exit 0; fi
echo "Migrações novas neste merge:"; echo "$novas"
for i in $(seq 1 90); do   # até 15 min
  linha=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow sql.yml --commit "$SHA" --event push --limit 1 --json status,conclusion --jq '.[0] | "\(.status) \(.conclusion)"' 2>/dev/null || true)
  case "$linha" in
    "completed success") echo "✓ banco atualizado — publicando"; exit 0;;
    completed*) echo "::error::a migração do banco falhou ($linha) — nada foi publicado. Veja Actions → sql."; exit 1;;
  esac
  echo "esperando o banco… (${linha:-ainda não começou})"; sleep 10
done
echo "::error::o workflow sql não terminou em 15 min — nada foi publicado"; exit 1
