# LanFlix - Локальный видеосервис с поиском по транскрипциям

LanFlix - это локальный видеосервис, который позволяет просматривать видео с вашего компьютера и искать по их транскрипциям. Сервис состоит из бэкенда на FastAPI и фронтенда на HTML/JS, упакованных в Docker контейнеры.

## Возможности

- Просмотр видео с локального компьютера через веб-интерфейс
- Поиск по транскрипциям видео (Full Text Search)
- Автоматическая загрузка метаданных видео и транскрипций в базу данных
- Docker-контейнеризация для легкого развертывания

## Структура проекта

```
.
├── app/
│   ├── backend/          # Бэкенд на FastAPI
│   │   ├── main.py       # Основной файл приложения
│   │   ├── models.py     # Модели данных
│   │   ├── schemas.py    # Pydantic схемы
│   │   ├── crud.py       # Функции для работы с БД
│   │   ├── database.py  # Конфигурация БД
│   │   └── config.py     # Конфигурация приложения
│   └── frontend/        # Фронтенд на HTML/JS
│       ├── index.html
│       └── style.css
├── videos/              # Папка с видео файлами (внешний volume)
├── transcriptions/       # Папка с транскрипциями (внешний volume)
├── alembic/              # Миграции БД
├── docker-compose.yml   # Docker Compose конфигурация
├── Dockerfile.backend    # Dockerfile для бэкенда
├── Dockerfile.frontend   # Dockerfile для фронтенда
├── nginx.conf            # Конфигурация Nginx
├── pyproject.toml        # Зависимости проекта
└── README.md
```

## Технологии

- **Бэкенд**: Python, FastAPI, SQLModel, PostgreSQL, Alembic
- **Фронтенд**: HTML, JavaScript, CSS
- **Инфраструктура**: Docker, Docker Compose, Nginx

## Установка и запуск

1. Убедитесь, что у вас установлен Docker и Docker Compose.

2. Клонируйте репозиторий:
   ```bash
   git clone <repo-url>
   cd lan-flix
   ```

3. Создайте файл `.env` в корне проекта с необходимыми переменными окружения:
   ```env
   DB_USER=postgres
   DB_PASS=your_password
   DB_NAME=lanflix
   username=admin
   password=admin
   ```

4. Отредактируйте `docker-compose.yml`, чтобы указать правильные пути к вашим видео и транскрипциям:
   ```yaml
   volumes:
     - "/path/to/your/videos:/app/videos"
     - "/path/to/your/transcriptions:/app/transcriptions"
   ```

5. Запустите приложение:
   ```bash
   docker-compose up -d
   ```

6. Откройте в браузере `http://localhost`

## Использование

1. После первого запуска нажмите кнопку "Scan and Load Videos" на главной странице, чтобы загрузить видео и транскрипции в базу данных.

2. Используйте поле поиска для поиска по транскрипциям видео.

3. Нажмите на название видео в списке, чтобы начать его просмотр.

## API Endpoints

- `GET /api/health` - Проверка состояния сервиса
- `POST /api/videos/scan-and-load/` - Сканирование и загрузка видео
- `GET /api/videos/` - Получение списка видео
- `GET /api/videos/{id}` - Получение информации о видео
- `GET /api/videos/{id}/stream` - Потоковая передача видео
- `GET /api/search/?query={query}` - Поиск по транскрипциям

## Разработка

Для разработки рекомендуется использовать виртуальное окружение Python:

```bash
python -m venv venv
source venv/bin/activate  # На Windows: venv\Scripts\activate
pip install -e .
```

Для запуска миграций базы данных:
```bash
alembic upgrade head
```

Для запуска бэкенда в режиме разработки:
```bash
python -m app.backend.main
```

## Лицензия

MIT