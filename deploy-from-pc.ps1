# Деплой на сервер с твоего ПК одной командой.
# Запуск: в PowerShell из папки GAME_HUB выполни: .\deploy-from-pc.ps1
#
# Один раз настрой:
# 1. Установи OpenSSH (Параметры Windows -> Приложения -> Дополнительные компоненты -> OpenSSH-клиент).
# 2. Либо впиши ниже IP и используй пароль при запросе; либо настрой ключ: ssh-keygen, потом ssh-copy-id root@5.129.226.192

$SERVER = "5.129.226.192"
$USER   = "root"
$REMOTE_DIR = "/GAME_HUB"

$cmd = "cd $REMOTE_DIR && git pull && docker compose build && docker compose up -d"
Write-Host "Connecting to $USER@$SERVER and running deploy..."
ssh "${USER}@${SERVER}" $cmd
Write-Host "Deploy finished."
