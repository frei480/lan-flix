import logging
import mimetypes
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import aiofiles
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import (
    get_redoc_html,
    get_swagger_ui_html,
    get_swagger_ui_oauth2_redirect_html,
)
from fastapi.responses import StreamingResponse
from tortoise import Tortoise
from tortoise.contrib.fastapi import register_tortoise

from app.backend import crud
from app.backend.auth import CurrentUserDep, create_access_token, verify_password
from app.backend.config import cfg
from app.backend.database import (
    TORTOISE_ORM,
    apply_migrations,
    ensure_database_exists,
)
from app.backend.schemas import (
    LoginRequest,
    PlaylistCreate,
    PlaylistInDB,
    PlaylistWithVideos,
    SearchResult,
    TokenResponse,
    VideoCreate,
    VideoInDB,
    VideoUpdate,
)

logging.basicConfig(level=logging.INFO, handlers=[logging.StreamHandler(sys.stdout)])
logger = logging.getLogger(__name__)


def is_path_allowed(filepath: Path) -> bool:
    """
    Проверяет, что путь находится внутри разрешённой директории (VIDEOS_DIR).
    Возвращает True, если путь разрешён, иначе False.
    """
    try:
        resolved = filepath.resolve()
        return resolved.is_relative_to(cfg.videos_dir_absolute)
    except (ValueError, OSError):
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Контекстный менеджер жизненного цикла приложения FastAPI.

    Выполняет инициализацию базы данных, применяет миграции и создаёт суперпользователя
    при запуске приложения. При завершении выводит сообщение о завершении работы.

    Args:
        app (FastAPI): Экземпляр приложения FastAPI.

    Yields:
        None: Управление возвращается приложению на время работы.
    """
    await ensure_database_exists()
    await apply_migrations()
    await crud.ensure_superuser_exists(cfg.username, cfg.password)
    yield
    print("[LIFESPAN] Shutting down")
    await Tortoise.close_connections()


app = FastAPI(title="Url shortener", docs_url=None, redoc_url=None, lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # server IP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Tortoise ORM with FastAPI (adds middleware and ensures context)
register_tortoise(app, config=TORTOISE_ORM)


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html(request: Request):
    """
    Возвращает HTML-страницу Swagger UI для интерактивной документации API.

    Args:
        request (Request): Объект запроса FastAPI.

    Returns:
        HTMLResponse: Страница Swagger UI с настроенными статическими ресурсами.
    """
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,  # type: ignore
        title=app.title + " - Swagger UI",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        swagger_js_url=f"http://{request.url.hostname}/static/js/swagger-ui-bundle.js",
        swagger_css_url=f"http://{request.url.hostname}/static/css/swagger-ui.css",
    )


@app.get(app.swagger_ui_oauth2_redirect_url, include_in_schema=False)
async def swagger_ui_redirect():
    """
    Обрабатывает редирект OAuth2 для Swagger UI.

    Returns:
        HTMLResponse: HTML-страница для завершения OAuth2 аутентификации.
    """
    return get_swagger_ui_oauth2_redirect_html()


@app.get("/redoc", include_in_schema=False)
async def redoc_html(request: Request):
    """
    Возвращает HTML-страницу ReDoc для альтернативной документации API.

    Args:
        request (Request): Объект запроса FastAPI.

    Returns:
        HTMLResponse: Страница ReDoc с настроенными статическими ресурсами.
    """
    return get_redoc_html(
        openapi_url=app.openapi_url,  # type: ignore
        title=app.title + " - ReDoc",
        redoc_js_url=f"http://{request.url.hostname}/static/js/redoc.standalone.js",
    )


@app.get("/users/{username}")
async def read_user(username: str):
    """
    Тестовый эндпоинт для приветствия пользователя.

    Args:
        username (str): Имя пользователя.

    Returns:
        dict: Сообщение с приветствием.
    """
    return {"message": f"Hello {username}"}


@app.get("/health", status_code=200)
def health_check():
    """
    Проверка работоспособности сервера (health check).

    Returns:
        dict: Статус "ok", если сервер работает.
    """
    return {"status": "ok"}


@app.post("/videos/scan-and-load/", response_model=list[VideoInDB])
async def scan_and_load_videos():
    """
    Сканирует папки с видео и транскрипциями и загружает их метаданные в БД.
    Обновляет существующие записи, если транскрипция изменилась.
    """
    loaded_videos: list[VideoInDB] = []

    # Сначала создаем плейлисты из папок
    await create_playlists_from_folders()

    video_files = [
        f
        for f in Path(cfg.VIDEOS_DIR).rglob("*")
        if f.is_file() and f.suffix in (".mp4", ".mkv", ".webm")
    ]

    for video_path in video_files:
        # Используем полный путь к видео как filepath в БД
        filepath = str(video_path)

        # Для транскрипции ищем файл с тем же именем в той же папке
        transcription_path = video_path.with_suffix(".md")
        title = transcription_path.stem

        transcription_content = None
        if transcription_path.is_file():
            async with aiofiles.open(transcription_path, "r", encoding="utf-8") as f:
                transcription_content = await f.read()

        db_video = await crud.get_video_by_filepath(filepath=filepath)

        # Определяем плейлист по папке видео
        folder_path = str(video_path.parent)
        db_playlist = await crud.get_playlist_by_folder(folder_path=folder_path)
        playlist_id = db_playlist.id if db_playlist else None

        if db_video:
            if (
                db_video.transcription != transcription_content
                or db_video.playlist_id != playlist_id
            ):
                video_update = VideoUpdate(
                    title=title,
                    filepath=filepath,
                    transcription=transcription_content,
                    playlist_id=playlist_id,
                )
                db_video = await crud.update_video(
                    db_video.id,  # type: ignore
                    video_update,
                )
            if db_video:
                loaded_videos.append(VideoInDB.model_validate(db_video))
        else:
            video_create = VideoCreate(
                title=title,
                filepath=filepath,
                transcription=transcription_content,
                playlist_id=playlist_id,
            )
            db_video = await crud.create_video(video_create)
            if db_video:
                loaded_videos.append(VideoInDB.model_validate(db_video))

    return loaded_videos


async def create_playlists_from_folders():
    """
    Создает плейлисты на основе папок с видео.
    """
    video_folders: set[str] = set()
    video_files = [
        f
        for f in Path(cfg.VIDEOS_DIR).rglob("*")
        if f.is_file() and f.suffix in (".mp4", ".mkv", ".webm")
    ]

    # Собираем все уникальные папки с видео
    for video_path in video_files:
        video_folders.add(str(video_path.parent))

    # Создаем плейлисты для каждой папки
    for folder_path in video_folders:
        db_playlist = await crud.get_playlist_by_folder(folder_path=folder_path)
        if not db_playlist:
            playlist_name = Path(folder_path).name
            playlist_create = PlaylistCreate(
                name=playlist_name,
                folder_path=folder_path,
                description=f"Плейлист для папки {playlist_name}",
            )
            await crud.create_playlist(playlist_create)


@app.get("/videos/", response_model=list[VideoInDB])
async def read_videos(skip: int = 0, limit: int = 100):
    """
    Возвращает список видео с пагинацией.

    Args:
        skip (int): Количество видео для пропуска (по умолчанию 0).
        limit (int): Максимальное количество видео для возврата (по умолчанию 100).

    Returns:
        list[VideoInDB]: Список объектов видео.
    """
    videos = await crud.get_videos(skip=skip, limit=limit)
    return [VideoInDB.model_validate(video) for video in videos]


@app.get("/videos/{video_id}", response_model=VideoInDB)
async def read_video(video_id: int):
    """
    Возвращает видео по его идентификатору.

    Args:
        video_id (int): Идентификатор видео.

    Raises:
        HTTPException: 404, если видео не найдено.

    Returns:
        VideoInDB: Объект видео.
    """
    db_video = await crud.get_video(video_id=video_id)
    if db_video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return VideoInDB.model_validate(db_video)


@app.get("/videos/{video_id}/stream")
async def stream_video(video_id: int, request: Request):
    """
    Потоковая передача видеофайла с поддержкой диапазонов (Range requests).

    Поддерживает HTTP Range заголовки для возобновляемой загрузки и стриминга.
    Если запрос содержит заголовок Range, возвращает часть файла (код 206).
    Иначе возвращает весь файл (код 200).

    Args:
        video_id (int): Идентификатор видео в базе данных.
        request (Request): Объект запроса FastAPI.

    Raises:
        HTTPException: 404, если видео или файл не найдены.
        HTTPException: 403, если доступ к файлу запрещён.
        HTTPException: 416, если диапазон некорректен.

    Returns:
        StreamingResponse: Потоковый ответ с видеофайлом.
    """
    db_video = await crud.get_video(video_id=video_id)
    if db_video is None:
        raise HTTPException(status_code=404, detail="Video not found")

    video_path = Path(db_video.filepath)
    if not video_path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found on server")

    # Проверяем, что путь находится внутри разрешённой директории
    if not is_path_allowed(video_path):
        raise HTTPException(status_code=403, detail="Access to this file is forbidden")

    # Получаем размер файла
    file_size = os.stat(video_path).st_size
    mime_type, _ = mimetypes.guess_type(video_path)
    if not mime_type or not mime_type.startswith("video/"):
        mime_type = "application/octet-stream"  # Fallback

    range_header = request.headers.get("Range")

    if range_header:
        # Обрабатываем Range-запрос
        try:
            # Парсим заголовок Range, например "bytes=0-1023"
            byte1, byte2 = 0, file_size - 1
            range_parts = range_header.replace("bytes=", "").split("-")

            byte1 = int(range_parts[0])
            if len(range_parts) > 1 and range_parts[1]:
                byte2 = int(range_parts[1])

            # Убеждаемся, что диапазон корректен
            if byte1 >= file_size or byte2 >= file_size or byte1 > byte2:
                raise HTTPException(
                    status_code=416, detail="Requested Range Not Satisfiable"
                )

        except ValueError:
            raise HTTPException(status_code=416, detail="Invalid Range header")

        start, end = byte1, byte2
        length = end - start + 1

        # Открываем файл и переходим к нужной позиции
        async def stream_in_chunks():
            async with aiofiles.open(video_path, mode="rb") as f:
                await f.seek(start)
                bytes_read = 0
                while bytes_read < length:
                    # Читаем чанками, например по 64KB
                    chunk_size = min(length - bytes_read, 65536)
                    chunk = await f.read(chunk_size)
                    if not chunk:
                        break  # Конец файла
                    yield chunk
                    bytes_read += len(chunk)

        # Формируем ответ для частичного контента
        response = StreamingResponse(
            stream_in_chunks(),
            media_type=mime_type,
            status_code=206,  # 206 Partial Content
        )
        response.headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        response.headers["Content-Length"] = str(
            length
        )  # Длина только отправляемой части
        response.headers["Accept-Ranges"] = "bytes"  # Всегда отправляем этот заголовок
        return response

    else:
        # Если Range-заголовка нет, отправляем весь файл
        def iterfile():
            with open(video_path, mode="rb") as file_like:
                yield from file_like

        response = StreamingResponse(iterfile(), media_type=mime_type)
        response.headers["Content-Length"] = str(file_size)  # Общая длина файла
        response.headers["Accept-Ranges"] = "bytes"  # Всегда отправляем этот заголовок
        return response


@app.get("/search/", response_model=list[SearchResult])
async def search_videos(query: str):
    """
    Поиск видео по тексту транскрипции.

    Args:
        query (str): Поисковый запрос (не может быть пустым).

    Raises:
        HTTPException: 400, если запрос пустой.
        HTTPException: 500, если произошла внутренняя ошибка при поиске.

    Returns:
        list[SearchResult]: Список результатов поиска с информацией о видео.
    """
    if not query:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    logger.info(f"Search request received: query='{query}'")
    try:
        results: list[dict[str, Any]] = await crud.search_videos_by_transcription(query)
        logger.info(f"Search returned {len(results)} results")
        return [SearchResult(**result) for result in results]
    except Exception as e:
        logger.exception(f"Search failed for query '{query}': {e}")
        raise HTTPException(
            status_code=500, detail="Internal server error during search"
        )


@app.put("/videos/{video_id}")
async def update_video(video_id: int, video: VideoUpdate):
    """
    Обновляет метаданные видео.

    Args:
        video_id (int): Идентификатор видео для обновления.
        video (VideoUpdate): Объект с новыми данными видео.

    Raises:
        HTTPException: 404, если видео не найдено.

    Returns:
        VideoInDB: Обновлённый объект видео.
    """
    db_video = await crud.get_video(video_id=video_id)
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")

    video_update = VideoUpdate(
        title=video.title,
        filepath=video.filepath,
        transcription=video.transcription,
        playlist_id=video.playlist_id,
    )
    db_video = await crud.update_video(
        db_video.id,  # type: ignore
        video_update,
    )
    if db_video:
        return VideoInDB.model_validate(db_video)
    else:
        raise HTTPException(status_code=404, detail="Video not found")


@app.delete("/videos/{video_id}")
async def delete_video(video_id: int):
    """
    Удаляет видео из базы данных.

    Args:
        video_id (int): Идентификатор видео для удаления.

    Raises:
        HTTPException: 404, если видео не найдено.

    Returns:
        VideoInDB: Удалённый объект видео (перед удалением).
    """
    db_video = await crud.get_video(video_id=video_id)
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")

    db_video = await crud.delete_video(video_id=video_id)
    if db_video:
        return VideoInDB.model_validate(db_video)


@app.delete("/clear-database/")
async def clear_database():
    """
    Очищает таблицу videos в базе данных.
    """
    await crud.clear_database()
    return {"message": "Database cleared successfully"}


# Playlist endpoints


@app.get("/playlists/", response_model=list[PlaylistInDB])
async def read_playlists(skip: int = 0, limit: int = 100):
    """
    Возвращает список плейлистов с пагинацией.

    Args:
        skip (int): Количество плейлистов для пропуска (по умолчанию 0).
        limit (int): Максимальное количество плейлистов для возврата (по умолчанию 100).

    Returns:
        list[PlaylistInDB]: Список объектов плейлистов.
    """
    return await crud.get_playlists(skip=skip, limit=limit)


@app.get("/playlists/{playlist_id}", response_model=PlaylistWithVideos)
async def read_playlist(playlist_id: int):
    """
    Возвращает плейлист по его идентификатору вместе с видео.

    Args:
        playlist_id (int): Идентификатор плейлиста.

    Raises:
        HTTPException: 404, если плейлист не найден.

    Returns:
        PlaylistWithVideos: Объект плейлиста с вложенным списком видео.
    """
    db_playlist = await crud.get_playlist(playlist_id=playlist_id)
    if db_playlist is None:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Получаем видео для плейлиста
    videos = await crud.get_videos_by_playlist(playlist_id=playlist_id)
    playlist_with_videos = PlaylistWithVideos(
        **PlaylistInDB.model_validate(db_playlist).model_dump(),
        videos=[VideoInDB.model_validate(video) for video in videos],
    )
    return playlist_with_videos


@app.post("/admin/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Вход пользователя"""
    logger.info(
        f"Login attempt: username={request.username}, password_len={len(request.password)}"
    )
    # Поиск пользователя в БД
    user = await crud.get_user_by_name(user_name=request.username)
    logger.info(f"User: {user}")
    if not user:
        logger.warning(f"User not found: {request.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not verify_password(request.password, user.hashed_password):
        logger.warning(f"Password mismatch for user {request.username}")
        raise HTTPException(status_code=401, detail="Invalid username or password")

    access_token = create_access_token(username=user.username)
    logger.info(f"Access token: {access_token}")
    return {"access_token": access_token}


@app.post("/admin/register")
async def register(request: LoginRequest):
    """Регистрация нового пользователя (без защиты - используйте осторожно!)"""
    user = await crud.get_user_by_name(user_name=request.username)
    if user:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = await crud.create_user(request.username, request.password)
    return user


@app.get("/admin/videos/", response_model=list[VideoInDB])
async def admin_read_videos(
    current_user: CurrentUserDep,  # Требует валидный токен!
    skip: int = 0,
    limit: int = 100,
):
    """Получить список видео (только для авторизованных)"""
    videos = await crud.get_videos(skip=skip, limit=limit)
    return [VideoInDB.model_validate(video) for video in videos]


@app.put("/admin/videos/{video_id}", response_model=VideoInDB)
async def admin_update_video(
    video_id: int, video: VideoUpdate, current_user: CurrentUserDep
):
    """Обновить видео"""
    logger.info(f"Admin update video {video_id}: received data {video.model_dump()}")
    db_video = await crud.get_video(video_id=video_id)
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")

    updated_video = await crud.update_video(video_id, video)
    logger.info(f"Updated video {video_id}: {updated_video}")
    return VideoInDB.model_validate(updated_video)


@app.delete("/admin/videos/{video_id}")
async def admin_delete_video(video_id: int, current_user: CurrentUserDep):
    """Удалить видео"""
    db_video = await crud.get_video(video_id=video_id)
    if not db_video:
        raise HTTPException(status_code=404, detail="Video not found")

    await crud.delete_video(video_id=video_id)
    return {"detail": "Video deleted successfully"}


if __name__ == "__main__":
    uvicorn.run("app.backend.main:app", host="0.0.0.0", workers=4)
