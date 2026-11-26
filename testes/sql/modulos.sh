#!/usr/bin/env bash
# Testa a zzz393 (desligar módulo para a agência inteira) num Postgres 16 local.
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=/usr/lib/postgresql/16/bin; DIR=$(mktemp -d); PORTA=55438
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; SU="su postgres -s /bin/bash -c"; else SU="bash -c"; fi
trap '$SU "$BIN/pg_ctl -D $DIR/d -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
$SU "$BIN/initdb -D $DIR/d -A trust -U postgres >/dev/null"
$SU "$BIN/pg_ctl -D $DIR/d -o '-p $PORTA -k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
P() { PGOPTIONS=--client-min-messages=warning psql -h "$DIR" -p $PORTA -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
P -f testes/sql/esbocos-modulos.sql
P -f supabase/sql/zzz393_modulos_desligados.sql >/dev/null
P -f supabase/sql/zzz393_modulos_desligados.sql >/dev/null   # idempotente
P -f testes/sql/modulos.test.sql
echo "OK: zzz393 passou (aplicada 2×)"
