from pydantic import BaseModel
from typing import Optional

class VideoBase(BaseModel):
    title: str
    filepath: str
    duration_seconds: Optional[int] = None
    transcription: Optional[str] = None
    playlist_id: Optional[int] = None

class VideoCreate(VideoBase):
    pass

class VideoUpdate(VideoBase):
    pass

class VideoInDB(VideoBase):
    id: int

    class Config:
        from_attributes = True

class SearchResult(BaseModel):
    id: int
    title: str
    filepath: str
    snippet: Optional[str] = None  # Кусочек текста с совпадением

class PlaylistBase(BaseModel):
    name: str
    folder_path: str
    description: Optional[str] = None

class PlaylistCreate(PlaylistBase):
    pass

class PlaylistUpdate(PlaylistBase):
    pass

class PlaylistInDB(PlaylistBase):
    id: int

    class Config:
        from_attributes = True

class PlaylistWithVideos(PlaylistInDB):
    videos: list[VideoInDB] = []