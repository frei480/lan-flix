from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


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
    SECRET_KEY: str

    @property
    def videos_dir_absolute(self) -> Path:
        """Возвращает абсолютный путь к директории с видео."""
        return Path(self.VIDEOS_DIR).resolve()

    @property
    def transcriptions_dir_absolute(self) -> Path:
        """Возвращает абсолютный путь к директории с транскрипциями."""
        return Path(self.TRANSCRIPTIONS_DIR).resolve()


cfg = ConfigBase()
