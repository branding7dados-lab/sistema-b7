#!/usr/bin/env bash
# =====================================================================
#  Instala o Evolution API (WhatsApp) do Sistema B7 nesta máquina.
#  Uso (como root, dentro desta pasta):   bash instalar.sh wa.seudominio.com.br
#
#  O que faz:
#   1. confere o Docker (o Pterodactyl/Wings já usa — não reinstala);
#   2. cria o .env com senha do banco e chave da API ALEATÓRIAS (só na
#      primeira vez; se o .env já existe, mantém);
#   3. sobe Evolution + Postgres + Redis (docker compose);
#   4. publica o endereço com HTTPS no Nginx que já existe (certbot);
#   5. mostra a chave UMA vez, para você colar nos segredos do Supabase.
#  Não mexe no Pterodactyl, no Wings nem nos sites que já estão no Nginx.
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"

DOMINIO="${1:-}"
if [ -z "$DOMINIO" ]; then
  echo "Use: bash instalar.sh wa.seudominio.com.br"
  echo "(antes, aponte esse subdomínio para o IP desta máquina no DNS)"
  exit 1
fi
[ "$(id -u)" = "0" ] || { echo "Rode como root (sudo -i)."; exit 1; }

echo "== 1/5 Docker"
command -v docker >/dev/null || { echo "Docker não encontrado. Esta é mesmo a máquina do Wings?"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Falta o plugin 'docker compose'. Instale: apt-get install -y docker-compose-plugin"; exit 1; }

echo "== 2/5 Configuração (.env)"
if [ -f .env ]; then
  echo ".env já existe — mantido (a chave continua a mesma)."
else
  CHAVE="$(openssl rand -hex 24)"
  SENHA_PG="$(openssl rand -hex 18)"
  cat > .env <<EOF
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=https://${DOMINIO}
LANGUAGE=pt-BR
LOG_LEVEL=ERROR,WARN,INFO
DEL_INSTANCE=false
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true

AUTHENTICATION_API_KEY=${CHAVE}
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false

POSTGRES_PASSWORD=${SENHA_PG}
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:${SENHA_PG}@postgres:5432/evolution?schema=evolution_api
DATABASE_CONNECTION_CLIENT_NAME=b7_evolution
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_LABELS=true
DATABASE_SAVE_DATA_HISTORIC=true

CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/6
CACHE_REDIS_PREFIX_KEY=b7evo
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false

CONFIG_SESSION_PHONE_CLIENT=Sistema B7
CONFIG_SESSION_PHONE_NAME=Chrome
QRCODE_LIMIT=30

# O B7 liga o webhook (mensagens chegando) na próxima etapa.
WEBHOOK_GLOBAL_ENABLED=false
EOF
  chmod 600 .env
  echo ".env criado."
fi

echo "== 3/5 Subindo o Evolution"
docker compose pull
docker compose up -d
for i in $(seq 1 30); do
  curl -fsS -o /dev/null http://127.0.0.1:8095/ && break
  sleep 2
done
curl -fsS -o /dev/null http://127.0.0.1:8095/ && echo "Evolution respondendo em 127.0.0.1:8095." || { echo "O Evolution não respondeu. Veja: docker compose logs api --tail 80"; exit 1; }

echo "== 4/5 HTTPS no Nginx"
if command -v nginx >/dev/null; then
  if [ -d /etc/nginx/sites-available ]; then CONF=/etc/nginx/sites-available/b7-evolution.conf; else CONF=/etc/nginx/conf.d/b7-evolution.conf; fi
  cat > "$CONF" <<EOF
# Evolution API do Sistema B7 (criado por servidor/evolution/instalar.sh)
server {
    listen 80;
    server_name ${DOMINIO};
    client_max_body_size 100m;
    location / {
        proxy_pass http://127.0.0.1:8095;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
EOF
  [ -d /etc/nginx/sites-enabled ] && ln -sf "$CONF" /etc/nginx/sites-enabled/b7-evolution.conf
  nginx -t && systemctl reload nginx
  if command -v certbot >/dev/null; then
    certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos --register-unsafely-without-email --redirect || \
      echo "O certbot não conseguiu o certificado. Confira se o DNS de ${DOMINIO} já aponta para esta máquina e rode de novo."
  else
    echo "Sem certbot: instale (apt-get install -y certbot python3-certbot-nginx) e rode este script de novo."
  fi
else
  echo "Nginx não encontrado nesta máquina — me avise que eu mando outro jeito de publicar com HTTPS."
fi

echo "== 5/5 Pronto"
CHAVE_ATUAL="$(grep '^AUTHENTICATION_API_KEY=' .env | cut -d= -f2-)"
echo
echo "Cole estes DOIS segredos no Supabase (Edge Functions → Secrets):"
echo "   EVOLUTION_URL      = https://${DOMINIO}"
echo "   EVOLUTION_API_KEY  = ${CHAVE_ATUAL}"
echo
echo "NÃO mande a chave no chat. Depois de colar, avise o Claude: ele cria a"
echo "conexão do número e mostra o QR Code dentro do B7."
