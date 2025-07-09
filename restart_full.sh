#!/bin/bash

echo "Stopping and removing existing Docker container..."
docker stop serverdeck-container && docker rm serverdeck-container

echo "Building new Docker image..."
docker build -t serverdeck-app .

echo "Starting new Docker container..."
# メインのconfigディレクトリと、ホストの.sshディレクトリをマウントします
docker run -d -p 5001:5001 \
  -v /Users/nekoy/ServerDeck/config:/app/config \
  -v /Users/nekoy/.ssh:/root/.ssh:ro \
  --name serverdeck-container serverdeck-app

echo "ServerDeck application restarted with new image. Access at http://127.0.0.1:5001/"