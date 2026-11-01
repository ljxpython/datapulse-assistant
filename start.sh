#!/usr/bin/env bash
set -e

# ==============================================================================
# DataPulse Assistant 一键启动脚本
# ==============================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=================================================="
echo "🚀 启动 DataPulse Assistant"
echo "📂 项目根目录: $ROOT_DIR"
echo "=================================================="

# 1. 检查 Python 虚拟环境
if [ ! -d ".venv" ]; then
    echo "⚡ 首次运行，正在创建 Python 虚拟环境..."
    python3 -m venv .venv
    .venv/bin/pip install -r backend/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
fi

# 2. 检查演示数据库
if [ ! -f "backend/data/sales_demo.sqlite" ]; then
    echo "📦 初始化演示数据库 sales_demo.sqlite..."
    .venv/bin/python backend/app/db/init_demo_db.py
fi

# 3. 检查前端静态产物
if [ ! -d "frontend/dist" ]; then
    echo "🎨 前端静态产物未构建，正在执行 npm run build..."
    npm --prefix frontend install --registry=https://registry.npmmirror.com
    npm --prefix frontend run build
fi

echo "--------------------------------------------------"
echo "✨ 服务就绪，监听公网/本地端口: 8026"
echo "🌐 浏览器打开: http://127.0.0.1:8026"
echo "📖 API 接口文档: http://127.0.0.1:8026/docs"
echo "--------------------------------------------------"

exec .venv/bin/python backend/run.py
