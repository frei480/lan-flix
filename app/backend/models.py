from uuid import uuid4

from tortoise import fields, models


class Playlist(models.Model):
    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=255, index=True)
    folder_path = fields.CharField(max_length=1000, unique=True, index=True)
    description = fields.TextField(null=True)

    class Meta:
        table = "playlists"


class Video(models.Model):
    id = fields.IntField(pk=True)
    title = fields.CharField(max_length=255, index=True)
    filepath = fields.CharField(max_length=1000, unique=True, index=True)
    duration_seconds = fields.IntField(null=True)
    transcription = fields.TextField(null=True)
    # PostgreSQL-specific tsvector column for full‑text index
    search_vector = fields.TextField(
        null=True, db_column="search_vector", db_type="TSVECTOR"
    )

    playlist: fields.ForeignKeyNullableRelation["Playlist"] = fields.ForeignKeyField(
        "models.Playlist", related_name="videos", null=True
    )

    class Meta:
        table = "videos"
        indexes = [("search_vector",)]


class User(models.Model):
    id = fields.UUIDField(pk=True, default=uuid4)
    username = fields.CharField(max_length=150, unique=True, index=True)
    email = fields.CharField(max_length=255, unique=True, null=True)
    hashed_password = fields.CharField(max_length=255)
    disabled = fields.BooleanField(default=False)

    class Meta:
        table = "users"
