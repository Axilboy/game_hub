# Git Bash и деплой на сервер (Moba)

## В Git Bash (на ПК)

### Коммит и пуш одной командой
```bash
./commit.sh "описание изменений"
```
Скрипт сделает: `git add .` → `git commit -m "..."` → `git push`.

Если сообщение не указать, будет использовано «обновление»:
```bash
./commit.sh
```

Первый раз дай права на запуск (один раз):
```bash
chmod +x commit.sh
```

---

## Обновление на сервере (после push)

### Вариант А: с ПК через PowerShell (без MobaXterm)
В папке GAME_HUB в **PowerShell**:
```powershell
.\deploy-from-pc.ps1
```
Скрипт по SSH зайдёт на сервер и выполнит `git pull`, сборку и перезапуск (docker compose).

### Вариант Б: в MobaXterm (на сервере)
По SSH зайти на сервер и выполнить:
```bash
cd /GAME_HUB && bash deploy.sh
```

---

## Полный цикл

1. **Git Bash:** `./commit.sh "что сделал"`
2. **PowerShell:** `.\deploy-from-pc.ps1`  
   или в Moba на сервере: `cd /GAME_HUB && bash deploy.sh`

Настройки сервера (IP, пользователь, папка) — в начале файла `deploy-from-pc.ps1`.
