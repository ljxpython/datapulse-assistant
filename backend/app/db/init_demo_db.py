"""
生成演示用的 sales_demo.sqlite 真实业务数据库
"""
import sqlite3
import os
from pathlib import Path
from datetime import date, timedelta


def init_demo_sqlite(db_path: str = None):
    if db_path is None:
        base_dir = Path(__file__).resolve().parent.parent.parent
        data_dir = base_dir / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        db_path = str(data_dir / "sales_demo.sqlite")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. 创建战队表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_name TEXT NOT NULL,
        leader TEXT NOT NULL,
        region TEXT NOT NULL
    )
    """)

    # 2. 创建销售记录表
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sales_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL UNIQUE,
        team_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        customer_name TEXT NOT NULL,
        order_date TEXT NOT NULL,
        FOREIGN KEY (team_id) REFERENCES teams (id)
    )
    """)

    # 清空旧数据防止重复
    cursor.execute("DELETE FROM sales_records")
    cursor.execute("DELETE FROM teams")

    # 插入战队
    teams_data = [
        (1, "华东战略战队", "张绍华", "华东"),
        (2, "华北大区开拓组", "李铁柱", "华北"),
        (3, "华南大客户组", "陈雅芝", "华南"),
        (4, "西南新兴市场部", "王建国", "西南"),
        (5, "出海跨境运营中心", "赵露丝", "海外")
    ]
    cursor.executemany("INSERT INTO teams VALUES (?, ?, ?, ?)", teams_data)

    # 动态生成基于当前日期的最近 6 个月真实销售流水
    today = date.today()
    d1 = (today - timedelta(days=10)).isoformat()
    d2 = (today - timedelta(days=35)).isoformat()
    d3 = (today - timedelta(days=65)).isoformat()
    d4 = (today - timedelta(days=95)).isoformat()
    d5 = (today - timedelta(days=130)).isoformat()

    sales_data = [
        ("ORD-2026-001", 1, 450000.0, "上海微创电子", d1),
        ("ORD-2026-002", 1, 520500.0, "苏州恒力智能", d2),
        ("ORD-2026-003", 1, 450000.0, "杭州阿里云算力", d3),
        ("ORD-2026-004", 2, 380200.0, "北京京东方科技", d1),
        ("ORD-2026-005", 2, 600000.0, "天津力神电池", d3),
        ("ORD-2026-006", 3, 512000.0, "深圳大疆科技", d2),
        ("ORD-2026-007", 3, 300000.0, "广州广汽埃安", d4),
        ("ORD-2026-008", 4, 185800.0, "成都通威太阳能", d3),
        ("ORD-2026-009", 4, 230000.0, "重庆长安新能源", d5),
        ("ORD-2026-010", 5, 214000.0, "新加坡SEA电商", d2)
    ]
    cursor.executemany("INSERT INTO sales_records (order_no, team_id, amount, customer_name, order_date) VALUES (?, ?, ?, ?, ?)", sales_data)

    conn.commit()
    conn.close()
    return db_path


if __name__ == "__main__":
    path = init_demo_sqlite()
    print(f"✓ 演示数据库已就绪: {path}")
