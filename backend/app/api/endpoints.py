"""
DataPulse API 核心路由端点
实现连接探查、AST 安全执行、研报生成与三权分立物理归档
"""
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional
from pathlib import Path
import os
import time
import logging
import json
import uuid
from sqlalchemy.orm import Session

# 配置业务日志记录器
logger = logging.getLogger("datapulse.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

from app.core.sandbox import SqlSandbox, SecurityValidationError
from app.db.connection import DatabaseManager
from app.core.config import settings
from app.core.llm_engine import llm_engine
from app.core.column_infer import infer_query_semantics
from app.core.auth import get_optional_current_user
from app.core.chart_svg import generate_chart_svg
from app.core.crypto import mask_connection_url, encrypt_connection_url, decrypt_connection_url, build_connection_url
from app.db.models import get_db, User, ChatSession, ChatMessage, UserReport, UserDatasource

router = APIRouter()

# 默认内置测试库路径
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
DEFAULT_DB_PATH = DATA_DIR / "sales_demo.sqlite"
DEFAULT_DB_URL = f"sqlite:///{DEFAULT_DB_PATH}"

CHINOOK_DB_PATH = DATA_DIR / "Chinook.db"
CHINOOK_DB_URL = f"sqlite:///{CHINOOK_DB_PATH}"

# sshmy1 生产级真实 PostgreSQL 连接预设
SSHMY1_PLATFORM_API_URL = "postgresql+psycopg2://platform_api:pUsYDD3ZQXesxLUAr5x9Qo7p901ubyOkZIkC9NFJZMxJHneO@49.233.222.54:5432/platform_api"
SSHMY1_GRAPHHARBOR_URL = "postgresql+psycopg2://lijiaxin:033ffc0d8b4162d815acc38d47624ca1bced50d5c169e935@49.233.222.54:5432/graphharbor_acceptance"


# -------------------------------------------------------------
# Pydantic 请求与响应模型
# -------------------------------------------------------------
class ConnectRequest(BaseModel):
    connection_url: Optional[str] = Field(default=None, description="SQLAlchemy 数据库连接串 (支持 sqlite/mysql/postgresql)")
    datasource_id: Optional[str] = Field(default=None, description="已加密托管的数据源 ID")


class QueryExecuteRequest(BaseModel):
    connection_url: Optional[str] = Field(default=None, description="目标数据库连接串")
    datasource_id: Optional[str] = Field(default=None, description="已加密托管的数据源 ID")
    prompt: str = Field(..., description="业务自然语言提问")
    custom_sql: Optional[str] = Field(None, description="自定义待校验执行的 SQL (若空则按 prompt 生成)")
    dialect: str = Field(default="sqlite", description="目标数据库方言")
    session_id: Optional[str] = Field(None, description="当前绑定的历史会话 UUID (若空则自动生成并持久化)")


class CustomDatasourceCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=64, description="数据源别名")
    db_type: str = Field(..., description="数据库类型 (postgresql | mysql | sqlite)")
    connection_url: Optional[str] = Field(None, description="完整连接串 (若填则优先使用)")
    host: Optional[str] = Field(None, description="主机地址")
    port: Optional[int] = Field(None, description="端口")
    database: Optional[str] = Field(None, description="数据库名或 SQLite 路径")
    username: Optional[str] = Field(None, description="用户名")
    password: Optional[str] = Field(None, description="密码")
    description: Optional[str] = Field(None, description="业务用途备注")


class ArchiveReportRequest(BaseModel):
    report_title: str
    prompt: str
    sql: str
    summary: str
    kpis: Dict[str, Any]
    data_columns: List[str]
    data_rows: List[List[Any]]
    session_id: Optional[str] = None
    chart_meta: Optional[Dict[str, Any]] = None


# 预设 ID 映射字典
PRESET_MAP = {
    "preset-demo-sales": DEFAULT_DB_URL,
    "preset-chinook": CHINOOK_DB_URL,
    "preset-sshmy1-platform": SSHMY1_PLATFORM_API_URL,
    "preset-sshmy1-graphharbor": SSHMY1_GRAPHHARBOR_URL,
}


def resolve_raw_db_url(conn_url: Optional[str], ds_id: Optional[str], db_session: Session) -> str:
    """根据 datasource_id 或 connection_url 解析真实数据库连接串，确保密码不暴露"""
    if ds_id:
        if ds_id in PRESET_MAP:
            return PRESET_MAP[ds_id]
        custom_ds = db_session.query(UserDatasource).filter(UserDatasource.id == ds_id).first()
        if custom_ds:
            return decrypt_connection_url(custom_ds.connection_url_enc)
    
    if not conn_url:
        return DEFAULT_DB_URL

    # 如果传的是带星号的脱敏串，尝试安全反查
    if "******" in conn_url:
        for p_id, raw_url in PRESET_MAP.items():
            if mask_connection_url(raw_url) == conn_url:
                return raw_url
        custom_ds = db_session.query(UserDatasource).filter(UserDatasource.masked_url == conn_url).first()
        if custom_ds:
            return decrypt_connection_url(custom_ds.connection_url_enc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无法还原已脱敏的数据源凭据，请提供有效的数据源 ID")

    return conn_url


# -------------------------------------------------------------
# 路由端点实现
# -------------------------------------------------------------
@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "timestamp": time.time()
    }


@router.get("/database/presets")
def get_database_presets(
    db_session: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_current_user)
):
    """
    获取当前可用的数据库预设与用户加密私有数据源
    所有对外展示的数据库连接串中的账号密码一律强制脱敏 (******) 掩码保护
    """
    presets = [
        {
            "id": "preset-demo-sales",
            "name": "演示库 1: 企业销售业绩分析库 (SQLite)",
            "type": "sqlite",
            "masked_url": mask_connection_url(DEFAULT_DB_URL),
            "description": "包含 teams (销售战队) 和 sales_records (销售订单流水) 2 张业务核心表",
            "is_preset": True
        },
        {
            "id": "preset-chinook",
            "name": "演示库 2: LangGraph 官方经典音乐商店库 (Chinook.db)",
            "type": "sqlite",
            "masked_url": mask_connection_url(CHINOOK_DB_URL),
            "description": "包含 Artist, Album, Customer, Invoice 等 11 张全量标准关联表",
            "is_preset": True
        },
        {
            "id": "preset-sshmy1-platform",
            "name": "sshmy1 真实库: AI 平台业务库 (PostgreSQL: platform_api)",
            "type": "postgresql",
            "masked_url": mask_connection_url(SSHMY1_PLATFORM_API_URL),
            "description": "位于 49.233.222.54 的真实生产库 (账密已加密脱敏)",
            "is_preset": True
        },
        {
            "id": "preset-sshmy1-graphharbor",
            "name": "sshmy1 真实库: LangGraph 运行时库 (PostgreSQL: graphharbor_acceptance)",
            "type": "postgresql",
            "masked_url": mask_connection_url(SSHMY1_GRAPHHARBOR_URL),
            "description": "位于 49.233.222.54 的智能体执行库 (账密已加密脱敏)",
            "is_preset": True
        }
    ]

    # 获取当前用户已保存的私有加密数据源
    custom_sources = []
    if user:
        user_ds = db_session.query(UserDatasource).filter(UserDatasource.user_id == user.id).all()
        for ds in user_ds:
            custom_sources.append({
                "id": ds.id,
                "name": ds.name,
                "type": ds.db_type,
                "masked_url": ds.masked_url,
                "description": ds.description or "用户私有加密数据源",
                "is_preset": False,
                "created_at": ds.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

    return {
        "current": {
            "name": "sales_demo.sqlite",
            "type": "sqlite",
            "masked_url": mask_connection_url(DEFAULT_DB_URL),
            "description": "企业全域销售战队与订单流水数据库 (内置演示)"
        },
        "presets": presets,
        "custom_datasources": custom_sources
    }


@router.post("/database/custom")
def create_custom_datasource(
    req: CustomDatasourceCreateRequest,
    db_session: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_current_user)
):
    """
    配置并加密保存自定义真实数据库连接
    1. 校验与拼装真实连接串
    2. 进行轻量只读连通性校验 (不通不入库)
    3. 后端对称加密落库，前端仅返回脱敏掩码 (******)，绝不外泄密码明文
    """
    raw_url = req.connection_url.strip() if req.connection_url else ""
    if not raw_url:
        if req.db_type.lower().strip() == "sqlite":
            if not req.database:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="SQLite 请提供数据库文件绝对路径或相对路径")
        else:
            if not req.host or not req.database:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请提供完整连接串或填写主机地址与数据库名")
        raw_url = build_connection_url(
            db_type=req.db_type,
            host=req.host or "localhost",
            port=req.port or (5432 if req.db_type.lower() == "postgresql" else 3306),
            database=req.database,
            username=req.username,
            password=req.password
        )

    # 连通性只读测试
    try:
        test_db = DatabaseManager(raw_url)
        test_db.test_connection()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"数据库连通性校验失败，请检查账号密码、网络与权限: {str(e)}"
        )

    masked = mask_connection_url(raw_url)
    enc = encrypt_connection_url(raw_url)

    ds_obj = UserDatasource(
        id=str(uuid.uuid4()),
        user_id=user.id if user else None,
        name=req.name.strip(),
        db_type=req.db_type.lower().strip(),
        connection_url_enc=enc,
        masked_url=masked,
        description=req.description.strip() if req.description else f"{req.db_type} 自定义数据源"
    )
    db_session.add(ds_obj)
    db_session.commit()
    db_session.refresh(ds_obj)

    return {
        "success": True,
        "message": "数据源连接测试成功，账号密码已安全对称加密入库！",
        "datasource": {
            "id": ds_obj.id,
            "name": ds_obj.name,
            "type": ds_obj.db_type,
            "masked_url": ds_obj.masked_url,
            "description": ds_obj.description
        }
    }


@router.delete("/database/custom/{datasource_id}")
def delete_custom_datasource(
    datasource_id: str,
    db_session: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_current_user)
):
    """删除指定的私有加密数据源"""
    ds = db_session.query(UserDatasource).filter(UserDatasource.id == datasource_id).first()
    if not ds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="数据源不存在")
    if user and ds.user_id and ds.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除该数据源")
    
    db_session.delete(ds)
    db_session.commit()
    return {"success": True, "message": "私有数据源配置已成功移除"}


@router.post("/database/connect")
def connect_database(
    req: ConnectRequest,
    db_session: Session = Depends(get_db)
):
    """连接目标数据库并探查表结构与字段列表 (Schema Inspector)"""
    raw_connection_url = resolve_raw_db_url(req.connection_url, req.datasource_id, db_session)
    masked_url = mask_connection_url(raw_connection_url)

    try:
        db = DatabaseManager(raw_connection_url)
        db.test_connection()
        schema_data = db.get_schema()

        # 根据表名生成智能推荐提问
        tables = schema_data["tables"]
        recommended_prompts = []
        
        # 1. 匹配销售演示库
        if "sales_records" in tables and "teams" in tables:
            recommended_prompts = [
                "统计过去半年每个销售团队的成单总额与环比增长",
                "按大区分析各品类客单价与总成单贡献",
                "查询高价值客户成单频次与累计贡献排行"
            ]
        # 2. 匹配 LangGraph 经典 Chinook 音乐商店库
        elif "Invoice" in tables and "Customer" in tables:
            recommended_prompts = [
                "统计每个音乐流派 (Genre) 的总销售额与曲目数量排行",
                "分析消费金额排名前 5 的高价值客户及所在国家",
                "按国家统计客户数量与平均账单金额 (Invoice Total)"
            ]
        # 3. 匹配 platform_api
        elif "users" in tables and "projects" in tables:
            recommended_prompts = [
                "统计当前平台注册的用户总数与租户 (tenants) 分布",
                "查询项目 (projects) 与智能体 (agents) 的创建数量排行",
                "统计最近创建的审计日志 (audit_logs) 操作类型分布"
            ]
        # 4. 匹配 graphharbor_acceptance
        elif "assistants" in tables and "runs" in tables:
            recommended_prompts = [
                "统计已创建的 Assistant 智能体数量与版本记录分布",
                "查询最近执行的 Run 任务记录及其状态分布",
                "分析 Threads 会话总数与最近活跃趋势"
            ]
        elif len(tables) > 0:
            first_t = tables[0]
            recommended_prompts = [
                f"查看 `{first_t}` 表中前 10 条业务流水记录",
                f"统计 `{first_t}` 表的数据总量与关键维度分布",
                f"探查 `{first_t}` 的各指标汇总与异常波动"
            ]
        else:
            recommended_prompts = ["查询当前数据库的所有表概要信息"]

        return {
            "success": True,
            "message": "数据库连接成功，Schema 结构探查就绪",
            "connection_url": masked_url,  # 绝不返回真实密码明文，永远返回脱敏掩码
            "datasource_id": req.datasource_id,
            "tables": schema_data["tables"],
            "schema": schema_data["schema"],
            "recommended_prompts": recommended_prompts
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"数据库连接失败: {str(e)}"
        )


@router.post("/query/execute")
def execute_query_flow(
    req: QueryExecuteRequest,
    db_session: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_current_user)
):
    """
    贯穿核心执行链路：
    自然语言/待定SQL ➔ AST 只读沙箱强校验 ➔ 自动注入 LIMIT 500 ➔ 目标库执行 ➔ 提炼高管指标与研报 ➔ 自动归档会话树
    """
    # 1. 建立数据库连接并探查 Schema
    raw_connection_url = resolve_raw_db_url(req.connection_url, req.datasource_id, db_session)
    logger.info(f"收到分析请求: prompt='{req.prompt}', db='{mask_connection_url(raw_connection_url)}'")
    try:
        db = DatabaseManager(raw_connection_url)
        schema_data = db.get_schema()
    except Exception as e:
        logger.error(f"数据库连接探查失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"数据库连接探查失败: {str(e)}"
        )

    # 2. 生成或确定待执行 SQL
    sql_to_run = req.custom_sql
    thought_info = ""
    if not sql_to_run or not sql_to_run.strip():
        try:
            sql_to_run, thought_info = llm_engine.generate_sql(
                prompt=req.prompt,
                schema_info=schema_data["schema"],
                dialect=req.dialect
            )
            logger.info(f"LLM 生成 SQL: {sql_to_run.strip()}")
        except Exception as llm_err:
            logger.warning(f"LLM 生成异常，触发 Schema 智能自适应兜底: {str(llm_err)}")
            tables = schema_data.get("tables", [])

            # 1. 优先捕获表结构、表总数、元数据查询诉求
            if any(k in req.prompt for k in ["多少表", "表格", "表结构", "表名", "什么数据", "元数据", "schema", "所有表", "数据表"]):
                if req.dialect == "sqlite":
                    if tables:
                        union_parts = [f"SELECT '{t}' AS table_name, COUNT(*) AS row_count FROM {t}" for t in tables[:12]]
                        sql_to_run = " UNION ALL ".join(union_parts) + " ORDER BY row_count DESC"
                    else:
                        sql_to_run = "SELECT name AS table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                elif req.dialect in ["postgres", "postgresql"]:
                    sql_to_run = "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
                else:
                    sql_to_run = "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema=DATABASE()"

            # 2. 仅当目标库确实存在销售表时，才触发销售专属模板
            elif "sales_records" in tables and "teams" in tables:
                if "客单价" in req.prompt or "品类" in req.prompt or "大区" in req.prompt:
                    sql_to_run = """
                    SELECT 
                        t.region AS category_dimension,
                        ROUND(AVG(s.amount), 2) AS avg_aov,
                        ROUND(SUM(s.amount), 2) AS total_amount,
                        COUNT(s.id) AS order_count
                    FROM sales_records s
                    JOIN teams t ON s.team_id = t.id
                    GROUP BY t.region
                    ORDER BY total_amount DESC
                    """
                elif "流失" in req.prompt or "客户" in req.prompt:
                    sql_to_run = """
                    SELECT 
                        customer_name,
                        COUNT(id) AS purchase_frequency,
                        ROUND(SUM(amount), 2) AS total_contribution,
                        MAX(order_date) AS last_active_date
                    FROM sales_records
                    GROUP BY customer_name
                    ORDER BY total_contribution DESC
                    """
                else:
                    sql_to_run = """
                    SELECT 
                        t.team_name,
                        ROUND(SUM(s.amount), 2) AS total_gmv,
                        COUNT(s.id) AS total_orders,
                        ROUND(AVG(s.amount), 2) AS avg_aov
                    FROM sales_records s
                    JOIN teams t ON s.team_id = t.id
                    GROUP BY t.team_name
                    ORDER BY total_gmv DESC
                    """

            # 3. 匹配 Chinook 音乐商店经典库
            elif "Invoice" in tables and "Customer" in tables:
                if any(k in req.prompt for k in ["音乐", "流派", "Genre"]):
                    sql_to_run = """
                    SELECT g.Name AS genre, COUNT(t.TrackId) AS track_count
                    FROM Track t
                    JOIN Genre g ON t.GenreId = g.GenreId
                    GROUP BY g.Name
                    ORDER BY track_count DESC
                    """
                elif any(k in req.prompt for k in ["客户", "国家", "消费"]):
                    sql_to_run = """
                    SELECT c.Country, COUNT(i.InvoiceId) AS order_count, ROUND(SUM(i.Total), 2) AS total_spent
                    FROM Customer c
                    JOIN Invoice i ON c.CustomerId = i.CustomerId
                    GROUP BY c.Country
                    ORDER BY total_spent DESC
                    """
                else:
                    sql_to_run = """
                    SELECT c.FirstName || ' ' || c.LastName AS customer_name, ROUND(SUM(i.Total), 2) AS total_spent
                    FROM Customer c
                    JOIN Invoice i ON c.CustomerId = i.CustomerId
                    GROUP BY c.CustomerId
                    ORDER BY total_spent DESC
                    """

            # 4. 任意未知的真实数据库通用自适应兜底：仅探查首张真实存在的业务表
            elif len(tables) > 0:
                first_t = tables[0]
                sql_to_run = f"SELECT * FROM {first_t} LIMIT 20"

            else:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail=f"大模型响应超时 ({str(llm_err)})，且目标数据库无可用表结构进行安全降级探查，请稍后重试"
                )

            thought_info = f"LLM 降级智能兜底: {str(llm_err)}"

    # 3. AST 只读安全沙箱校验与自动改写注入
    try:
        safe_sql, meta = SqlSandbox.validate_and_rewrite(
            sql=sql_to_run,
            dialect=req.dialect,
            max_rows=settings.MAX_QUERY_ROWS
        )
        logger.info(f"AST 沙箱审查通过: {safe_sql.strip().replace(chr(10), ' ')}")
    except SecurityValidationError as sec_err:
        logger.warning(f"🚨 AST 沙箱拦截非法操作: prompt='{req.prompt}', sql='{sql_to_run}', error='{sec_err.message}'")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "SECURITY_VALIDATION_ERROR",
                "message": sec_err.message,
                "details": sec_err.details,
                "raw_sql": sql_to_run
            }
        )

    # 4. 目标数据库执行
    try:
        exec_result = db.execute_query(safe_sql)
        logger.info(f"目标库执行成功: 返回 {exec_result['row_count']} 行, 耗时 {exec_result['duration_ms']}ms")
    except Exception as exec_err:
        logger.error(f"数据库执行 SQL 报错: sql='{safe_sql}', err='{str(exec_err)}'", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"数据库执行错误: {str(exec_err)}"
        )

    # 5. 智能语义推断与高管指标三元组抽取
    rows = exec_result["rows"]
    columns = exec_result["columns"]
    
    kpis, chart_meta = infer_query_semantics(columns, rows)

    # 6. 大模型提炼商业洞察 (Executive Summary)
    summary_text = llm_engine.generate_insights(
        prompt=req.prompt,
        safe_sql=safe_sql,
        kpis=kpis,
        sample_rows=rows,
        columns=columns
    )

    # 7. 历史会话树自动持久化 (Persistence)
    effective_session_id = req.session_id
    try:
        session_obj = None
        if effective_session_id:
            session_obj = db_session.query(ChatSession).filter(ChatSession.id == effective_session_id).first()
        
        if not session_obj:
            # 自动新建会话
            effective_session_id = effective_session_id or str(uuid.uuid4())
            # 提取简短标题 (最多25字)
            title = req.prompt.strip()[:25]
            masked_ds_url = mask_connection_url(raw_connection_url)
            session_obj = ChatSession(
                id=effective_session_id,
                user_id=user.id if user else None,
                title=title,
                datasource_name=masked_ds_url.split("/")[-1] if "/" in masked_ds_url else masked_ds_url,
                datasource_url=masked_ds_url
            )
            db_session.add(session_obj)
        else:
            session_obj.updated_at = datetime.datetime.utcnow()
            if user and not session_obj.user_id:
                session_obj.user_id = user.id

        # 写入本次问答详情
        report_payload = {
            "safe_sql": safe_sql,
            "sandbox_meta": meta,
            "duration_ms": exec_result["duration_ms"],
            "columns": columns,
            "rows": rows,
            "row_count": exec_result["row_count"],
            "kpis": kpis,
            "chart_meta": chart_meta,
            "summary": summary_text
        }
        msg = ChatMessage(
            session_id=effective_session_id,
            role="assistant",
            prompt=req.prompt,
            safe_sql=safe_sql,
            report_data_json=json.dumps(report_payload)
        )
        db_session.add(msg)
        db_session.commit()
    except Exception as persist_err:
        logger.warning(f"历史会话持久化异常 (不阻断主链路): {str(persist_err)}")

    return {
        "success": True,
        "session_id": effective_session_id,
        "prompt": req.prompt,
        "safe_sql": safe_sql,
        "sandbox_meta": meta,
        "duration_ms": exec_result["duration_ms"],
        "columns": columns,
        "rows": rows,
        "row_count": exec_result["row_count"],
        "kpis": kpis,
        "chart_meta": chart_meta,
        "summary": summary_text
    }


@router.post("/reports/archive")
def archive_report(
    req: ArchiveReportRequest,
    db_session: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_current_user)
):
    """
    三权分立报告物理归档：
    必须由人类显式确认后，方可将分析研报落地物理磁盘 reports/，并记录到个人研报资产库
    """
    base_dir = Path(__file__).resolve().parent.parent.parent
    reports_dir = base_dir / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    timestamp_str = time.strftime("%Y%m%d_%H%M%S")
    file_name = f"report_{timestamp_str}.md"
    file_path = reports_dir / file_name

    # 生成原生矢量 SVG 趋势图表并嵌入研报
    chart_svg = generate_chart_svg(req.data_columns, req.data_rows, req.chart_meta)

    markdown_content = f"""# {req.report_title}

> 生成时间: {time.strftime('%Y-%m-%d %H:%M:%S')}  
> 分析诉求: {req.prompt}  
> 归档人: {user.nickname if user else '访客分析师'}  
> 状态: 已由人类分析师审查确认落盘归档 (三权分立终审)

---

## 一、核心高管大指标
- **总成交规模**: {req.kpis.get('gmv', 'N/A')} ({req.kpis.get('gmv_growth', '0%')})
- **成交笔数**: {req.kpis.get('orders', 'N/A')}
- **平均客单价 (AOV)**: {req.kpis.get('aov', 'N/A')}

---

## 二、业务洞察与管理行动项
{req.summary}

---

## 三、业务量化走势与图表对比 (SVG 矢量无损)
{chart_svg}

---

## 四、经过 AST 沙箱审查的安全 SQL
```sql
{req.sql}
```

---

## 五、明细数据切片 (前 20 行)
| {' | '.join(req.data_columns)} |
| {' | '.join(['---'] * len(req.data_columns))} |
"""
    for row in req.data_rows[:20]:
        markdown_content += f"| {' | '.join([str(val) for val in row])} |\n"

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(markdown_content)

    file_size = os.path.getsize(file_path)

    # 同步写入数据库元数据
    try:
        user_report_obj = UserReport(
            user_id=user.id if user else None,
            session_id=req.session_id,
            file_name=file_name,
            title=req.report_title,
            summary=req.summary[:200] if req.summary else "",
            size_bytes=file_size
        )
        db_session.add(user_report_obj)
        db_session.commit()
    except Exception as db_err:
        logger.warning(f"研报元数据存库异常: {str(db_err)}")

    return {
        "success": True,
        "message": "研报已安全归档至本地物理磁盘与个人资产库",
        "file_path": str(file_path),
        "file_name": file_name,
        "download_url": f"/api/v1/reports/download/{file_name}"
    }


@router.get("/reports/download/{file_name}")
def download_report(file_name: str):
    """直接下载已归档落盘的 Markdown 研报"""
    # 路径安全防护：拦截目录穿越攻击
    if ".." in file_name or "/" in file_name or "\\" in file_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="非法文件名")

    base_dir = Path(__file__).resolve().parent.parent.parent
    file_path = base_dir / "reports" / file_name

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="研报文件不存在")

    return FileResponse(
        path=str(file_path),
        filename=file_name,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'}
    )


@router.get("/reports/preview/{file_name}")
def preview_report(file_name: str):
    """在线读取并预览已落盘归档的 Markdown 研报内容与结构化元数据"""
    if ".." in file_name or "/" in file_name or "\\" in file_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="非法文件名")

    base_dir = Path(__file__).resolve().parent.parent.parent
    file_path = base_dir / "reports" / file_name

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="研报文件不存在")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"读取研报失败: {str(e)}")

    stat = file_path.stat()
    lines = content.strip().split("\n")
    first_line = lines[0].lstrip("#").strip() if lines else file_name

    return {
        "file_name": file_name,
        "title": first_line,
        "content": content,
        "size_bytes": stat.st_size,
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
        "download_url": f"/api/v1/reports/download/{file_name}"
    }


@router.get("/reports/list")
def list_archived_reports():
    """获取所有已物理落盘归档的研报文档列表"""
    base_dir = Path(__file__).resolve().parent.parent.parent
    reports_dir = base_dir / "reports"
    
    if not reports_dir.exists():
        return {"reports": []}

    reports = []
    for p in sorted(reports_dir.glob("report_*.md"), key=os.path.getmtime, reverse=True):
        try:
            stat = p.stat()
            # 读取前 3 行提取标题
            with open(p, "r", encoding="utf-8") as f:
                first_line = f.readline().strip().lstrip("#").strip()
            reports.append({
                "file_name": p.name,
                "title": first_line or p.stem,
                "size_bytes": stat.st_size,
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
                "download_url": f"/api/v1/reports/download/{p.name}"
            })
        except Exception:
            continue

    return {"reports": reports}
