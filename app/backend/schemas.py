from typing import Optional

from pydantic import BaseModel


class VideoBase(BaseModel):
    title: str
    filepath: str
    duration_seconds: Optional[int] = None
    transcription: Optional[str] = None
    playlist_id: Optional[int] = None


class VideoCreate(VideoBase):
    pass


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    filepath: Optional[str] = None
    duration_seconds: Optional[int] = None
    transcription: Optional[str] = None
    playlist_id: Optional[int] = None


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
    video_count: int = 0

    class Config:
        from_attributes = True


class PlaylistWithVideos(PlaylistInDB):
    videos: list[VideoInDB] = []


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
