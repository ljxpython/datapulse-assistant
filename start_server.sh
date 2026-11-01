#!/usr/bin/env bash
set -e

APP_DIR="/home/ubuntu/datapulse-assistant"
cd "$APP_DIR"

PID_FILE="$APP_DIR/app.pid"
LOG_FILE="$APP_DIR/app.log"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "⚠️ 服务已在运行中 (PID: $PID)"
        exit 0
    else
        rm -f "$PID_FILE"
    fi
fi

echo "🚀 正在启动 DataPulse Assistant 守护进程 (端口 8026)..."
nohup .venv/bin/python backend/run.py > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

sleep 2
if ps -p $(cat "$PID_FILE") > /dev/null 2>&1; then
    echo "✓ 服务启动成功！PID: $(cat "$PID_FILE")"
    echo "📋 访问日志: tail -f $LOG_FILE"
else
    echo "❌ 启动失败，请检查日志: cat $LOG_FILE"
    exit 1
fi
