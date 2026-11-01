import React, { useState, useEffect } from 'react';
import { 
  X, MessageSquare, FileText, Download, Trash2, Plus, 
  Clock, LogOut, RefreshCw, Eye
} from 'lucide-react';
import { User, ChatSessionSummary, UserReportItem } from '../types';
import { ReportPreviewModal } from './ReportPreviewModal';

interface WorkspaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onLogout: () => void;
  onNewSession: () => void;
  onRestoreSession: (sessionId: string) => Promise<void>;
  currentSessionId?: string | null;
}

export const WorkspaceDrawer: React.FC<WorkspaceDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout,
  onNewSession,
  onRestoreSession,
  currentSessionId
}) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'reports'>('sessions');
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [reports, setReports] = useState<UserReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | undefined>(undefined);

  // 拉取会话列表与研报列表
  const fetchData = async () => {
    if (!currentUser) return;
    const token = localStorage.getItem('datapulse_token');
    if (!token) return;

    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [sessRes, repRes] = await Promise.all([
        fetch('/api/v1/user/sessions', { headers }),
        fetch('/api/v1/user/reports', { headers })
      ]);

      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSessions(sessData.sessions || []);
      }
      if (repRes.ok) {
        const repData = await repRes.json();
        setReports(repData.reports || []);
      }
    } catch (e) {
      console.error('拉取工作台资产失败:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchData();
    }
  }, [isOpen, currentUser]);

  // 删除会话
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('确定要删除这条历史会话吗？删除后不可恢复。')) return;

    const token = localStorage.getItem('datapulse_token');
    try {
      const res = await fetch(`/api/v1/user/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
      }
    } catch (err) {
      console.error('删除会话失败:', err);
    }
  };

  // 恢复会话到画布
  const handleSelectSession = async (sessionId: string) => {
    setRestoringId(sessionId);
    try {
      await onRestoreSession(sessionId);
      onClose();
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-neutral-200/80 flex flex-col">
          
          {/* 头部：用户信息与关闭 */}
          <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                {currentUser?.nickname?.[0]?.toUpperCase() || currentUser?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-neutral-900">
                    {currentUser?.nickname || currentUser?.username}
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200/50">
                    {currentUser?.role === 'admin' ? '管理员' : '分析师'}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">@{currentUser?.username}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={fetchData}
                title="刷新"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onLogout}
                title="退出登录"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 新建会话快捷操作栏 */}
          <div className="p-4 pb-2">
            <button
              onClick={() => { onNewSession(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100/80 text-blue-700 text-xs font-semibold transition-all border border-blue-200/50"
            >
              <Plus className="w-4 h-4" />
              <span>开启全新探查会话</span>
            </button>
          </div>

          {/* 选项卡切换 */}
          <div className="flex border-b border-neutral-100 px-4 bg-white">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'sessions'
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>历史对话 ({sessions.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'reports'
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>落盘研报库 ({reports.length})</span>
            </button>
          </div>

          {/* 列表内容区 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {activeTab === 'sessions' ? (
              sessions.length === 0 ? (
                <div className="text-center py-16 text-neutral-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">暂无历史会话记录</p>
                  <p className="text-[11px] text-neutral-300 mt-1">在搜索框发起业务提问后将自动沉淀</p>
                </div>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === currentSessionId;
                  const isRestoring = s.id === restoringId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s.id)}
                      className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-50/40 border-blue-300 ring-1 ring-blue-100 shadow-xs'
                          : 'bg-white border-neutral-200/80 hover:border-neutral-300 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-neutral-800 truncate group-hover:text-blue-600 transition-colors">
                            {s.title}
                          </h4>
                          <p className="text-[11px] text-neutral-400 truncate mt-1 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{s.updated_at}</span>
                            <span>·</span>
                            <span className="truncate">{s.datasource_name}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          {isRestoring ? (
                            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full" />
                          ) : (
                            <button
                              onClick={(e) => handleDeleteSession(e, s.id)}
                              title="删除会话"
                              className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              reports.length === 0 ? (
                <div className="text-center py-16 text-neutral-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">暂无确认落盘的研报</p>
                  <p className="text-[11px] text-neutral-300 mt-1">在分析卡片上点击「确认落盘」后永久归档</p>
                </div>
              ) : (
                reports.map((r) => (
                  <div
                    key={r.id || r.file_name}
                    className="p-3 rounded-xl border border-neutral-200/80 bg-white hover:border-neutral-300 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-neutral-800 truncate">
                          {r.title}
                        </h4>
                        {r.summary && (
                          <p className="text-[11px] text-neutral-500 line-clamp-2 mt-1">
                            {r.summary}
                          </p>
                        )}
                        <p className="text-[10px] text-neutral-400 mt-2 flex items-center gap-2">
                          <span>{r.created_at || r.updated_at}</span>
                          <span>·</span>
                          <span>{(r.size_bytes / 1024).toFixed(1)} KB</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setPreviewFileName(r.file_name);
                            setPreviewTitle(r.title);
                          }}
                          className="p-1.5 px-2.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                          title="在线预览研报"
                        >
                          <Eye className="w-3.5 h-3.5 text-neutral-500" />
                          <span>预览</span>
                        </button>
                        <a
                          href={r.download_url}
                          download
                          className="p-1.5 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                          title="下载 Markdown 研报"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>下载</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>

          {/* 底部信息 */}
          <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 text-center">
            <p className="text-[11px] text-neutral-400">
              DataPulse · 工业级三权分立数据资产工作台
            </p>
          </div>

        </div>
      </div>

      {/* 嵌入预览 Modal */}
      <ReportPreviewModal
        isOpen={Boolean(previewFileName)}
        onClose={() => setPreviewFileName(null)}
        fileName={previewFileName}
        initialTitle={previewTitle}
      />
    </div>
  );
};
