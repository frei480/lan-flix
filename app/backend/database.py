from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.backend.config import cfg

DB_URL = f"postgresql+asyncpg://{cfg.db_user}:{cfg.db_pass}@{cfg.db_host}:{cfg.db_port}/{cfg.db_name}"
engine = create_async_engine(DB_URL, echo=True)


async def get_session():
    async with AsyncSession(engine) as session:
        yield session


# Экспортируем SQLModel для использования в Alembic
Base = SQLModel
