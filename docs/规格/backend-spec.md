# DataPulse Assistant —— 后端规格说明书 (docs/规格/backend-spec.md)

> **版本**：v1.0.0 (已由用户签署冻结 · DoR 达成)  
> **技术栈**：Python 3.11+ + FastAPI + Pydantic v2 + DuckDB / SQLite + sqlglot  
> **核心职责**：管理数据源、驱动 Pi Agent 生成 SQL、通过 AST 只读沙箱安全执行、通过 SSE 管道流式推送。

---

## 一、REST API 接口规范

### 1. 获取可用数据源列表
- **Endpoint**: `GET /api/v1/sources`
- **Response (200 OK)**:
```json
{
  "sources": [
    {
      "id": "sales_2026",
      "name": "2026年度销售业绩表.sqlite",
      "type": "sqlite",
      "tables": ["orders", "sales_reps", "products"],
      "created_at": "2026-11-01T10:00:00Z"
    }
  ]
}
```

### 2. 挂载/上传新数据源
- **Endpoint**: `POST /api/v1/sources/upload`
- **Request**: Multipart Form Data (`file: .csv / .sqlite / .duckdb`)
- **Validation**:
  - 文件大小限制：<= 100MB
  - 格式强校验：若内容损坏或扩展名不符，直接返回 `HTTP 400 Bad Request`

### 3. 人类确认归档分析报告
- **Endpoint**: `POST /api/v1/reports/archive`
- **Request Body**:
```json
{
  "source_id": "sales_2026",
  "query_text": "统计过去半年销售额",
  "sql": "SELECT ... LIMIT 500",
  "chart_option": { ... },
  "summary_markdown": "分析报告正文..."
}
```
- **Response (201 Created)**:
```json
{
  "report_id": "rep_20261101_001",
  "file_path": "reports/rep_20261101_001.json",
  "archived_at": "2026-11-01T11:30:00Z"
}
```

---

## 二、SSE 流式分析管道规范

- **Endpoint**: `POST /api/v1/query/stream`
- **Request Body**:
```json
{
  "source_id": "sales_2026",
  "prompt": "统计过去半年每个销售员的成单总额和环比增长",
  "session_id": "sess_12345"
}
```
- **Response**: `Content-Type: text/event-stream; charset=utf-8`
- **Event Protocol**:
  1. `event: thinking\ndata: {"content": "正在理解数据结构..."}\n\n`
  2. `event: sql\ndata: {"sql": "SELECT name, SUM(amount) FROM orders GROUP BY name LIMIT 500"}\n\n`
  3. `event: execution\ndata: {"status": "running", "step": "AST 只读语法树校验"}\n\n`
  4. `event: data\ndata: {"columns": ["name", "total"], "rows": [["张三", 120000]], "total_rows": 1, "duration_ms": 12.5}\n\n`
  5. `event: chart\ndata: {"chart_type": "bar", "option": { ... }}\n\n`
  6. `event: summary\ndata: {"chunk": "从数据可以看出..."}\n\n`
  7. `event: done\ndata: {"status": "completed"}\n\n`
  - 异常事件：`event: error\ndata: {"code": "SQL_VALIDATION_FAILED", "message": "检测到危险写操作语句，已被只读沙箱拦截！", "details": "DROP TABLE is forbidden"}\n\n`

---

## 三、AST 只读沙箱安全机制

1. **语法解析**：使用 `sqlglot.parse_one(sql, read=dialect)` 解析为抽象语法树（AST）；
2. **根表达式校验**：根节点必须为 `sqlglot.exp.Select`，任何 `Insert`, `Update`, `Delete`, `Drop`, `Alter` 立即抛出 `SecurityValidationError`；
3. **多语句拼接封杀**：禁止包含分号 `;` 触发的多语句批量注入；
4. **强制行数截断**：若 AST 中无 `LIMIT` 子句，自动通过语法树注入 `LIMIT 500`；若已有 `LIMIT` 且大于 500，强行将其改写为 500；
5. **底层数据库连接加固**：
   - SQLite: 打开路径追加 `?mode=ro` 只读连接；
   - DuckDB: 使用 `duckdb.connect(database, read_only=True)` 打开连接。
