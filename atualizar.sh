#!/usr/bin/env bash
# Atualiza o Diário da Sarah na VPS: puxa o código, rebuilda, sobe e confere.
# Uso:  cd /docker/apps/diario && ./atualizar.sh
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$REPO_DIR/deploy"
VERMELHO=$'\033[1;31m'; VERDE=$'\033[1;32m'; AMARELO=$'\033[1;33m'; FIM=$'\033[0m'

if [ ! -f "$DEPLOY_DIR/.env" ]; then
  echo "${VERMELHO}Falta deploy/.env. Copie deploy/.env.example e preencha (veja deploy/README.md).${FIM}"
  exit 1
fi

echo "==> [1/4] Puxando o código mais recente..."
cd "$REPO_DIR" && git pull --ff-only

echo "==> [2/4] Build e subida dos containers..."
cd "$DEPLOY_DIR" && docker compose --env-file .env up -d --build

echo "==> [3/4] Aguardando a API do PocketBase..."
set +e
ok=0
for i in $(seq 1 30); do
  if docker compose exec -T pocketbase wget -q -T 3 -O /dev/null http://127.0.0.1:8090/api/health </dev/null 2>/dev/null; then
    ok=1; break
  fi
  sleep 2
done

echo "==> [4/4] Conferindo..."
if [ "$ok" != "1" ]; then
  echo "${VERMELHO}A API não respondeu. Últimas linhas do log:${FIM}"
  docker compose logs --tail 40 pocketbase
  exit 1
fi
docker compose logs pocketbase 2>&1 | grep '\[configuracao\]' | tail -1
if docker compose logs pocketbase 2>&1 | grep '\[configuracao\]' | tail -1 | grep -q desligado; then
  echo "${AMARELO}Atenção: SMTP desligado. Sem ele os códigos de login não chegam (preencha SMTP_* no deploy/.env).${FIM}"
fi
for i in $(seq 1 20); do
  docker compose logs notificador 2>&1 | grep -q 'pronto; ciclo' && break
  sleep 2
done
if docker compose logs notificador 2>&1 | grep -q 'pronto; ciclo'; then
  echo "[notificador] notificações ligadas"
else
  echo "${AMARELO}Atenção: o notificador ainda não respondeu (docker compose logs notificador).${FIM}"
fi
echo "${VERDE}Pronto! Diário no ar.${FIM}"
