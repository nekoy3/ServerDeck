#!/bin/bash

echo "=== ServerDeck Quick Restart (with cache) ==="

echo "1. Stopping and removing existing Docker container..."
docker stop serverdeck-container 2>/dev/null && docker rm serverdeck-container 2>/dev/null

echo "2. Building new Docker image (using cache)..."
docker build -t serverdeck-app .

echo "3. Starting new Docker container..."
# メインのconfigディレクトリと、ホストの.sshディレクトリをマウントします
docker run -d -p 5001:5001 \
  -v /Users/nekoy/ServerDeck/config:/app/config \
  -v /Users/nekoy/.ssh:/root/.ssh:ro \
  --name serverdeck-container serverdeck-app

echo "=== ServerDeck application restarted (quick) ==="
echo "Access at http://127.0.0.1:5001/"
echo ""
echo "For full cache cleanup, use: ./restart_full.sh"
