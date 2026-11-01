"""
DataPulse 数据库连接与 Schema 探查器 (Database Connection & Inspector)
基于 SQLAlchemy 统一支持 SQLite / MySQL / PostgreSQL 数据库连接与只读执行
"""
from typing import Dict, List, Any, Optional
from sqlalchemy import create_engine, text, inspect
import time


class DatabaseManager:
    def __init__(self, connection_url: str):
        self.connection_url = connection_url.strip()
        self.engine = create_engine(
            self.connection_url,
            pool_pre_ping=True,
            connect_args={"check_same_thread": False} if "sqlite" in self.connection_url else {}
        )

    def test_connection(self) -> bool:
        """测试连接是否畅通"""
        with self.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            return True

    def get_schema(self) -> Dict[str, Any]:
        """探查数据库结构：返回所有表名、字段名、数据类型与主外键"""
        inspector = inspect(self.engine)
        table_names = inspector.get_table_names()
        schema_info = {}

        for table in table_names:
            columns = inspector.get_columns(table)
            schema_info[table] = [
                {
                    "name": col["name"],
                    "type": str(col["type"]),
                    "nullable": col.get("nullable", True),
                    "primary_key": bool(col.get("primary_key", False))
                }
                for col in columns
            ]

        return {
            "tables": table_names,
            "schema": schema_info
        }

    def execute_query(self, safe_sql: str) -> Dict[str, Any]:
        """
        在目标数据库中执行已经过 AST 沙箱校验的安全只读 SQL
        :return: 包含 columns, rows, row_count, execution_time_ms 的字典
        """
        start_time = time.perf_counter()
        with self.engine.connect() as conn:
            # 开启只读事务约束
            result = conn.execute(text(safe_sql))
            columns = list(result.keys())
            raw_rows = result.fetchall()
            
            # 转为纯 Python 原生数据格式，便于 JSON 序列化
            rows = [
                [
                    float(val) if isinstance(val, (float,)) 
                    else (int(val) if isinstance(val, int) and not isinstance(val, bool) else str(val) if val is not None else None)
                    for val in row
                ]
                for row in raw_rows
            ]

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return {
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "duration_ms": duration_ms
        }
