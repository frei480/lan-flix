# LanFlix

LanFlix — локальный видеосервис для просмотра видео с компьютера и поиска по их транскрипциям.

Коротко:
- Бэкенд на FastAPI; фронтенд — простой HTML/CSS/JS.
- Хранение метаданных и транскрипций в PostgreSQL (через Tortoise ORM).
- Поддержка Docker и Docker Compose для быстрого развёртывания.
- Автоматическое сканирование видео и транскрипций, группировка по плейлистам (папкам).
- Поиск по тексту транскрипций с подсветкой совпадений.
- Админ-панель для управления видео (требует аутентификации).

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

### С использованием uv (рекомендуется)

Проект использует [uv](https://github.com/astral-sh/uv) для управления зависимостями и виртуальным окружением.

1. Установите uv (если ещё не установлен):

```bash
# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
# Linux/macOS
curl -LsSf https://astral.sh/uv/install.sh | sh
```

2. Создайте виртуальное окружение и установите зависимости:

```bash
uv sync
```

3. Активируйте окружение:

```bash
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate
```

4. Настройте переменные окружения (скопируйте `.env.example` в `.env` и отредактируйте).

5. Запустите бэкенд для разработки:

```bash
uvicorn app.backend.main:app --reload
```

Фронтенд будет доступен по адресу http://localhost:8000 (статичные файлы обслуживаются самим FastAPI).

### Классический способ (pip)

1. Создайте виртуальное окружение:

```bash
python -m venv venv
venv\Scripts\activate    # Windows
source venv/bin/activate # Linux/macOS
```

2. Установите зависимости:

```bash
pip install -e .
```

3. Далее шаги 4‑5 аналогичны.

## Миграции базы данных

При первом запуске ORM автоматически создаст таблицы на основе моделей. Если вы изменяете модели, можно использовать Tortoise CLI для генерации миграций:

```bash
tortoise-cli generate --app app.backend.database
tortoise-cli upgrade
```

В продакшене миграции применяются автоматически при старте приложения (см. `app.backend.database.apply_migrations`).

## Основные команды и эндпойнты

### Проверка работоспособности
- `GET /health` — проверка здоровья сервера.

### Видео
- `GET /videos/` — список видео с пагинацией (`skip`, `limit`).
- `GET /videos/{id}` — детали видео по ID.
- `GET /videos/{id}/stream` — потоковая передача видеофайла (поддержка Range-запросов).
- `POST /videos/scan-and-load/` — сканирование папок и загрузка/обновление видео в БД.
- `PUT /videos/{id}` — обновление метаданных видео.
- `DELETE /videos/{id}` — удаление видео из БД.
- `DELETE /clear-database/` — очистка таблицы videos (только для разработки).

### Плейлисты
- `GET /playlists/` — список плейлистов (папок) с пагинацией.
- `GET /playlists/{id}` — плейлист с вложенным списком видео.

### Поиск
- `GET /search/?query=...` — поиск видео по тексту транскрипции.

### Аутентификация и администрирование
- `POST /admin/login` — вход (возвращает JWT-токен).
- `POST /admin/register` — регистрация нового пользователя (осторожно!).
- `GET /admin/videos/` — список видео (требует токен).
- `PUT /admin/videos/{id}` — обновление видео (требует токен).
- `DELETE /admin/videos/{id}` — удаление видео (требует токен).

### Документация API
- `GET /docs` — интерактивная документация Swagger UI.
- `GET /redoc` — альтернативная документация ReDoc.

## Админ-панель

После запуска приложения админ-панель доступна по адресу http://localhost/admin (если фронтенд развёрнут). Для доступа требуется аутентификация. По умолчанию создаётся суперпользователь с логином/паролем из переменных окружения `ADMIN_USER` и `ADMIN_PASS`.

## Структура репозитория

```
app/backend/          # FastAPI-приложение
├── main.py           # Точка входа, эндпойнты
├── models.py         # Модели Tortoise ORM
├── crud.py           # Операции с БД
├── schemas.py        # Pydantic-схемы
├── database.py       # Конфигурация БД, миграции
├── auth.py           # Аутентификация, JWT
└── config.py         # Конфигурация приложения
app/frontend/         # Простой фронтенд
├── index.html        # Главная страница
├── login.html        # Страница входа
├── admin/index.html  # Админ-панель
├── style.css         # Стили
├── common.js         # Общая логика
└── static/           # Статические ресурсы (Swagger, Redoc)
videos/               # Папка с видеофайлами (монтируется как volume)
transcriptions/       # Папка с транскрипциями (.md) (монтируется как volume)
migrations/           * Миграции базы данных (если используются)
docker-compose.yml    # Docker Compose конфигурация
Dockerfile.backend    # Docker-образ бэкенда
Dockerfile.frontend   # Docker-образ фронтенда
nginx.conf            * Конфигурация nginx для продакшена
pyproject.toml        * Зависимости Python (uv)
uv.lock               * Lock-файл uv
.env.example          * Пример переменных окружения
```

*Звёздочкой отмечены файлы, которые могут отсутствовать в минимальной конфигурации.*

## Полезные заметки

- Перед публикацией проверьте, что в `.env` нет секретов в репозитории.
- Для продуктивного окружения настройте обратный прокси (nginx.conf) и SSL.
- Видеофайлы и транскрипции должны находиться в соответствующих папках (`videos/` и `transcriptions/`), либо вы можете смонтировать свои директории через volumes в Docker.
- Транскрипции должны быть в формате Markdown (.md) с тем же именем, что и видеофайл (например, `video.mp4` → `video.md`).
- Поиск работает по полному тексту транскрипции с использованием PostgreSQL полнотекстового поиска.

## Лицензия

Проект распространяется под лицензией MIT.