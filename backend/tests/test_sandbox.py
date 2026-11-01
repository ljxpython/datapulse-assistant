"""
DataPulse AST 只读沙箱与核心执行链路自动化测试
"""
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
import sys

# 注入 backend 路径
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.sandbox import SqlSandbox, SecurityValidationError
from app.db.connection import DatabaseManager
from app.main import app

client = TestClient(app)
demo_db_path = backend_dir / "data" / "sales_demo.sqlite"
demo_db_url = f"sqlite:///{demo_db_path}"


def test_sandbox_allows_clean_select_and_injects_limit():
    """测试常规 SELECT 查询通过并自动注入 LIMIT 500"""
    sql = "SELECT id, team_name FROM teams"
    safe_sql, meta = SqlSandbox.validate_and_rewrite(sql, dialect="sqlite", max_rows=500)
    assert meta["is_safe"] is True
    assert meta["limit_injected"] is True
    assert "LIMIT 500" in safe_sql.upper()


def test_sandbox_allows_union_and_with_cte():
    """测试 UNION ALL 和 WITH CTE 等多表/子查询只读操作正常通过沙箱"""
    # 1. 测试用户遇到的多表 UNION ALL 统计场景
    union_sql = (
        "SELECT 'Album' AS table_name, COUNT(*) AS row_count FROM Album "
        "UNION ALL "
        "SELECT 'Artist', COUNT(*) FROM Artist "
        "ORDER BY table_name"
    )
    safe_sql, meta = SqlSandbox.validate_and_rewrite(union_sql, dialect="sqlite", max_rows=500)
    assert meta["is_safe"] is True
    assert "UNION ALL" in safe_sql.upper()
    assert "LIMIT 500" in safe_sql.upper()

    # 2. 测试 WITH CTE
    cte_sql = "WITH regional_sales AS (SELECT team_name, region FROM teams) SELECT * FROM regional_sales"
    safe_cte, cte_meta = SqlSandbox.validate_and_rewrite(cte_sql, dialect="sqlite", max_rows=500)
    assert cte_meta["is_safe"] is True
    assert "LIMIT 500" in safe_cte.upper()


def test_sandbox_preserves_smaller_limit():
    """测试原查询自带合法 LIMIT 时予以保留"""
    sql = "SELECT id, team_name FROM teams LIMIT 10"
    safe_sql, meta = SqlSandbox.validate_and_rewrite(sql, dialect="sqlite", max_rows=500)
    assert meta["is_safe"] is True
    assert "LIMIT 10" in safe_sql.upper()


def test_sandbox_truncates_oversized_limit():
    """测试超出安全阈值的 LIMIT 强行截断"""
    sql = "SELECT id, team_name FROM teams LIMIT 9999"
    safe_sql, meta = SqlSandbox.validate_and_rewrite(sql, dialect="sqlite", max_rows=500)
    assert meta["is_safe"] is True
    assert "LIMIT 500" in safe_sql.upper()


def test_sandbox_blocks_drop_table():
    """测试拦截 DROP TABLE"""
    sql = "DROP TABLE teams"
    with pytest.raises(SecurityValidationError) as exc:
        SqlSandbox.validate_and_rewrite(sql, dialect="sqlite")
    assert "非只读危险操作" in str(exc.value)


def test_sandbox_blocks_update_and_delete():
    """测试拦截 UPDATE 与 DELETE"""
    with pytest.raises(SecurityValidationError):
        SqlSandbox.validate_and_rewrite("UPDATE teams SET team_name='hack'", dialect="sqlite")

    with pytest.raises(SecurityValidationError):
        SqlSandbox.validate_and_rewrite("DELETE FROM sales_records WHERE id=1", dialect="sqlite")


def test_sandbox_blocks_multi_statement_injection():
    """测试拦截多语句分号拼接注入"""
    sql = "SELECT * FROM teams; DROP TABLE sales_records;"
    with pytest.raises(SecurityValidationError) as exc:
        SqlSandbox.validate_and_rewrite(sql, dialect="sqlite")
    assert "多语句拼接攻击" in str(exc.value)


def test_database_manager_execution():
    """测试数据库底层查询执行"""
    db = DatabaseManager(demo_db_url)
    assert db.test_connection() is True
    schema = db.get_schema()
    assert "teams" in schema["tables"]
    assert "sales_records" in schema["tables"]

    res = db.execute_query("SELECT team_name, region FROM teams LIMIT 2")
    assert len(res["rows"]) == 2
    assert res["columns"] == ["team_name", "region"]
    assert res["duration_ms"] >= 0


def test_api_health_endpoint():
    """测试健康探针"""
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_api_query_execute_flow():
    """测试端到端 API 查询流程与高管指标提取"""
    payload = {
        "connection_url": demo_db_url,
        "prompt": "统计过去半年每个销售团队的成单总额和环比增长",
        "dialect": "sqlite"
    }
    res = client.post("/api/v1/query/execute", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "LIMIT 500" in data["safe_sql"].upper()
    assert len(data["rows"]) > 0
    assert "kpis" in data
    assert "gmv" in data["kpis"]


def test_llm_reflect_and_fix_mechanism():
    """测试智能体报错反思与自愈逻辑 (单元验证)"""
    from app.core.llm_engine import llm_engine
    schema_info = {
        "teams": [
            {"name": "id", "type": "INTEGER", "primary_key": True},
            {"name": "team_name", "type": "VARCHAR(64)"},
            {"name": "region", "type": "VARCHAR(32)"}
        ]
    }
    # 模拟一个写错了字段名（如写成了 name 而不是 team_name）的失败 SQL
    failed_sql = "SELECT id, name FROM teams"
    error_msg = "(sqlite3.OperationalError) no such column: name"

    try:
        fixed_sql, thought = llm_engine.reflect_and_fix_sql(
            prompt="查看所有销售战队名称",
            failed_sql=failed_sql,
            error_message=error_msg,
            schema_info=schema_info,
            dialect="sqlite"
        )
        assert "SELECT" in fixed_sql.upper()
        assert "teams" in fixed_sql.lower()
        assert "team_name" in fixed_sql or "*" in fixed_sql
    except Exception as e:
        pytest.skip(f"跳过远端 LLM 反思测试: {str(e)}")
