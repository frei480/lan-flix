import asyncio
import logging
import subprocess

import asyncpg
from tortoise import Tortoise

from app.backend.config import cfg

logger = logging.getLogger(__name__)

# NOTE: Tortoise expects a plain PostgreSQL URL; asyncpg is used internally.
DB_URL = (
    f"postgres://{cfg.db_user}:{cfg.db_pass}@{cfg.db_host}:{cfg.db_port}/{cfg.db_name}"
)
TORTOISE_ORM = {
    "connections": {
        "default": DB_URL,
    },
    "apps": {
        "models": {
            # Список путей к вашим моделям
            "models": ["app.backend.models"],
            "default_connection": "default",
            "migrations": "migrations",
        },
    },
    "use_tz": False,
    "timezone": "UTC",
}


async def ensure_database_exists():
    """
    Проверяет существование базы данных, указанной в конфигурации.
    Если база отсутствует, создаёт её.
    """
    print(f"[DEBUG] ensure_database_exists called with cfg.db_name={cfg.db_name}")
    # Подключаемся к служебной базе postgres
    sys_conn = await asyncpg.connect(
        host=cfg.db_host,
        port=cfg.db_port,
        user=cfg.db_user,
        password=cfg.db_pass,
        database="postgres",
    )
    try:
        # Проверяем, существует ли база
        exists = await sys_conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", cfg.db_name
        )
        if not exists:
            logger.info(f"Database '{cfg.db_name}' does not exist, creating...")
            print(f"[DEBUG] Creating database '{cfg.db_name}'")
            # CREATE DATABASE не может быть выполнен с параметрами, поэтому используем простой запрос
            await sys_conn.execute(f'CREATE DATABASE "{cfg.db_name}"')
            logger.info(f"Database '{cfg.db_name}' created successfully.")
            print(f"[DEBUG] Database '{cfg.db_name}' created.")
        else:
            logger.info(f"Database '{cfg.db_name}' already exists.")
            print(f"[DEBUG] Database '{cfg.db_name}' already exists.")
    except Exception as e:
        print(f"[ERROR] ensure_database_exists failed: {e}")
        raise
    finally:
        await sys_conn.close()


async def apply_migrations():
    """
    Применяет миграции Tortoise ORM с помощью tortoise.
    """
    logger.info("Applying Tortoise ORM migrations...")
    # Команда для применения миграций
    cmd = [
        "tortoise",
        "-c",
        "app.backend.database.TORTOISE_ORM",
        "upgrade",
    ]
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode == 0:
            logger.info("Migrations applied successfully.")
            if stdout:
                logger.debug(stdout.decode().strip())
        else:
            logger.error(f"Migration failed with exit code {process.returncode}")
            if stderr:
                logger.error(stderr.decode().strip())
            raise RuntimeError("Failed to apply migrations")
    except FileNotFoundError:
        logger.error("tortoise not found. Make sure it's installed.")
        raise


async def init_db():
    """Initialize Tortoise ORM."""
    await Tortoise.init(config=TORTOISE_ORM)


async def close_db():
    await Tortoise.close_connections()