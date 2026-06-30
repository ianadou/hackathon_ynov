#!/usr/bin/env bash
# Lance l'interface Phi Finance Chat en une commande.
#
#   ./run.sh
#
# Pour pointer le proxy vers le serveur d'inférence de l'équipe INFRA
# (autre machine / port) :
#   OLLAMA_URL=http://192.168.1.42:11434 ./run.sh
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm introuvable. Installe Node.js 18+ : https://nodejs.org" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 Installation des dépendances (une seule fois)…"
  npm install
fi

echo "🚀 Phi Finance Chat → http://localhost:5173"
echo "   Proxy d'inférence : ${OLLAMA_URL:-http://localhost:11434}"
npm run dev
