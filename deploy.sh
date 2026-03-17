#!/bin/bash
# Запускать на сервере в папке GAME_HUB: ./deploy.sh
# Или по SSH: ssh root@IP "cd /GAME_HUB && bash deploy.sh"
set -e
cd "$(dirname "$0")"
echo "Pull..."
git pull
echo "Build and up..."
docker compose build
docker compose up -d
echo "Done."
