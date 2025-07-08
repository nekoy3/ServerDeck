#!/bin/bash

echo "Stopping and restarting Docker container..."
docker stop serverdeck-container && docker start serverdeck-container

echo "ServerDeck application restarted. Access at http://127.0.0.1:5001/"
