from tortoise import Tortoise

from app.backend.config import cfg

# NOTE: Tortoise expects a plain PostgreSQL URL; asyncpg is used internally.
DB_URL = (
    f"postgres://{cfg.db_user}:{cfg.db_pass}@{cfg.db_host}:{cfg.db_port}/{cfg.db_name}"
)



async def init_db():
    """Initialize Tortoise ORM and generate schemas.

    In production you may choose to manage schema manually or with another tool
    rather than calling `generate_schemas()` on startup.
    """
    await Tortoise.init(
        db_url=DB_URL,
        modules={"models": ["app.backend.models"]},
    )
    # if you don't use migrations, create tables automatically:
    await Tortoise.generate_schemas()


async def close_db():
    await Tortoise.close_connections()
