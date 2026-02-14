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

    __pydantic_exclude__ = {"search_vector"}
