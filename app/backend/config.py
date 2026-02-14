from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class ConfigBase(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=False
    )
    db_user: str
    db_pass: str
    db_host: str
    db_port: int
    db_name: str
    username: str
    password: str
    VIDEOS_DIR: str = "videos"
    TRANSCRIPTIONS_DIR: str = "transcriptions"

cfg = ConfigBase()