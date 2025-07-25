#!/bin/bash

echo "=== ServerDeck Full Restart with Cache Cleanup ==="

echo "1. Stopping and removing existing Docker container..."
docker stop serverdeck-container 2>/dev/null && docker rm serverdeck-container 2>/dev/null

echo "2. Cleaning up Docker cache and unused resources..."
# 未使用のイメージ、コンテナ、ネットワーク、ボリュームを削除
docker system prune -f
# ビルドキャッシュをクリア
docker builder prune -f

echo "3. Removing old serverdeck-app images..."
# 古いserverdeck-appイメージを削除（最新以外）
docker images serverdeck-app --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}" | grep -v REPOSITORY | tail -n +2 | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

echo "4. Clearing local caches..."
# Node.js キャッシュをクリア（もしあれば）
rm -rf node_modules/.cache 2>/dev/null || true
# Python キャッシュをクリア
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true

echo "5. Building new Docker image (no cache)..."
docker build --no-cache -t serverdeck-app .

echo "6. Starting new Docker container..."
# メインのconfigディレクトリと、ホストの.sshディレクトリをマウントします
docker run -d -p 5001:5001 \
  -v /Users/nekoy/ServerDeck/config:/app/config \
  -v /Users/nekoy/.ssh:/root/.ssh:ro \
  --name serverdeck-container serverdeck-app

echo "=== ServerDeck application restarted with full cache cleanup ==="
echo "Access at http://127.0.0.1:5001/"
echo ""
echo "Cache cleanup completed:"
echo "  ✅ Docker system cache cleared"
echo "  ✅ Build cache cleared"  
echo "  ✅ Old images removed"
echo "  ✅ Python cache cleared"
echo "  ✅ Fresh build without cache"