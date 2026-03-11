from tortoise import Tortoise

from app.backend.config import cfg

# NOTE: Tortoise expects a plain PostgreSQL URL; asyncpg is used internally.
DB_URL = f"postgres://{cfg.db_user}:{cfg.db_pass}@{cfg.db_host}:{cfg.db_port}/{cfg.db_name}"


async def init_db():
    """Initialize Tortoise ORM and generate schemas.

    In production you should use `aerich` for migrations instead of
    calling `generate_schemas()` every time.
    """
    await Tortoise.init(
        db_url=DB_URL,
        modules={"models": ["app.backend.models"]},
    )
    # if you don't use migrations, create tables automatically:
    await Tortoise.generate_schemas()


async def close_db():
    await Tortoise.close_connections()
