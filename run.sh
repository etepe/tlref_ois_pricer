#!/usr/bin/env bash
# TLREF OIS Pricer - one-click launcher for macOS / Linux.
# Starts the Vite dev server and opens the app in Chrome.
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js bulunamadi. Lutfen https://nodejs.org/ adresinden kurun."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Bagimliliklar yukleniyor (ilk calismada bir defa)..."
  npm install
fi

URL="http://localhost:5173"
echo "Dev server baslatiliyor: $URL"

(
  sleep 4
  if [ "$(uname)" = "Darwin" ]; then
    open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"
  elif command -v google-chrome >/dev/null 2>&1; then
    google-chrome "$URL" >/dev/null 2>&1 &
  elif command -v chromium >/dev/null 2>&1; then
    chromium "$URL" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  fi
) &

npm run dev
