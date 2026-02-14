from sqlmodel import SQLModel, create_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from app.backend.config import cfg
import os

# Проверяем, что строка подключения начинается с postgresql://
if not cfg.DATABASE_URL.startswith("postgresql://"):
    # Добавляем "postgresql://" если протокол отсутствует
    # Это может быть необходимо, если вы используете env переменную без явного протокола
    cfg.DATABASE_URL = "postgresql://" + cfg.DATABASE_URL

# Создаем асинхронный движок
async_engine = create_async_engine(
    cfg.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=True,
)

# Создаем асинхронную сессию
AsyncSessionLocal = sessionmaker(
    async_engine, class_=AsyncSession, expire_on_commit=False
)

# Dependency для получения асинхронной сессии БД
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# Экспортируем SQLModel для использования в Alembic
Base = SQLModel