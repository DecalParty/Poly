#!/bin/bash
set -e

echo "=== Polymarket Bot Deploy ==="

# 1. Setup swap if not already active
if ! swapon --show | grep -q '/swapfile'; then
  echo "[1/4] Setting up 2GB swap..."
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  Swap enabled."
else
  echo "[1/4] Swap already active, skipping."
fi

# 2. Get the directory this script lives in (= the repo root)
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "[2/4] Repo at: $REPO_DIR"
cd "$REPO_DIR"

# 3. Copy .env.local into standalone if it exists
if [ -f "$REPO_DIR/.env.local" ]; then
  cp "$REPO_DIR/.env.local" "$REPO_DIR/.next/standalone/.env.local"
  echo "[3/4] Copied .env.local into standalone."
elif [ -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env" "$REPO_DIR/.next/standalone/.env.local"
  echo "[3/4] Copied .env into standalone as .env.local."
else
  echo "[3/4] WARNING: No .env.local found. Bot may not work without API keys."
fi

# 4. Kill old process and start
echo "[4/4] Starting bot..."
pkill -f "node.*server.js" 2>/dev/null || true
sleep 1

cd "$REPO_DIR/.next/standalone"
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
