"""
DataPulse Assistant 核心全局配置
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from pathlib import Path

# 定位项目根目录下的 .env
PROJECT_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE_PATH = PROJECT_ROOT / ".env"
if not ENV_FILE_PATH.exists():
    ENV_FILE_PATH = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "DataPulse Assistant"
    API_V1_PREFIX: str = "/api/v1"
    PORT: int = 8026
    MAX_QUERY_ROWS: int = 500
    QUERY_TIMEOUT_SECONDS: int = 10
    
    # Text-to-SQL 大模型调用配置 (兼容 OpenAI 规范)
    LLM_BASE_URL: str = "https://xiaok.lol/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "deepseek-v4.1-flash"
    
    # CORS 跨域配置
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8026",
        "http://127.0.0.1:8026",
        "*"
    ]

    # JWT 认证配置
    JWT_SECRET_KEY: str = "datapulse-super-secret-key-2026-auth-jwt-token"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7天

    # 系统主元数据库路径
    MASTER_DB_PATH: str = str(Path(__file__).resolve().parents[2] / "data" / "datapulse_master.db")

    model_config = SettingsConfigDict(env_file=str(ENV_FILE_PATH), extra="ignore")


settings = Settings()
