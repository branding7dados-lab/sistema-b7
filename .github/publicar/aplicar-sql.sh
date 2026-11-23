#!/usr/bin/env bash
# Aplica migrações do B7 (supabase/sql/zzzNNN_*.sql) no banco, em ordem de número, uma vez só cada:
#   • confere em public.b7_migracoes se já rodou (se a tabela ainda não existe, nada rodou por aqui);
#   • aplica pela API de gestão do Supabase (SUPABASE_ACCESS_TOKEN + PROJETO);
#   • registra; no primeiro erro, para e falha (as seguintes não rodam).
# Uso: aplicar-sql.sh arquivo1.sql arquivo2.sql …   (o sql.yml passa os arquivos NOVOS do merge)
# Teste local: B7_SQL_LOCAL="<conexão psql>" (testes/sql/aplicar.sh)
set -euo pipefail
VERSAO="${GITHUB_SHA:-local}"

consulta() {   # $1 = arquivo com o SQL; imprime a resposta
  if [ -n "${B7_SQL_LOCAL:-}" ]; then
    PGOPTIONS=--client-min-messages=warning psql "$B7_SQL_LOCAL" -tAq -v ON_ERROR_STOP=1 -f "$1"
    return
  fi
  local corpo resp codigo
  corpo=$(mktemp); resp=$(mktemp)
  python3 -c "import json,sys; print(json.dumps({'query': open(sys.argv[1]).read()}))" "$1" > "$corpo"
  codigo=$(curl -sS -o "$resp" -w '%{http_code}' -X POST "https://api.supabase.com/v1/projects/$PROJETO/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data @"$corpo")
  cat "$resp"
  case "$codigo" in 2*) ;; *) echo; echo "HTTP $codigo" >&2; return 1;; esac
}
sql() { local f; f=$(mktemp); printf '%s' "$1" > "$f"; consulta "$f"; }

# só nomes no padrão (o nome entra numa consulta), em ordem de número
lista=()
for a in "$@"; do
  if ! printf '%s' "$a" | grep -Eq '^supabase/sql/zzz[0-9]{3,4}_[a-z0-9_]+\.sql$'; then echo "::error::arquivo fora do padrão: $a"; exit 1; fi
  [ -f "$a" ] || { echo "::error::arquivo não existe: $a"; exit 1; }
  lista+=("$a")
done
[ ${#lista[@]} -eq 0 ] && { echo "Nenhuma migração nova."; exit 0; }
mapfile -t lista < <(printf '%s\n' "${lista[@]}" | sort -t_ -k1,1V -u)

for a in "${lista[@]}"; do
  nome=$(basename "$a")
  tem=$(sql "select (to_regclass('public.b7_migracoes') is not null)::int as t;" || echo ERRO)
  if printf '%s' "$tem" | grep -q ERRO; then echo "::error::não consegui falar com o banco"; exit 1; fi
  ja=0
  if printf '%s' "$tem" | grep -Eq '(^|[^0-9])1([^0-9]|$)'; then ja=$(sql "select count(*) as n from public.b7_migracoes where arquivo = '$nome';" || echo ERRO); fi
  if printf '%s' "$ja" | grep -Eq '(^|[^0-9])1([^0-9]|$)'; then echo "↷ $nome já aplicada — pulando"; continue; fi
  if printf '%s' "$ja" | grep -q ERRO; then echo "::error::não consegui conferir $nome no banco"; exit 1; fi
  echo "▶ aplicando $nome"
  if ! consulta "$a"; then echo "::error::$nome falhou — as migrações seguintes não foram aplicadas"; exit 1; fi
  sql "insert into public.b7_migracoes (arquivo, versao) values ('$nome', '${VERSAO:0:40}') on conflict (arquivo) do nothing;" >/dev/null
  echo "✓ $nome"
done
