import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlmodel import Field, SQLModel


class Video(SQLModel, table=True):
    __tablename__ = "videos"

    id: int | None = Field(default=None, primary_key=True, index=True)
    title: str = Field(index=True)
    filepath: str = Field(unique=True, index=True)
    duration_seconds: int | None = None
    transcription: str | None = None
    search_vector: str | None = Field(
        default=None,
        sa_column=sa.Column(postgresql.TSVECTOR(), nullable=True),
    )
    playlist_id: int | None = Field(default=None, foreign_key="playlists.id")

    __pydantic_exclude__ = {"search_vector"}


class Playlist(SQLModel, table=True):
    __tablename__ = "playlists"

    id: int | None = Field(default=None, primary_key=True, index=True)
    name: str = Field(index=True)
    folder_path: str = Field(unique=True, index=True)
    description: str | None = None
