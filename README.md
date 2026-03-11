# LanFlix

LanFlix — локальный видеосервис для просмотра видео с компьютера и поиска по их транскрипциям.

Коротко:
- Бэкенд на FastAPI; фронтенд — простой HTML/CSS/JS.
- Хранение метаданных и транскрипций в PostgreSQL (через Tortoise ORM).
- Поддержка Docker и Docker Compose для быстрого развёртывания.

## Быстрый старт (Docker)

1. Установите Docker и Docker Compose.
2. Скопируйте репозиторий и перейдите в папку проекта:

```bash
git clone <repo-url>
cd lan-flix
```

3. Создайте `.env` в корне проекта (пример значений):

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=lanflix
ADMIN_USER=admin
ADMIN_PASS=admin
```

4. В `docker-compose.yml` укажите монтирование папок с вашими видео и транскрипциями (volumes):

```yaml
volumes:
  - /путь/к/video:/app/videos
  - /путь/к/transcriptions:/app/transcriptions
```

5. Запустите стек:

```bash
docker-compose up -d --build
```

6. Откройте http://localhost в браузере.

## Разработка локально

1. Рекомендуется виртуальное окружение:

```bash
python -m venv venv
venv\\Scripts\\activate    # Windows
pip install -e .
```

2. При первом запуске ORM сама создаст таблицы; миграции можно поддерживать вручную или отказаться от них, так как схема генерируется автоматически при запуске.

3. Запустите бэкенд для разработки:

```bash
uvicorn app.backend.main:app --reload
```

## Основные команды и эндпойнты

- Проверка здоровья: `GET /api/health`
- Сканирование и загрузка видео: `POST /api/videos/scan-and-load/`
- Список видео: `GET /api/videos/`
- Детали видео: `GET /api/videos/{id}`
- Поток видео: `GET /api/videos/{id}/stream`
- Поиск по транскрипциям: `GET /api/search/?query=...`

## Структура репозитория (основное)

```
app/backend/      # FastAPI-приложение (main.py, models.py, crud.py, schemas.py, database.py)
app/frontend/     # Простой фронтенд (index.html, style.css)
videos/           # Рекомендуется монтировать как volume
transcriptions/   # Рекомендуется монтировать как volume
docker-compose.yml
Dockerfile.backend
Dockerfile.frontend
```

## Полезные заметки

- Перед публикацией проверьте, что в `.env` нет секретов в репозитории.
- Для продуктивного окружения настройте обратный прокси (nginx.conf) и SSL.

## Лицензия

Проект распространяется под лицензией MIT.