#!/usr/bin/env bash
# Testa a zzz387 (usuário Financeiro) num Postgres 16 local, com esboços das funções de Pessoas e do WhatsApp.
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=/usr/lib/postgresql/16/bin; DIR=$(mktemp -d); PORTA=55434
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; SU="su postgres -s /bin/bash -c"; else SU="bash -c"; fi
trap '$SU "$BIN/pg_ctl -D $DIR/d -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
$SU "$BIN/initdb -D $DIR/d -A trust -U postgres >/dev/null"
$SU "$BIN/pg_ctl -D $DIR/d -o '-p $PORTA -k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
P() { PGOPTIONS=--client-min-messages=warning psql -h "$DIR" -p $PORTA -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
P -f testes/sql/esbocos.sql
for f in zzz340_wa_conversas zzz341_wa_contatos_midia zzz348_wa_unir_lid zzz373_quem_espera_quem zzz374_vez_por_contexto zzz375_renomear_conversa zzz380_vez_assunto zzz383_wa_varios_numeros; do P -f supabase/sql/$f.sql >/dev/null; done
P -f testes/sql/esbocos-financeiro.sql
P -f supabase/sql/zzz387_financeiro.sql >/dev/null
P -f supabase/sql/zzz387_financeiro.sql >/dev/null   # idempotente
P -f testes/sql/financeiro.test.sql
echo "OK: zzz387 passou (aplicada 2×)"
