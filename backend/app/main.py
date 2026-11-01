"""
DataPulse Assistant 主应用入口 (FastAPI Entrypoint)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

from app.core.config import settings
from app.db.models import init_master_db
from app.api.endpoints import router as api_router
from app.api.auth_endpoints import router as auth_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="企业级 Text-to-SQL 智能数据分析与研报生成助手 (只读 AST 沙箱防护版)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# 启动时确保元数据库表结构存在并植入默认账号
@app.on_event("startup")
def on_startup():
    init_master_db()

# 允许跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 核心路由与鉴权用户工作台路由
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)

# 前端生产静态资产挂载 (如果 dist 存在)
dist_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if dist_path.exists():
    app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="static_dist")
