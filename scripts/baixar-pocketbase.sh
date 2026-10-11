#!/usr/bin/env bash
# Baixa o PocketBase usado nos testes de permissão (mesma versão do Skip Cloud).
set -euo pipefail
VERSAO="${POCKETBASE_VERSION:-0.36.0}"
DESTINO="$(cd "$(dirname "$0")/.." && pwd)/.pocketbase"
case "$(uname -m)" in
  x86_64) ARQ=amd64 ;;
  aarch64 | arm64) ARQ=arm64 ;;
  *) echo "Arquitetura não suportada: $(uname -m)" >&2; exit 1 ;;
esac
SO="$(uname -s | tr '[:upper:]' '[:lower:]')"
mkdir -p "$DESTINO"
curl -sSL -o "$DESTINO/pb.zip" \
  "https://github.com/pocketbase/pocketbase/releases/download/v${VERSAO}/pocketbase_${VERSAO}_${SO}_${ARQ}.zip"
unzip -o -q "$DESTINO/pb.zip" pocketbase -d "$DESTINO"
rm "$DESTINO/pb.zip"
"$DESTINO/pocketbase" --version
