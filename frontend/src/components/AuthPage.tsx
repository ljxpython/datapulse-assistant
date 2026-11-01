import React, { useState } from 'react';
import { 
  ShieldCheck, Database, FileText, ArrowRight, Sparkles, 
  Lock, User as UserIcon, ChevronRight, Terminal, AlertCircle
} from 'lucide-react';
import { User } from '../types';

interface AuthPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  onContinueAsGuest: () => void;
  serverStatus: 'online' | 'offline' | 'checking';
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onLoginSuccess,
  onContinueAsGuest,
  serverStatus
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const endpoint = tab === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
      const payload = tab === 'login'
        ? { username: username.trim(), password }
        : { username: username.trim(), password, nickname: nickname.trim() || undefined };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || '认证失败，请检查输入');
      }

      localStorage.setItem('datapulse_token', data.access_token);
      localStorage.setItem('datapulse_user', JSON.stringify(data.user));

      onLoginSuccess(data.user, data.access_token);
    } catch (err: any) {
      setErrorMsg(err.message || '网络连接异常');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAdmin = () => {
    setTab('login');
    setUsername('admin');
    setPassword('datapulse2026');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] flex flex-col justify-between text-neutral-900 selection:bg-blue-100 selection:text-blue-900 font-sans relative overflow-hidden">
      
      {/* 顶部极简品牌条 */}
      <header className="w-full px-6 sm:px-12 py-5 flex items-center justify-between border-b border-[#EAEAE7]/80 bg-[#FBFBFA]/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            DP
          </div>
          <span className="font-extrabold text-sm tracking-tight text-neutral-900">
            DataPulse Assistant
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 font-mono">
            v1.2 企业级
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 px-2.5 py-1 rounded-lg bg-white border border-neutral-200/80 shadow-2xs">
            <span className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>端口 8026</span>
            <span className="text-neutral-400">·</span>
            <span className="text-emerald-700 font-medium">AST 沙箱就绪</span>
          </div>
        </div>
      </header>

      {/* 主屏黄金比例双栏 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-12 py-12 flex flex-col lg:flex-row items-center justify-between gap-12 z-10">
        
        {/* 左侧：产品定位、高保真卡片与核心技术背书 */}
        <div className="flex-1 max-w-xl space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>三权分立 · 自然语言直接驱动生产数据库</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 leading-[1.15]">
              从业务自然语言，<br />
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-neutral-900 bg-clip-text text-transparent">
                到高管决策研报
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-neutral-500 leading-relaxed">
              专为企业数据分析师打造的智能 Text-to-SQL 工作台。内置 AST 语法树只读沙箱防御，自动注入安全熔断，三权分立终审落盘物理磁盘。
            </p>
          </div>

          {/* 高保真微缩研报演示卡片 (符合 Notion 风格) */}
          <div className="p-5 rounded-2xl bg-white border border-neutral-200/90 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                <span className="text-xs font-bold text-neutral-800">
                  业务研报示例：统计各战队总成单金额与客单价
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/60">
                AST 只读防护通过
              </span>
            </div>

            {/* 微缩指标三元组 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-[11px] text-neutral-400 block font-medium">总成交额 (GMV)</span>
                <span className="text-sm font-bold text-neutral-900 mt-0.5 block">¥ 3,842,500</span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-[11px] text-neutral-400 block font-medium">成交记录数</span>
                <span className="text-sm font-bold text-neutral-900 mt-0.5 block">10 笔</span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-[11px] text-neutral-400 block font-medium">平均客单价 (AOV)</span>
                <span className="text-sm font-bold text-neutral-900 mt-0.5 block">¥ 384,250</span>
              </div>
            </div>

            {/* 深色 SQL 视窗 */}
            <div className="rounded-xl bg-neutral-900 p-3 font-mono text-[11px] text-emerald-400 overflow-hidden flex items-center justify-between">
              <span className="truncate">SELECT team_name, SUM(amount) AS total_gmv FROM sales_records ... LIMIT 500</span>
              <Terminal className="w-3.5 h-3.5 text-neutral-500 shrink-0 ml-2" />
            </div>
          </div>

          {/* 三大核心技术亮点 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-neutral-800">AST 安全沙箱</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">拦截 DROP/UPDATE，自动改写注入安全 LIMIT</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Database className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-neutral-800">多数据源秒切</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">支持 SQLite、PostgreSQL、MySQL 动态热插拔</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-neutral-800">三权分立落盘</h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">人类分析师终审确认，一键导出与在线预览</p>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：高质感 Notion / Linear 风格登录面板 */}
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl p-8 shadow-xl border border-neutral-200/90 relative">
            
            {/* 顶栏 Tab 切换 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">
                  {tab === 'login' ? '分析师登录' : '注册新通行证'}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  登录后自动云端持久化历史会话与专属落盘研报
                </p>
              </div>
            </div>

            {/* 极简药丸切换 */}
            <div className="flex bg-neutral-100 p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tab === 'login' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                账号登录
              </button>
              <button
                type="button"
                onClick={() => { setTab('register'); setErrorMsg(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tab === 'register' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                快速注册
              </button>
            </div>

            {/* 错误提示 */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 快速填入演示账号快捷药丸 */}
            <div className="mb-5">
              <button
                type="button"
                onClick={fillDemoAdmin}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/60 text-blue-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-2xs group"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                <span>一键填入极客演示账号 (admin / datapulse2026)</span>
              </button>
            </div>

            {/* 登录/注册表单 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  账号名称
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="输入用户名 (如 admin)"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-neutral-400"
                  />
                </div>
              </div>

              {tab === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    分析师头衔 / 昵称 (可选)
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="例如: 华东战略总监"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-neutral-400"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  安全密码
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="不少于 6 位的密码"
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-2 cursor-pointer"
              >
                {loading ? (
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                ) : (
                  <>
                    <span>{tab === 'login' ? '进入商业智能研报画布' : '立即注册并登入'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* 访客快速体验通道 */}
            <div className="mt-6 pt-5 border-t border-neutral-100 text-center">
              <button
                type="button"
                onClick={onContinueAsGuest}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 font-medium transition-colors group"
              >
                <span>只想快速试玩？以访客身份免登录体验</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

          </div>
        </div>

      </main>

      {/* 底部信息栏 */}
      <footer className="w-full px-6 py-4 border-t border-[#EAEAE7]/60 text-center text-xs text-neutral-400 bg-white/40">
        DataPulse Assistant · 企业级 Text-to-SQL 决策支持智能体 · 遵循三权分立与 AST 沙箱防护
      </footer>

    </div>
  );
};
