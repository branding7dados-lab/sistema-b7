#!/usr/bin/env bash
# Testa a zzz389 (cadastro do cliente e pacote por cliente) num Postgres 16 local e descartável.
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=/usr/lib/postgresql/16/bin; DIR=$(mktemp -d); PORTA=55436
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; SU="su postgres -s /bin/bash -c"; else SU="bash -c"; fi
trap '$SU "$BIN/pg_ctl -D $DIR/d -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
$SU "$BIN/initdb -D $DIR/d -A trust -U postgres >/dev/null"
$SU "$BIN/pg_ctl -D $DIR/d -o '-p $PORTA -k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
P() { PGOPTIONS=--client-min-messages=warning psql -h "$DIR" -p $PORTA -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
P -f testes/sql/esbocos-cadastro.sql
# _pacote_valido e linha_aplicar_pacote como estão na migração original
awk '/^create or replace function public._pacote_valido/,/^\$\$;/' supabase/sql/migration_pacotes_producao.sql > "$DIR/f.sql"
awk '/^create or replace function public.linha_aplicar_pacote/,/^end \$\$;/' supabase/sql/migration_pacotes_producao.sql >> "$DIR/f.sql"
chmod a+r "$DIR/f.sql"; P -f "$DIR/f.sql"
P -f supabase/sql/zzz389_cadastro_cliente.sql >/dev/null
P -f supabase/sql/zzz389_cadastro_cliente.sql >/dev/null   # idempotente
P -f supabase/sql/zzz390_contrato_duracao.sql >/dev/null
P -f supabase/sql/zzz390_contrato_duracao.sql >/dev/null   # idempotente
P -f supabase/sql/zzz391_n7_clientes.sql >/dev/null
P -f supabase/sql/zzz391_n7_clientes.sql >/dev/null   # idempotente
P -f testes/sql/cadastro.test.sql
echo "OK: zzz389, zzz390 e zzz391 passaram (aplicadas 2×)"
