"""
测试用户鉴权、历史会话管理与落盘研报资产模块
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.models import init_master_db

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_master_db()


def test_auth_login_default_admin():
    """测试默认内置管理员账号登录"""
    resp = client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "datapulse2026"
    })
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["username"] == "admin"
    assert data["user"]["role"] == "admin"


def test_auth_register_and_me():
    """测试新用户注册与通过 Token 访问 /auth/me"""
    import time
    uname = f"analyst_{int(time.time())}"
    reg_resp = client.post("/api/v1/auth/register", json={
        "username": uname,
        "password": "mypassword123",
        "nickname": "资深业务分析师"
    })
    assert reg_resp.status_code == 200, reg_resp.text
    reg_data = reg_resp.json()
    token = reg_data["access_token"]

    # 验证 me
    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["username"] == uname
    assert me_data["nickname"] == "资深业务分析师"


def test_user_session_lifecycle():
    """测试创建会话、保存问答记录、拉取会话列表与删除会话"""
    # 1. 登录
    login_resp = client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "datapulse2026"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. 执行查询，自动持久化会话
    exec_resp = client.post(
        "/api/v1/query/execute",
        headers=headers,
        json={
            "prompt": "统计各战队总成单金额与客单价",
            "dialect": "sqlite"
        }
    )
    assert exec_resp.status_code == 200, exec_resp.text
    exec_data = exec_resp.json()
    session_id = exec_data.get("session_id")
    assert session_id is not None

    # 3. 拉取用户的会话列表
    sessions_resp = client.get("/api/v1/user/sessions", headers=headers)
    assert sessions_resp.status_code == 200
    sessions_list = sessions_resp.json()["sessions"]
    assert any(s["id"] == session_id for s in sessions_list)

    # 4. 获取特定会话的明细
    detail_resp = client.get(f"/api/v1/user/sessions/{session_id}", headers=headers)
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert len(detail_data["messages"]) >= 1

    # 5. 删除会话
    del_resp = client.delete(f"/api/v1/user/sessions/{session_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True


def test_report_archive_and_preview():
    """测试研报物理归档与在线预览内容"""
    arc_resp = client.post("/api/v1/reports/archive", json={
        "report_title": "自动化测试研报标题",
        "prompt": "测试自然语言问题",
        "sql": "SELECT 100 AS test_col",
        "summary": "这是自动化测试生成的洞察内容。",
        "kpis": {"gmv": "¥ 100.00", "orders": "1 笔", "aov": "¥ 100.00"},
        "data_columns": ["test_col"],
        "data_rows": [[100]]
    })
    assert arc_resp.status_code == 200, arc_resp.text
    file_name = arc_resp.json()["file_name"]

    # 测试预览接口
    prev_resp = client.get(f"/api/v1/reports/preview/{file_name}")
    assert prev_resp.status_code == 200, prev_resp.text
    prev_data = prev_resp.json()
    assert prev_data["file_name"] == file_name
    assert "自动化测试研报标题" in prev_data["content"]
    assert "SELECT 100 AS test_col" in prev_data["content"]


def test_datasource_security_masking_and_custom_vault():
    """测试数据源密码脱敏、加密安全存储与密柜生命周期"""
    # 1. 登录
    login_resp = client.post("/api/v1/auth/login", json={
        "username": "admin",
        "password": "datapulse2026"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. 获取预设数据源，确保所有密码都已脱敏为 ******，绝无明文泄漏
    presets_resp = client.get("/api/v1/database/presets", headers=headers)
    assert presets_resp.status_code == 200
    presets_data = presets_resp.json()
    all_presets = presets_data.get("presets", [])
    assert len(all_presets) >= 4
    for ps in all_presets:
        if "@" in ps["masked_url"]:
            assert "******" in ps["masked_url"]
            # 确保绝对不包含真实密码明文
            assert "lijiaxin2026" not in ps["masked_url"]

    # 3. 接入新私有数据源 (使用本地 SQLite 测试加密存储)
    from pathlib import Path
    demo_db_path = str(Path(__file__).resolve().parent.parent / "data" / "sales_demo.sqlite")
    custom_resp = client.post("/api/v1/database/custom", headers=headers, json={
        "name": "单元测试私有库",
        "db_type": "sqlite",
        "database": demo_db_path,
        "description": "测试密柜加密"
    })
    assert custom_resp.status_code == 200, custom_resp.text
    custom_data = custom_resp.json()["datasource"]
    ds_id = custom_data["id"]
    assert ds_id is not None
    assert f"sqlite:///{demo_db_path}" == custom_data["masked_url"]

    # 4. 验证 /database/connect 通过 datasource_id 正常探查 Schema
    conn_resp = client.post("/api/v1/database/connect", json={
        "connection_url": custom_data["masked_url"],
        "datasource_id": ds_id
    })
    assert conn_resp.status_code == 200, conn_resp.text
    schema = conn_resp.json()
    assert schema["success"] is True
    assert len(schema["tables"]) > 0

    # 5. 删除自定义数据源
    del_ds_resp = client.delete(f"/api/v1/database/custom/{ds_id}", headers=headers)
    assert del_ds_resp.status_code == 200
    assert del_ds_resp.json()["success"] is True


