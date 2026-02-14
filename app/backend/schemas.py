from pydantic import BaseModel
from typing import Optional

class VideoBase(BaseModel):
    title: str
    filepath: str
    duration_seconds: Optional[int] = None
    transcription: Optional[str] = None

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