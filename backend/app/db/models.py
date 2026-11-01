"""
DataPulse Assistant 系统主元数据库模型与引擎 (SQLAlchemy)
管理用户鉴权、历史对话会话树 (ChatSessions) 与用户落盘研报资产 (UserReports)
"""
import os
import json
import uuid
import datetime
from pathlib import Path
from typing import Generator

from sqlalchemy import (
    create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session
import bcrypt

from app.core.config import settings

# 确保 data 目录存在
master_db_dir = Path(settings.MASTER_DB_PATH).parent
master_db_dir.mkdir(parents=True, exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{settings.MASTER_DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """用户认证与权限表"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    nickname = Column(String(64), nullable=True)
    role = Column(String(16), default="analyst")  # 'admin' | 'analyst' | 'viewer'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("UserReport", back_populates="user", cascade="all, delete-orphan")
    datasources = relationship("UserDatasource", back_populates="user", cascade="all, delete-orphan")


class ChatSession(Base):
    """历史对话会话树总表"""
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    datasource_name = Column(String(128), default="sales_demo.sqlite")
    datasource_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    user = relationship("User", back_populates="sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id")


class ChatMessage(Base):
    """历史对话明细消息 (包含每次执行的 SQL、KPI 与图表元数据)"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True, nullable=False)
    role = Column(String(16), nullable=False)  # 'user' | 'assistant'
    prompt = Column(Text, nullable=True)
    safe_sql = Column(Text, nullable=True)
    report_data_json = Column(Text, nullable=True)  # 完整研报 JSON 序列化
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")


class UserReport(Base):
    """用户已确认落盘的研报库元数据"""
    __tablename__ = "user_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id = Column(String(36), nullable=True)
    file_name = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=True)
    size_bytes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="reports")


class UserDatasource(Base):
    """用户已加密保存的私有数据源配置"""
    __tablename__ = "user_datasources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(64), nullable=False)
    db_type = Column(String(16), nullable=False)  # 'postgresql' | 'mysql' | 'sqlite'
    connection_url_enc = Column(Text, nullable=False)  # Fernet 对称加密密文
    masked_url = Column(String(255), nullable=False)   # 脱敏展示串
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="datasources")


def get_db() -> Generator[Session, None, None]:
    """FastAPI 依赖注入 Session 生成器"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    """使用 bcrypt 生成强单向哈希"""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """校验 bcrypt 密码"""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def init_master_db():
    """初始化数据库并植入默认演示体验账号"""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                password_hash=hash_password("datapulse2026"),
                nickname="首席数据洞察官",
                role="admin"
            )
            db.add(admin_user)
            db.commit()
            print("✓ 系统主库初始化成功，内置演示账号已生成 (admin / datapulse2026)")
    finally:
        db.close()
