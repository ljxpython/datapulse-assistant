"""
DataPulse Assistant 数据库凭据脱敏与对称加密安全模块
提供密码脱敏、Fernet AES 对称加密与分段参数安全构造
"""
import re
import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet
from app.core.config import settings

# 从 JWT_SECRET_KEY 派生固定的 32 字节 Fernet 密钥
_derived_key = base64.urlsafe_b64encode(hashlib.sha256(settings.JWT_SECRET_KEY.encode()).digest())
_cipher = Fernet(_derived_key)


def mask_connection_url(url: str) -> str:
    """
    对数据库连接串中的敏感密码进行脱敏遮蔽
    例如: postgresql://admin:MyPass123!@10.0.0.1:5432/db -> postgresql://admin:******@10.0.0.1:5432/db
    """
    if not url:
        return ""
    # 匹配模式: protocol://username:password@host
    pattern = r'(:\/\/[^:]+:)([^@]+)(@)'
    return re.sub(pattern, r'\1******\3', url)


def encrypt_connection_url(raw_url: str) -> str:
    """
    将真实连接串对称加密为密文字符串，防止落盘或泄露
    """
    if not raw_url:
        return ""
    return _cipher.encrypt(raw_url.encode("utf-8")).decode("utf-8")


def decrypt_connection_url(enc_url: str) -> str:
    """
    解密密文，还原供后端执行的真实数据库连接串
    """
    if not enc_url:
        return ""
    try:
        return _cipher.decrypt(enc_url.encode("utf-8")).decode("utf-8")
    except Exception:
        # 如果本身就是未加密的 sqlite 路径，降级原样返回
        return enc_url


def build_connection_url(
    db_type: str,
    host: str,
    port: int,
    database: str,
    username: Optional[str] = None,
    password: Optional[str] = None
) -> str:
    """
    将分段字段安全拼装为标准 SQLAlchemy 驱动连接串
    """
    db_type = db_type.lower().strip()
    if db_type == "sqlite":
        # SQLite 仅需数据库路径
        path = database.strip()
        if not path.startswith("/"):
            return f"sqlite:///{path}"
        return f"sqlite:////{path.lstrip('/')}"

    auth_part = ""
    if username:
        user_enc = username.strip()
        pass_enc = password.strip() if password else ""
        auth_part = f"{user_enc}:{pass_enc}@" if pass_enc else f"{user_enc}@"

    if db_type == "postgresql":
        # 优先使用 psycopg2-binary
        return f"postgresql://{auth_part}{host.strip()}:{port}/{database.strip()}"
    elif db_type == "mysql":
        return f"mysql+pymysql://{auth_part}{host.strip()}:{port}/{database.strip()}"
    else:
        return f"{db_type}://{auth_part}{host.strip()}:{port}/{database.strip()}"
