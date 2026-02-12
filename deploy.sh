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
echo "[2/5] Repo at: $REPO_DIR"
cd "$REPO_DIR"

# 3. Check .env.local
if [ -f "$REPO_DIR/.env.local" ]; then
  echo "[3/5] Found .env.local"
elif [ -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env" "$REPO_DIR/.env.local"
  echo "[3/5] Copied .env to .env.local"
else
  echo "[3/5] WARNING: No .env.local found. Create one from .env.example"
fi

# 4. Install dependencies and build
echo "[4/5] Installing dependencies and building..."
npm install --production=false
NODE_OPTIONS="--max-old-space-size=512" npm run build

# 5. Kill old process and start
echo "[5/5] Starting bot..."
pkill -f "next start" 2>/dev/null || true
pkill -f "node.*server.js" 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
sleep 2

PORT=${PORT:-3000} nohup npm start > "$REPO_DIR/bot.log" 2>&1 &

sleep 3
if pgrep -f "next start" > /dev/null; then
  echo ""
  echo "=== BOT IS RUNNING ==="
  echo "  Log: $REPO_DIR/bot.log"
  echo "  URL: http://$(hostname -I | awk '{print $1}'):3000"
  echo ""
  echo "  View logs:  tail -f $REPO_DIR/bot.log"
  echo "  Stop bot:   pkill -f 'next start'"
else
  echo ""
  echo "=== FAILED TO START ==="
  echo "Last 20 lines of log:"
  tail -20 "$REPO_DIR/bot.log" 2>/dev/null || echo "(no log output)"
fi
