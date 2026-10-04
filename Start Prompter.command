#!/bin/zsh
set -e
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:$HOME/.local/bin:/usr/local/bin:$PATH"
trap 'print "Startup failed. See the message above."; read "?Press Return to close."' ZERR
if ! command -v uv >/dev/null || ! command -v node >/dev/null; then
  print 'Install uv and Node.js, then open Start Prompter again. See README.md.'
  read '?Press Return to close.'
  exit 1
fi
export UV_CACHE_DIR="$PWD/.runtime/uv-cache"
mkdir -p .runtime
uv sync --locked --inexact --extra speech --offline || uv sync --locked --inexact --extra speech
if [[ ! -d web/node_modules ]]; then
  npm ci --prefix web --cache "$PWD/.runtime/npm-cache"
fi
npm run build --prefix web
exec .venv/bin/python -m server.launcher
