#!/usr/bin/env bash
APP_DIR="/home/ubuntu/datapulse-assistant"
PID_FILE="$APP_DIR/app.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "🛑 正在停止服务 (PID: $PID)..."
        kill "$PID"
        sleep 1
        if ps -p "$PID" > /dev/null 2>&1; then
            kill -9 "$PID"
        fi
        echo "✓ 服务已停止"
    else
        echo "服务未运行"
    fi
    rm -f "$PID_FILE"
else
    echo "未找到 PID 文件"
fi
