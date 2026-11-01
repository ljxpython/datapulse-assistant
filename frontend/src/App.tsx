import React, { useState, useEffect } from 'react';
import { TopHeader } from './components/TopHeader';
import { SchemaSidebar } from './components/SchemaSidebar';
import { SearchCapsule } from './components/SearchCapsule';
import { OnboardingHero } from './components/OnboardingHero';
import { ReportBlock } from './components/ReportBlock';
import { DatabaseModal } from './components/DatabaseModal';
import { ArchivedModal } from './components/ArchivedModal';
import { LoginModal } from './components/LoginModal';
import { WorkspaceDrawer } from './components/WorkspaceDrawer';
import { AuthPage } from './components/AuthPage';
import { ReportBlockData, DatabaseSchema, User } from './types';
import { Trash2, Plus } from 'lucide-react';

const API_BASE = '/api/v1';
const STORAGE_KEY = 'datapulse_report_blocks_v1';

export const App: React.FC = () => {
  // 1. 用户鉴权状态与访客试玩模式
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('datapulse_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isWorkspaceDrawerOpen, setIsWorkspaceDrawerOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // 2. 画布上的研报卡片
  const [blocks, setBlocks] = useState<ReportBlockData[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 数据库连接与 Schema 状态
  const [currentDbUrl, setCurrentDbUrl] = useState<string>('sqlite:///backend/data/sales_demo.sqlite');
  const [currentDatasourceId, setCurrentDatasourceId] = useState<string | undefined>(undefined);
  const [schemaData, setSchemaData] = useState<DatabaseSchema | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [injectedText, setInjectedText] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // 持久化 blocks 到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
    } catch (e) {
      console.error("保存本地历史失败", e);
    }
  }, [blocks]);

  // 3. 初始化：健康检查 + 校验用户 Token + 加载默认 Schema
  useEffect(() => {
    const init = async () => {
      // 探针
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) setServerStatus('online');
        else setServerStatus('offline');
      } catch {
        setServerStatus('offline');
      }

      // 验证已存的用户 Token
      const token = localStorage.getItem('datapulse_token');
      if (token) {
        try {
          const meRes = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (meRes.ok) {
            const userData = await meRes.json();
            setCurrentUser(userData);
            localStorage.setItem('datapulse_user', JSON.stringify(userData));
          } else {
            // Token 失效
            localStorage.removeItem('datapulse_token');
            localStorage.removeItem('datapulse_user');
            setCurrentUser(null);
          }
        } catch {
          // 网络异常保留本地状态
        }
      }

      loadDatabaseSchema(currentDbUrl);
    };
    init();
  }, []);

  // 加载并探查数据库 Schema
  const loadDatabaseSchema = async (connUrl: string, dsId?: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/database/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          connection_url: connUrl,
          datasource_id: dsId 
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSchemaData(data);
        setCurrentDbUrl(connUrl);
        setCurrentDatasourceId(dsId);
        return true;
      } else {
        const err = await res.json().catch(() => ({ detail: '连接失败' }));
        showToast(`❌ 数据库连接失败: ${err.detail}`);
        return false;
      }
    } catch (e: any) {
      showToast(`网络错误: ${e.message}`);
      return false;
    }
  };

  // 用户主动在数据源中心切换新数据库 (彻底解决旧数据混杂问题)
  const handleApplyDatabase = async (connUrl: string, dsId?: string): Promise<boolean> => {
    const ok = await loadDatabaseSchema(connUrl, dsId);
    if (ok) {
      // 切换新数据库后：清空旧库研报卡片、重置会话，展示新库专属推荐和引导！
      setBlocks([]);
      setCurrentSessionId(null);
      const dbName = connUrl.split('/').pop() || connUrl;
      showToast(`✅ 已成功切换至数据库: ${dbName}，已为您重置画布上下文`);
    }
    return ok;
  };

  // 4. 用户登录成功回调并无感同步本地离线资产
  const handleLoginSuccess = async (user: User, token: string) => {
    setCurrentUser(user);
    setIsGuestMode(false);
    setIsLoginModalOpen(false);
    showToast(`👋 欢迎回来，${user.nickname || user.username}！`);

    // 如果本地有离线研报，自动同步到该账号
    if (blocks.length > 0) {
      try {
        const syncPayload = {
          sessions: [{
            id: currentSessionId || undefined,
            title: blocks[0]?.title || '离线同步会话',
            datasource_url: currentDbUrl,
            messages: blocks.map(b => ({
              role: 'assistant',
              prompt: b.prompt,
              safe_sql: b.safe_sql,
              report_data: b
            }))
          }],
          reports: blocks.filter(b => b.archived && b.fileName).map(b => ({
            file_name: b.fileName,
            title: b.title,
            summary: b.summary,
            session_id: currentSessionId
          }))
        };

        const syncRes = await fetch(`${API_BASE}/user/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(syncPayload)
        });

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          showToast(`☁️ ${syncData.message}`);
        }
      } catch (err) {
        console.warn('离线数据自动同步异常:', err);
      }
    }
  };

  // 退出登录：清除凭据，平滑退回登录前台
  const handleLogout = () => {
    localStorage.removeItem('datapulse_token');
    localStorage.removeItem('datapulse_user');
    setCurrentUser(null);
    setIsGuestMode(false);
    setIsWorkspaceDrawerOpen(false);
    showToast("已退出当前账号，已返回登录中心");
  };

  // 开启新会话
  const handleNewSession = () => {
    setCurrentSessionId(null);
    setBlocks([]);
    showToast("✨ 已开启全新业务分析会话");
  };

  // 从工作台恢复历史会话到画布
  const handleRestoreSession = async (sessionId: string) => {
    const token = localStorage.getItem('datapulse_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/user/sessions/${sessionId}`, { headers });
      if (!res.ok) throw new Error('拉取历史会话失败');
      
      const sessionDetail = await res.json();
      setCurrentSessionId(sessionDetail.id);

      // 还原数据库连接
      if (sessionDetail.datasource_url && sessionDetail.datasource_url !== currentDbUrl) {
        loadDatabaseSchema(sessionDetail.datasource_url);
      }

      // 将历史 messages 还原为 blocks
      const restoredBlocks: ReportBlockData[] = sessionDetail.messages.map((m: any, idx: number) => {
        const rData = m.report_data || {};
        return {
          id: `restored-${sessionId}-${m.id || idx}`,
          sessionId: sessionId,
          createdAt: m.created_at || new Date().toLocaleTimeString(),
          title: m.prompt || '历史研报',
          prompt: m.prompt || '',
          safe_sql: m.safe_sql || rData.safe_sql || '',
          status: 'success',
          summary: rData.summary || '',
          kpis: rData.kpis || { gmv: '¥ 0.00', orders: '0 笔', aov: '¥ 0.00', gmv_growth: '0.0%' },
          chart_meta: rData.chart_meta,
          columns: rData.columns || [],
          rows: rData.rows || [],
          row_count: rData.row_count || 0,
          duration_ms: rData.duration_ms || 10,
          sandbox_meta: rData.sandbox_meta || { is_safe: true, dialect: 'sqlite', limit_injected: true, max_rows: 500 }
        };
      });

      setBlocks(restoredBlocks);
      showToast(`💬 已成功恢复历史会话: "${sessionDetail.title}"`);
    } catch (err: any) {
      showToast(`❌ 恢复失败: ${err.message}`);
    }
  };

  // 5. 执行自然语言 Text-to-SQL 研报生成
  const handleQuery = async (promptText: string) => {
    setIsLoading(true);
    const timestampStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const token = localStorage.getItem('datapulse_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/query/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: promptText,
          connection_url: currentDbUrl,
          datasource_id: currentDatasourceId,
          dialect: currentDbUrl.includes('mysql') ? 'mysql' : currentDbUrl.includes('postgres') ? 'postgres' : 'sqlite',
          session_id: currentSessionId || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: '服务响应异常' }));
        const detailObj = typeof errData.detail === 'object' ? errData.detail : { message: String(errData.detail) };

        const errorBlock: ReportBlockData = {
          id: `error-${Date.now()}`,
          sessionId: currentSessionId || undefined,
          createdAt: timestampStr,
          title: promptText,
          prompt: promptText,
          status: 'error',
          errorMessage: detailObj.message || '执行被安全沙箱阻断',
          errorDetails: detailObj.details || 'AST 语法树校验发现非只读语句或非法结构',
          rawSql: detailObj.raw_sql || undefined
        };

        setBlocks(prev => [errorBlock, ...prev]);
        showToast(`🚨 执行拦截: ${detailObj.message || '已被 AST 沙箱阻断'}`);
        return;
      }

      const data = await res.json();
      if (data.session_id) {
        setCurrentSessionId(data.session_id);
      }

      const newBlock: ReportBlockData = {
        ...data,
        id: `report-${Date.now()}`,
        sessionId: data.session_id,
        createdAt: timestampStr,
        title: promptText,
        prompt: promptText,
        status: 'success',
        archived: false
      };

      setBlocks(prev => [newBlock, ...prev]);
      showToast("✨ 新研报生成完毕！已同步云端会话");
    } catch (err: any) {
      const errorBlock: ReportBlockData = {
        id: `error-${Date.now()}`,
        sessionId: currentSessionId || undefined,
        createdAt: timestampStr,
        title: promptText,
        prompt: promptText,
        status: 'error',
        errorMessage: '网络连接或后端未响应',
        errorDetails: err.message || '请确认后端服务端口 8026 正常运行'
      };
      setBlocks(prev => [errorBlock, ...prev]);
      showToast(`网络请求异常: ${err.message || '后端服务未启动'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 6. 物理落盘归档
  const handleArchive = async (block: ReportBlockData): Promise<boolean> => {
    const token = localStorage.getItem('datapulse_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`${API_BASE}/reports/archive`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          report_title: block.prompt,
          prompt: block.prompt,
          sql: block.safe_sql || '',
          summary: block.summary || '',
          kpis: block.kpis || {},
          data_columns: block.columns || [],
          data_rows: block.rows || [],
          session_id: block.sessionId || currentSessionId || undefined,
          chart_meta: block.chart_meta
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // 更新对应 block 的归档状态与下载地址
        setBlocks(prev => prev.map(b => {
          if (b.id === block.id) {
            return {
              ...b,
              archived: true,
              downloadUrl: data.download_url,
              fileName: data.file_name
            };
          }
          return b;
        }));

        // 自动拉起浏览器原生直接下载
        if (data.download_url) {
          const a = document.createElement('a');
          a.href = data.download_url;
          a.download = data.file_name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        showToast(`📄 ${data.message} (${data.file_name})`);
        return true;
      } else {
        showToast("❌ 归档失败");
        return false;
      }
    } catch (e: any) {
      showToast(`❌ 归档错误: ${e.message}`);
      return false;
    }
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClearHistory = () => {
    if (confirm("确认清空当前画布上的所有研报与历史记录吗？")) {
      setBlocks([]);
      setCurrentSessionId(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // -------------------------------------------------------------
  // 核心特性：如果未登录且未选择访客试玩，首次打开呈现专属高质感登录前台
  // -------------------------------------------------------------
  if (!currentUser && !isGuestMode) {
    return (
      <AuthPage
        onLoginSuccess={handleLoginSuccess}
        onContinueAsGuest={() => setIsGuestMode(true)}
        serverStatus={serverStatus}
      />
    );
  }

  const currentDbName = currentDbUrl.split('/').pop() || 'sales_demo.sqlite';
  const tableCount = schemaData?.tables?.length || 0;
  const recommendedPrompts = schemaData?.recommended_prompts || [
    "统计过去半年每个销售团队的成单总额与环比增长",
    "按大区分析各品类客单价与总成单贡献",
    "查询高价值客户成单频次与累计贡献排行"
  ];

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col font-sans">
      {/* 顶部常驻导航 */}
      <TopHeader
        onPrint={handlePrint}
        serverStatus={serverStatus}
        currentDbName={currentDbName}
        onOpenDbModal={() => setIsDbModalOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenArchivedModal={() => setIsArchivedModalOpen(true)}
        currentUser={currentUser}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenWorkspaceDrawer={() => setIsWorkspaceDrawerOpen(true)}
      />

      {/* 主工作区：左侧 Schema 侧栏 + 右侧宽阔研报画布 */}
      <div className="flex-1 flex w-full">
        {/* 左侧数据库表结构树 */}
        <SchemaSidebar
          schemaData={schemaData}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onSelectField={(text) => setInjectedText(text)}
          onOpenDbModal={() => setIsDbModalOpen(true)}
        />

        {/* 右侧主画布容器 */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 pt-8 pb-24 transition-all">
          {/* 画布标题与控制栏 */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">
                  商业智能研报画布
                </h1>
                {currentSessionId ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200/50">
                    云端会话已连接
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium border border-neutral-200">
                    {currentDbName}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1">
                Schema 感知分析 · AST 只读沙箱防护 · 个人多会话云端工作台
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewSession}
                className="no-print flex items-center gap-1.5 text-xs text-neutral-700 bg-white hover:bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-200 shadow-2xs transition-colors font-medium"
                title="新建干净的分析画布"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>新建会话</span>
              </button>

              {blocks.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="no-print flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 transition-colors"
                  title="清空画布与历史记录"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>清空当前画布</span>
                </button>
              )}
            </div>
          </div>

          {/* 搜索胶囊 (带当前数据库感知与动态推荐) */}
          <SearchCapsule
            onSearch={handleQuery}
            isLoading={isLoading}
            dbName={currentDbName}
            tableCount={tableCount}
            recommendedPrompts={recommendedPrompts}
            injectedText={injectedText}
            onOpenDbModal={() => setIsDbModalOpen(true)}
          />

          {/* 首屏引导卡片 (当画布没有研报或用户清空时展示) */}
          {blocks.length === 0 && !isLoading && (
            <OnboardingHero
              schemaData={schemaData}
              onQuickStart={handleQuery}
              onOpenDbModal={() => setIsDbModalOpen(true)}
            />
          )}

          {/* 研报与异常记录卡片瀑布流 */}
          <div className="space-y-6">
            {blocks.map((block) => (
              <ReportBlock
                key={block.id}
                block={block}
                onArchive={handleArchive}
                onDelete={handleDeleteBlock}
                onRetry={handleQuery}
              />
            ))}
          </div>
        </main>
      </div>

      {/* 数据库源切换与接入 Modal */}
      <DatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        currentUrl={currentDbUrl}
        onApplyConnection={handleApplyDatabase}
      />

      {/* 归档研报文档库 Modal */}
      <ArchivedModal
        isOpen={isArchivedModalOpen}
        onClose={() => setIsArchivedModalOpen(false)}
      />

      {/* 用户登录 / 注册 Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* 个人资源工作台抽屉 (历史对话 + 落盘研报) */}
      <WorkspaceDrawer
        isOpen={isWorkspaceDrawerOpen}
        onClose={() => setIsWorkspaceDrawerOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onNewSession={handleNewSession}
        onRestoreSession={handleRestoreSession}
        currentSessionId={currentSessionId}
      />

      {/* 全局 Toast 通知 */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-neutral-800 animate-fade-in no-print flex items-center gap-2">
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
