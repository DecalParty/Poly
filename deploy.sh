#!/bin/bash
set -e

echo "=== Polymarket Bot Deploy ==="

# 1. Setup swap if not already active
if ! swapon --show | grep -q '/swapfile'; then
  echo "[1/5] Setting up 2GB swap..."
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  Swap enabled."
else
  echo "[1/5] Swap already active, skipping."
fi

# 2. Get the directory this script lives in (= the repo root)
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
STANDALONE="$REPO_DIR/.next/standalone"
echo "[2/5] Repo at: $REPO_DIR"
cd "$REPO_DIR"

# 3. Ensure .env.local exists
if [ -f "$REPO_DIR/.env.local" ]; then
  echo "[3/5] Found .env.local"
elif [ -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env" "$REPO_DIR/.env.local"
  echo "[3/5] Copied .env to .env.local"
else
  echo "[3/5] WARNING: No .env.local found at $REPO_DIR/.env.local"
  echo "       Bot may not work without API keys."
  echo "       Create one based on .env.example"
fi

# 4. Link .env.local and data/ into standalone dir
#    (standalone server.js does process.chdir(__dirname) so process.cwd() = standalone dir)
echo "[4/5] Linking config and data into standalone..."
mkdir -p "$REPO_DIR/data"

# Symlink .env.local so the standalone server can read it
ln -sf "$REPO_DIR/.env.local" "$STANDALONE/.env.local" 2>/dev/null || cp -f "$REPO_DIR/.env.local" "$STANDALONE/.env.local"

# Symlink data/ so the database persists at repo root
ln -sfn "$REPO_DIR/data" "$STANDALONE/data" 2>/dev/null || true

# Ensure sql.js WASM binary exists (not included by Next.js standalone tracing)
WASM_DEST="$STANDALONE/node_modules/sql.js/dist/sql-wasm.wasm"
if [ ! -f "$WASM_DEST" ]; then
  mkdir -p "$STANDALONE/node_modules/sql.js/dist"
  # Try copying from local node_modules first
  if [ -f "$REPO_DIR/node_modules/sql.js/dist/sql-wasm.wasm" ]; then
    cp "$REPO_DIR/node_modules/sql.js/dist/sql-wasm.wasm" "$WASM_DEST"
    echo "  sql-wasm.wasm -> copied from node_modules"
  else
    # Download directly from npm as fallback
    curl -sL "https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm" -o "$WASM_DEST"
    echo "  sql-wasm.wasm -> downloaded"
  fi
else
  echo "  sql-wasm.wasm -> exists"
fi

echo "  .env.local -> linked"
echo "  data/      -> linked"

# 5. Kill old process and start
echo "[5/5] Starting bot..."
pkill -f "node.*server.js" 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
sleep 2

cd "$STANDALONE"
PORT=${PORT:-3000} nohup node server.js > "$REPO_DIR/bot.log" 2>&1 &

sleep 2
if pgrep -f "node.*server.js" > /dev/null; then
  echo ""
  echo "=== BOT IS RUNNING ==="
  echo "  PID: $(pgrep -f 'node.*server.js')"
  echo "  Log: $REPO_DIR/bot.log"
  echo "  URL: http://$(hostname -I | awk '{print $1}'):3000"
  echo ""
  echo "  View logs:  tail -f $REPO_DIR/bot.log"
  echo "  Stop bot:   pkill -f 'node.*server.js'"
else
  echo ""
  echo "=== FAILED TO START ==="
  echo "Last 20 lines of log:"
  tail -20 "$REPO_DIR/bot.log" 2>/dev/null || echo "(no log output)"
fi
