#!/bin/bash
# В Git Bash: ./commit.sh "описание изменений"
# Делает: git add . → git commit -m "..." → git push
set -e
MSG="${*:-обновление}"
git add .
git commit -m "$MSG"
git push
echo "Готово. Чтобы обновить сервер: в PowerShell выполни .\deploy-from-pc.ps1 или в Moba: cd /GAME_HUB && bash deploy.sh"
