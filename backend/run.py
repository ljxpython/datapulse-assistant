"""
DataPulse Assistant 后端服务本地启动器
"""
import uvicorn
import sys
from pathlib import Path

# 将 backend 加入 sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings

if __name__ == "__main__":
    print(f"==================================================")
    print(f"🚀 启动 {settings.PROJECT_NAME}")
    print(f"📡 监听端口: http://127.0.0.1:{settings.PORT}")
    print(f"📖 交互式 API 文档: http://127.0.0.1:{settings.PORT}/docs")
    print(f"==================================================")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=False,
        log_level="info"
    )
