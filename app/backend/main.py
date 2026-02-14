import logging
import mimetypes
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any, Dict, Generator, List

import uvicorn
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from app.backend import crud
from app.backend.config import cfg
from app.backend.database import get_session
from app.backend.schemas import SearchResult, VideoCreate, VideoInDB, VideoUpdate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SessionDep = Annotated[AsyncSession, Depends(get_session)]


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Start app")
    yield


app = FastAPI(title="Url shortener", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # server IP
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", status_code=200)
def health_check():
    return {"status": "ok"}


@app.post("/videos/scan-and-load/", response_model=List[VideoInDB])
async def scan_and_load_videos(db: SessionDep):
    """
    Сканирует папки с видео и транскрипциями и загружает их метаданные в БД.
    Обновляет существующие записи, если транскрипция изменилась.
    """
    loaded_videos: List[VideoInDB] = []

    video_files = [
        f
        for f in Path(cfg.VIDEOS_DIR).glob("*")
        if f.is_file() and f.suffix in (".mp4", ".mkv")
    ]

    for filename in video_files:
        filepath = os.path.join(cfg.VIDEOS_DIR, filename)

        title = Path(filename).stem

        transcription_filepath = os.path.join(cfg.TRANSCRIPTIONS_DIR, f"{title}.md")
        transcription_content = None
        if os.path.exists(transcription_filepath):
            with open(transcription_filepath, "r", encoding="utf-8") as f:
                transcription_content = f.read()

        db_video = await crud.get_video_by_filepath(db, filepath=filepath)

        if db_video:
            if db_video.transcription != transcription_content:
                video_update = VideoUpdate(
                    title=title,
                    filepath=filepath,
                    transcription=transcription_content,
                )
                db_video = await crud.update_video(
                    db,
                    db_video.id,  # type: ignore
                    video_update,
                )
            if db_video:
                loaded_videos.append(VideoInDB.model_validate(db_video))
        else:
            video_create = VideoCreate(
                title=title, filepath=filepath, transcription=transcription_content
            )
            db_video = await crud.create_video(db, video_create)
            if db_video:
                loaded_videos.append(VideoInDB.model_validate(db_video))

    return loaded_videos


@app.get("/videos/", response_model=List[VideoInDB])
async def read_videos(db: SessionDep, skip: int = 0, limit: int = 100):
    videos = await crud.get_videos(db, skip=skip, limit=limit)
    return [VideoInDB.model_validate(video) for video in videos]


@app.get("/videos/{video_id}", response_model=VideoInDB)
async def read_video(video_id: int, db: SessionDep):
    db_video = await crud.get_video(db, video_id=video_id)
    if db_video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return VideoInDB.model_validate(db_video)


@app.get("/videos/{video_id}/stream")
async def stream_video(video_id: int, db: SessionDep):
    db_video = await crud.get_video(db, video_id=video_id)
    if db_video is None:
        raise HTTPException(status_code=404, detail="Video not found")

    video_path = Path(db_video.filepath)
    if not video_path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found on server")

    mime_type, _ = mimetypes.guess_type(video_path)
    if not mime_type or not mime_type.startswith("video/"):
        mime_type = "application/octet-stream"  # Fallback

    def iterfile() -> Generator[bytes, None, None]:
        with open(video_path, mode="rb") as file_like:
            yield from file_like

    return StreamingResponse(iterfile(), media_type=mime_type)


@app.get("/search/", response_model=List[SearchResult])
async def search_videos(query: str, db: SessionDep):
    if not query:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")

    results: List[Dict[str, Any]] = await crud.search_videos_by_transcription(db, query)
    return [SearchResult(**result) for result in results]


if __name__ == "__main__":
    uvicorn.run("app.backend.main:app", host="0.0.0.0", reload=True)
