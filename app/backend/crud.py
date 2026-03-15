import logging
from typing import Any

from tortoise import Tortoise

from app.backend.auth import hash_password
from app.backend.models import Playlist, User, Video
from app.backend.schemas import PlaylistCreate, PlaylistUpdate, VideoCreate, VideoUpdate

logger = logging.getLogger(__name__)


async def get_video(video_id: int) -> Video | None:
    return await Video.filter(id=video_id).first()


async def get_video_by_filepath(filepath: str) -> Video | None:
    return await Video.filter(filepath=filepath).first()


async def get_videos(skip: int = 0, limit: int = 100) -> list[Video]:
    return await Video.all().offset(skip).limit(limit)


async def get_videos_by_playlist(playlist_id: int) -> list[Video]:
    return await Video.filter(playlist_id=playlist_id).all()


async def create_video(video: VideoCreate) -> Video:
    return await Video.create(**video.model_dump())


async def update_video(video_id: int, video: VideoUpdate) -> Video | None:
    db_video = await get_video(video_id)
    if db_video:
        update_data = video.model_dump(exclude_unset=True)
        await db_video.update_from_dict(update_data)
        await db_video.save()
    return db_video


async def delete_video(video_id: int) -> Video | None:
    db_video = await get_video(video_id)
    if db_video:
        await db_video.delete()
    return db_video


async def search_videos_by_transcription(query: str) -> list[dict[str, Any]]:
    # raw SQL approach, identical to previous implementation but executed through the
    # underlying connection object. This keeps the full‑text search logic unchanged.
    search_query = """
        SELECT
            id,
            title,
            filepath,
            ts_headline('russian', transcription, plainto_tsquery('russian', :query),
                        'StartSel=<b>,StopSel=</b>,MaxFragments=1,FragmentDelimiter=...,MaxWords=30,MinWords=15') AS snippet
        FROM videos
        WHERE search_vector @@ plainto_tsquery('russian', :query)
        ORDER BY ts_rank_cd(search_vector, plainto_tsquery('russian', :query)) DESC;
        """
    connection = Tortoise.get_connection("default")
    rows = await connection.execute_query_dict(search_query, {"query": query})
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "filepath": r["filepath"],
            "snippet": r["snippet"],
        }
        for r in rows
    ]


async def clear_database() -> None:
    """Удаляет все записи из таблицы videos."""
    await Video.all().delete()


# Playlist CRUD operations


async def get_playlist(playlist_id: int) -> Playlist | None:
    return await Playlist.filter(id=playlist_id).first()


async def get_playlist_by_folder(folder_path: str) -> Playlist | None:
    return await Playlist.filter(folder_path=folder_path).first()


async def get_playlists(skip: int = 0, limit: int = 100) -> list[dict]:
    playlists = await Playlist.all().offset(skip).limit(limit)
    playlist_data: list[dict] = []
    for playlist in playlists:
        videos = await Video.filter(filepath__startswith=playlist.folder_path).all()
        playlist_data.append(
            {
                "id": playlist.id,
                "name": playlist.name,
                "folder_path": playlist.folder_path,
                "description": playlist.description,
                "video_count": len(videos),
            }
        )
    return playlist_data


async def create_playlist(playlist: PlaylistCreate) -> Playlist:
    return await Playlist.create(**playlist.model_dump())


async def update_playlist(
    playlist_id: int, playlist: PlaylistUpdate
) -> Playlist | None:
    db_playlist = await get_playlist(playlist_id)
    if db_playlist:
        update_data = playlist.model_dump(exclude_unset=True)
        await db_playlist.update_from_dict(update_data)
        await db_playlist.save()
    return db_playlist


async def delete_playlist(playlist_id: int) -> Playlist | None:
    db_playlist = await get_playlist(playlist_id)
    if db_playlist:
        await db_playlist.delete()
    return db_playlist


async def get_user_by_name(user_name: str) -> User | None:
    return await User.filter(username=user_name).first()


async def create_user(username: str, password: str) -> dict:
    hashed_password = hash_password(password)
    user = await User.create(username=username, hashed_password=hashed_password)
    return {"id": user.id, "username": user.username}


async def ensure_superuser_exists(username: str, password: str) -> None:
    """
    Проверяет, существует ли пользователь с заданным именем.
    Если нет — создаёт его с указанным паролем.
    Обрабатывает возможные конфликты (например, дублирование из-за race condition).
    """
    existing = await get_user_by_name(username)
    if existing:
        logger.info(f"Superuser '{username}' already exists.")
        return
    logger.info(f"Creating superuser '{username}'...")
    try:
        await create_user(username, password)
        logger.info(f"Superuser '{username}' created successfully.")
    except Exception as e:
        # Если пользователь уже создан параллельным процессом, просто логируем
        logger.warning(f"Could not create superuser '{username}': {e}. Assuming already exists.")
