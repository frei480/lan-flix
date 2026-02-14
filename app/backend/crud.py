from typing import List, Optional, Dict, Any
from sqlmodel import select
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app.backend.models import Video
from app.backend.schemas import VideoCreate, VideoUpdate


async def get_video(db: AsyncSession, video_id: int) -> Optional[Video]:
    statement = select(Video).where(Video.id == video_id)
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def get_video_by_filepath(db: AsyncSession, filepath: str) -> Optional[Video]:
    statement = select(Video).where(Video.filepath == filepath)
    result = await db.execute(statement)
    return result.scalar_one_or_none()


async def get_videos(db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Video]:
    statement = select(Video).offset(skip).limit(limit)
    result = await db.execute(statement)
    return result.scalars().all()


async def create_video(db: AsyncSession, video: VideoCreate) -> Video:
    db_video = Video(**video.model_dump())
    db.add(db_video)
    await db.commit()
    await db.refresh(db_video)
    return db_video


async def update_video(db: AsyncSession, video_id: int, video: VideoUpdate) -> Optional[Video]:
    db_video = await get_video(db, video_id)
    if db_video:
        for key, value in video.model_dump(exclude_unset=True).items():
            setattr(db_video, key, value)
        await db.commit()
        await db.refresh(db_video)
    return db_video


async def delete_video(db: AsyncSession, video_id: int) -> Optional[Video]:
    db_video = await get_video(db, video_id)
    if db_video:
        await db.delete(db_video)
        await db.commit()
    return db_video


async def search_videos_by_transcription(db: AsyncSession, query: str) -> List[Dict[str, Any]]:
    # Используем to_tsquery для поиска и ts_headline для получения сниппета
    # to_tsquery('russian', query) - преобразует запрос в tsquery с учетом русского словаря
    # plainto_tsquery('russian', query) - для более простого запроса
    # ts_headline - для выделения найденных совпадений в тексте

    # Убедитесь, что ваш PostgreSQL сервер настроен с русскими словарями
    # Если нет, используйте 'english' или 'simple'
    search_query = text(
        """
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
    )
    result = await db.execute(search_query, {"query": query})
    rows = result.fetchall()
    return [
        {"id": r[0], "title": r[1], "filepath": r[2], "snippet": r[3]} for r in rows
    ]