#!/bin/bash

echo "⚠️  WARNING: restart_app.sh is NOT recommended for regular use!"
echo "⚠️  This script may cause cache issues and unexpected behavior."
echo "⚠️  Please use './restart_full.sh' instead for reliable updates."
echo ""
echo "Continuing with restart_app.sh..."

echo "Stopping and restarting Docker container..."
docker stop serverdeck-container && docker start serverdeck-container

echo "ServerDeck application restarted. Access at http://127.0.0.1:5001/"
