#!/usr/bin/env bash
# Testa a migração zzz383 (vários números de WhatsApp) num Postgres 16 local e descartável.
# Uso: bash testes/sql/wa-numeros.sh   (precisa de /usr/lib/postgresql/16/bin; não entra no npm test)
set -euo pipefail
cd "$(dirname "$0")/../.."
BIN=/usr/lib/postgresql/16/bin
DIR=$(mktemp -d); PORTA=55432
trap '$SU "$BIN/pg_ctl -D $DIR/d -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; SU="su postgres -s /bin/bash -c"; else SU="bash -c"; fi
$SU "$BIN/initdb -D $DIR/d -A trust -U postgres >/dev/null"
$SU "$BIN/pg_ctl -D $DIR/d -o '-p $PORTA -k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
P() { PGOPTIONS=--client-min-messages=warning psql -h "$DIR" -p $PORTA -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }
P -f testes/sql/esbocos.sql
for f in zzz340_wa_conversas zzz341_wa_contatos_midia zzz348_wa_unir_lid zzz373_quem_espera_quem zzz374_vez_por_contexto zzz375_renomear_conversa zzz380_vez_assunto; do
  P -f supabase/sql/$f.sql >/dev/null
done
# dados de antes da migração (ficam no número padrão)
P -c "insert into wa_conversas (jid, tipo, nome, nao_lidas) values ('1@g.us','grupo','Grupo antigo', 3), ('5511999@s.whatsapp.net','contato','Ana', 1);
      insert into wa_mensagens (id, jid, texto) values ('ANTIGA', '1@g.us', 'oi');"
P -f supabase/sql/zzz383_wa_varios_numeros.sql >/dev/null
P -f supabase/sql/zzz383_wa_varios_numeros.sql >/dev/null   # idempotente
P -f supabase/sql/zzz385_wa_grupo_membros.sql >/dev/null
P -f supabase/sql/zzz385_wa_grupo_membros.sql >/dev/null   # idempotente
P -f testes/sql/wa-numeros.test.sql
echo "OK: zzz383 passou (aplicada 2×)"
