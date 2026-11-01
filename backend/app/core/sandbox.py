"""
DataPulse AST 只读安全沙箱 (AST Read-Only Sandbox)
基于 sqlglot 抽象语法树实现严格的非只读语句拦截与 LIMIT 自动改写注入
"""
import sqlglot
from sqlglot import exp
from typing import Tuple


class SecurityValidationError(Exception):
    """只读安全校验异常：拦截到非法写操作或多语句注入"""
    def __init__(self, message: str, details: str = ""):
        super().__init__(message)
        self.message = message
        self.details = details


class SqlSandbox:
    @staticmethod
    def validate_and_rewrite(sql: str, dialect: str = "sqlite", max_rows: int = 500) -> Tuple[str, dict]:
        """
        对输入的 SQL 语句进行严格的只读 AST 校验，并自动注入 LIMIT 约束。
        
        :param sql: 待校验的原始 SQL 字符串
        :param dialect: 数据库方言 ('sqlite', 'mysql', 'postgres')
        :param max_rows: 最大允许返回行数 (默认 500)
        :return: (安全改写后的 SQL 字符串, 校验元数据字典)
        """
        cleaned_sql = sql.strip()
        if not cleaned_sql:
            raise SecurityValidationError("SQL 语句不能为空")

        # 1. 语法树多语句解析 (防止分号批量注入)
        try:
            parsed_statements = sqlglot.parse(cleaned_sql, read=dialect)
        except Exception as e:
            raise SecurityValidationError(f"SQL 语法解析失败: {str(e)}")

        if not parsed_statements:
            raise SecurityValidationError("未检测到有效的 SQL 语句")

        if len(parsed_statements) > 1:
            raise SecurityValidationError(
                "检测到多语句拼接攻击！",
                details=f"输入包含 {len(parsed_statements)} 条独立语句，沙箱仅允许单条只读 SELECT"
            )

        root = parsed_statements[0]

        # 2. 根节点类型强校验 (必须为只读 Query 查询，支持 Select, Union, Intersect, Except 等)
        if not isinstance(root, exp.Query):
            # 获取非法操作类型名称
            statement_type = root.key.upper() if hasattr(root, "key") else type(root).__name__
            raise SecurityValidationError(
                f"检测到非只读危险操作 [{statement_type}]，已被 AST 沙箱阻断！",
                details=f"仅允许 SELECT / UNION 等只读查询语句，严禁执行 DROP, UPDATE, DELETE, INSERT, ALTER 等变更操作"
            )

        # 3. 递归遍历检查是否存在非只读子表达式 (如 SELECT ... INTO OUTFILE 或内部写操作)
        dangerous_node_types = (
            exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Alter,
            exp.Create, exp.Command, exp.Commit, exp.Rollback
        )
        for node in root.walk():
            if isinstance(node, dangerous_node_types):
                raise SecurityValidationError(
                    f"查询中包含嵌套的非法写操作节点 [{type(node).__name__}]！已被沙箱拦截！"
                )

        # 4. LIMIT 自动改写与注入
        limit_node = root.args.get("limit")
        injected = False
        if limit_node is None:
            # 原 SQL 无 LIMIT，自动在 AST 根节点追加 LIMIT 500
            root = root.limit(max_rows)
            injected = True
        else:
            # 原 SQL 已有 LIMIT，检查其数值
            try:
                curr_limit = int(limit_node.expression.this)
                if curr_limit > max_rows:
                    # 超过阈值，强行截断为 max_rows
                    limit_node.expression.this = str(max_rows)
                    injected = True
            except Exception:
                # 无法解析的具体数值表达式，强制替换为数字 max_rows
                root = root.limit(max_rows)
                injected = True

        safe_sql = root.sql(dialect=dialect, pretty=True)
        meta = {
            "is_safe": True,
            "dialect": dialect,
            "limit_injected": injected,
            "max_rows": max_rows
        }
        return safe_sql, meta
