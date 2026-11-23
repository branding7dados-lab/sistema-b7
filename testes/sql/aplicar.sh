#!/usr/bin/env bash
# Testa .github/publicar/aplicar-sql.sh (o que aplica as migrações novas no merge) num Postgres 16 local.
# Confere: aplica em ordem, registra em b7_migracoes, não aplica de novo, para no primeiro erro.
# Uso: bash testes/sql/aplicar.sh   (não entra no npm test)
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=/usr/lib/postgresql/16/bin; DIR=$(mktemp -d); PORTA=55433
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; SU="su postgres -s /bin/bash -c"; else SU="bash -c"; fi
trap '$SU "$BIN/pg_ctl -D $DIR/d -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
$SU "$BIN/initdb -D $DIR/d -A trust -U postgres >/dev/null"
$SU "$BIN/pg_ctl -D $DIR/d -o '-p $PORTA -k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
export B7_SQL_LOCAL="host=$DIR port=$PORTA user=postgres dbname=postgres"
P() { PGOPTIONS=--client-min-messages=warning psql "$B7_SQL_LOCAL" -tAq -v ON_ERROR_STOP=1 -c "$1"; }
P "create role anon; create role authenticated;"
T=$(mktemp -d); mkdir -p "$T/supabase/sql"
cp supabase/sql/zzz384_registro_migracoes.sql "$T/supabase/sql/"
echo "create table if not exists t1 (n int); insert into t1 values (1);" > "$T/supabase/sql/zzz901_teste_um.sql"
echo "insert into t1 values (2);" > "$T/supabase/sql/zzz902_teste_dois.sql"
echo "isto não é sql;" > "$T/supabase/sql/zzz903_teste_quebrado.sql"
echo "insert into t1 values (4);" > "$T/supabase/sql/zzz904_teste_depois.sql"
A="$PWD/.github/publicar/aplicar-sql.sh"
falha() { echo "✗ $1"; exit 1; }
(cd "$T" && bash "$A" supabase/sql/zzz902_teste_dois.sql supabase/sql/zzz384_registro_migracoes.sql supabase/sql/zzz901_teste_um.sql)
[ "$(P "select string_agg(n::text, ',' order by n) from t1")" = "1,2" ] || falha "aplica em ordem de número"
[ "$(P 'select count(*) from b7_migracoes')" = "4" ] || falha "registra as aplicadas (zzz383 + 3)"
(cd "$T" && bash "$A" supabase/sql/zzz901_teste_um.sql supabase/sql/zzz902_teste_dois.sql) >/dev/null
[ "$(P 'select count(*) from t1')" = "2" ] || falha "não aplica de novo o que já foi"
if (cd "$T" && bash "$A" supabase/sql/zzz903_teste_quebrado.sql supabase/sql/zzz904_teste_depois.sql) >/dev/null 2>&1; then falha "erro na migração faz o passo falhar"; fi
[ "$(P 'select count(*) from t1 where n = 4')" = "0" ] || falha "para no primeiro erro"
[ "$(P "select count(*) from b7_migracoes where arquivo = 'zzz903_teste_quebrado.sql'")" = "0" ] || falha "a quebrada não fica registrada"
if (cd "$T" && bash "$A" "supabase/sql/zzz9_x';drop table t1;--.sql") >/dev/null 2>&1; then falha "nome fora do padrão é recusado"; fi
[ "$(P 'select count(*) from t1')" = "2" ] || falha "nome estranho não roda nada"
echo "✓ aplicar-sql: ordem, registro, sem repetir, para no erro, nome inválido recusado"
