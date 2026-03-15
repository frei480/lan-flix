from tortoise import fields, migrations
from tortoise.fields.base import OnDelete
from tortoise.indexes import Index
from tortoise.migrations import operations as ops


class Migration(migrations.Migration):
    initial = True

    operations = [
        ops.CreateModel(
            name="Playlist",
            fields=[
                (
                    "id",
                    fields.IntField(
                        generated=True, primary_key=True, unique=True, db_index=True
                    ),
                ),
                ("name", fields.CharField(db_index=True, max_length=255)),
                (
                    "folder_path",
                    fields.CharField(unique=True, db_index=True, max_length=1000),
                ),
                ("description", fields.TextField(null=True, unique=False)),
            ],
            options={"table": "playlists", "app": "models", "pk_attr": "id"},
            bases=["Model"],
        ),
        ops.CreateModel(
            name="Video",
            fields=[
                (
                    "id",
                    fields.IntField(
                        generated=True, primary_key=True, unique=True, db_index=True
                    ),
                ),
                ("title", fields.CharField(db_index=True, max_length=255)),
                (
                    "filepath",
                    fields.CharField(unique=True, db_index=True, max_length=1000),
                ),
                ("duration_seconds", fields.IntField(null=True)),
                ("transcription", fields.TextField(null=True, unique=False)),
                ("search_vector", fields.TextField(null=True, unique=False)),
                (
                    "playlist",
                    fields.ForeignKeyField(
                        "models.Playlist",
                        source_field="playlist_id",
                        null=True,
                        db_constraint=True,
                        to_field="id",
                        related_name="videos",
                        on_delete=OnDelete.CASCADE,
                    ),
                ),
            ],
            options={
                "table": "videos",
                "app": "models",
                "indexes": [Index(fields=["search_vector"])],
                "pk_attr": "id",
            },
            bases=["Model"],
        ),
    ]
