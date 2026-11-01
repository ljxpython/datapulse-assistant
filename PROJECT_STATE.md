# DataPulse Assistant —— 项目运行状态与已验证存盘 (PROJECT_STATE.md)

> **更新时间**：2026-11-01  
> **当前阶段**：`M6 - 用户体系与个人资产工作台 (User Workspace)` (M5 已达成)  
> **当前事实与存盘点**：阶段 M0 ~ M6 全部通过！
> 1. 本地与服务器环境均已接入 Xiaok 中转站 DeepSeek 模型；
> 2. 真实 Text-to-SQL + AST 沙箱只读改写 (LIMIT 500) + 商业洞察提炼已 100% 跑通；
> 3. 已支持用户登录认证 (JWT)、会话历史树自动持久化 (ChatSessions)、落盘研报管理 (UserReports)；
> 4. 支持研报物理落盘与浏览器一键直接下载 (.md) 及归档库弹窗；
> 5. 彻底修复数值列与图表轴识别 Bug（GMV/AOV 0.00 与图表折线水平死线已彻底根除）；
> 6. 已同步部署至腾讯云服务器 `sshmy2` (`152.136.27.196:8026`)，生产守护进程正常运行，公网端到端验证通过！

---

## 一、当前已验证事实 (Verified Facts)

- [x] 工程规范继承完成：已将课程 Part 4 标准规范导入 `docs/方法/`
- [x] AI 宪法落地完成：`AGENTS.md` 确立三权分立与四不原则
- [x] 项目入口与看板完成：`00-项目入口.md` 与 `PLAN.md` 建立门禁机制
- [x] 交互式原型已就绪：包含暗夜极客、企业专业、落地页三款风格热切换与全量可点击 Mock
- [x] 前端风格与交互形态拍板：已确认采纳【方案 A：Notion / Hex 交互研报画布流 (The Clean Canvas)】
- [x] 业务需求场景已定调：输入真实数据库连接 ➔ 探查 Schema ➔ Text-to-SQL ➔ 研报呈现
- [x] 阶段 M4 Text-to-SQL 智能引擎打通：
  - 接入 Xiaok 中转站 (`https://xiaok.lol/v1`, `deepseek-v4.1-flash`)
  - Schema 动态提示词注入 + AST 只读强约束拦截 + LIMIT 500 自动注入
  - 真实数据高管管理洞察实时提炼
  - 凭据隔离与 Git 保护：`.env` 被 `.gitignore` 严格忽略，提供 `.env.example`
- [x] 阶段 M5 研报落盘与直接下载打通：
  - 人类分析师显式点击「确认落盘」后方写入磁盘 `reports/` 目录
  - 自动触发浏览器原生文件下载，提供归档文档库弹窗
- [x] 阶段 M6 用户鉴权体系与个人资源工作台打通：
  - JWT Bearer Token 规范无状态认证 (`/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`)
  - 首次访问呈现高颜值独立登录前台 (`AuthPage.tsx`)，支持账号登录、快速注册、演示免密一键登入及访客快速体验
  - 历史会话树自动持久化至 `datapulse_master.db`，支持会话列表检索、单会话画布恢复、会话删除
  - 个人落盘研报资产库 (`/api/v1/user/reports`)，支持在线大屏图文排版预览与原始 Markdown 源码双模式
  - 修复多数据源切换上下文隔离机制：切换数据库自动重置画布旧卡片与会话，展示目标库专属推荐探查
  - 游客数据一键平滑同步至注册/登录账号 (`/api/v1/user/sync`)
  - 修复数值语义识别与图表 X/Y 轴映射，KPI 与图表 100% 精准
- [x] 腾讯云 `sshmy2` (152.136.27.196:8026) 生产部署与验证完成

---

## 二、部署与公网交付信息 (Deployment Specs)

- **公网访问入口**：`http://152.136.27.196:8026/`
- **交互式 API 文档**：`http://152.136.27.196:8026/docs`
- **默认极客演示账号**：`admin` / `datapulse2026`
- **服务器位置**：`sshmy2` (`/home/ubuntu/datapulse-assistant/`)
- **运维控制**：
  - 启动：`/home/ubuntu/datapulse-assistant/start_server.sh`
  - 停止：`/home/ubuntu/datapulse-assistant/stop_server.sh`
  - 状态：`/home/ubuntu/datapulse-assistant/status_server.sh`
  - 日志：`tail -f /home/ubuntu/datapulse-assistant/app.log`
