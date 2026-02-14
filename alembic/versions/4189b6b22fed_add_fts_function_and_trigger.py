"""Add FTS function and trigger

Revision ID: 4189b6b22fed
Revises: 5f5e39f1bb9a
Create Date: 2026-02-14 21:11:29.226624

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4189b6b22fed"
down_revision: Union[str, Sequence[str], None] = "5f5e39f1bb9a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Создаем функцию для автоматического обновления search_vector
    op.execute("""
        CREATE OR REPLACE FUNCTION update_video_search_vector() RETURNS TRIGGER AS $$
        BEGIN
            NEW.search_vector = to_tsvector('russian', NEW.transcription);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Создаем триггер, который вызывает функцию при вставке или обновлении транскрипции
    op.execute("""
        CREATE TRIGGER update_videos_search_vector_trigger
        BEFORE INSERT OR UPDATE OF transcription ON videos
        FOR EACH ROW EXECUTE FUNCTION update_video_search_vector();
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TRIGGER IF EXISTS update_videos_search_vector_trigger ON videos;")

    # Удаляем функцию
    op.execute("DROP FUNCTION IF EXISTS update_video_search_vector();")
