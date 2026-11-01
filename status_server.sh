#!/usr/bin/env bash
APP_DIR="/home/ubuntu/datapulse-assistant"
PID_FILE="$APP_DIR/app.pid"

echo "================== DataPulse 状态检查 =================="
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✓ 服务状态: 运行中 (PID: $PID)"
        ps -p "$PID" -o pid,user,%cpu,%mem,vsz,rss,stat,start,time,command
    else
        echo "❌ PID 文件存在但进程已退出"
    fi
else
    echo "⚪ 服务未运行"
fi

echo "------------------ 8026 端口监听 ------------------"
sudo netstat -tlpn 2>/dev/null | grep 8026 || ss -tulpn | grep 8026
echo "========================================================"
