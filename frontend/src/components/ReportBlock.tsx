import React, { useState } from 'react';
import { ShieldCheck, Archive, CheckCircle, FileText, Sparkles, AlertTriangle, ShieldAlert, Terminal, RefreshCw, Trash2, Download } from 'lucide-react';
import { ReportBlockData } from '../types';
import { ExecutiveTrio } from './ExecutiveTrio';
import { PublicationChart } from './PublicationChart';
import { DataTable } from './DataTable';
import { SqlAuditDrawer } from './SqlAuditDrawer';

interface ReportBlockProps {
  block: ReportBlockData;
  onArchive: (block: ReportBlockData) => Promise<boolean>;
  onDelete?: (id: string) => void;
  onRetry?: (prompt: string) => void;
}

export const ReportBlock: React.FC<ReportBlockProps> = ({ block, onArchive, onDelete, onRetry }) => {
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archived, setArchived] = useState(block.archived || false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryClick = async () => {
    if (isRetrying || !onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry(block.prompt);
    } finally {
      setIsRetrying(false);
    }
  };

  // 1. 如果是错误/拦截卡片，渲染安全警示风格
  if (block.status === 'error') {
    return (
      <article className="bg-[#FFFDFD] rounded-2xl border border-rose-200 shadow-sm p-6 sm:p-8 mb-8 transition-all hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-rose-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1 rounded-md bg-rose-100 text-rose-700">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-rose-700">
                AST 安全沙箱拦截 / 执行异常 · {block.createdAt}
              </span>
            </div>
            <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
              {block.prompt}
            </h2>
          </div>

          <div className="flex items-center gap-2 no-print">
            {onRetry && (
              <button
                onClick={handleRetryClick}
                disabled={isRetrying}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                  isRetrying
                    ? 'bg-rose-100 border-rose-300 text-rose-600 cursor-wait'
                    : 'text-rose-700 hover:text-white hover:bg-rose-600 border-rose-300 active:scale-95'
                }`}
                title="重新将该问题交由沙箱与模型分析"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? '正在重试...' : '重试此提问'}</span>
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(block.id)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="删除此记录"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 错误明细提示 */}
        <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200/60 mb-4 text-xs space-y-2">
          <div className="flex items-start gap-2 text-rose-900 font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div>拦截说明: {block.errorMessage || '请求被安全策略阻断'}</div>
              {block.errorDetails && (
                <div className="text-[11px] font-normal text-rose-700 mt-1">
                  原因详情: {block.errorDetails}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 触发拦截的原始 SQL 代码片段 */}
        {block.rawSql && (
          <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 text-neutral-200 text-xs">
            <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-rose-400" />
                触发拦截的原始 SQL (已由沙箱强行截获，未在目标库执行)
              </span>
            </div>
            <pre className="p-4 font-mono text-rose-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {block.rawSql}
            </pre>
          </div>
        )}
      </article>
    );
  }

  // 2. 正常研报卡片
  const handleArchiveClick = async () => {
    if (isArchiving) return;
    
    // 如果已经归档过，直接触发下载
    if (archived && block.downloadUrl) {
      const a = document.createElement('a');
      a.href = block.downloadUrl;
      a.download = block.fileName || `report_${block.id}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    setIsArchiving(true);
    const success = await onArchive(block);
    if (success) {
      setArchived(true);
    }
    setIsArchiving(false);
  };

  return (
    <article className="bg-[#FFFFFF] rounded-2xl border border-[#EAEAE7] shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-6 sm:p-8 mb-8 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)]">
      {/* 卡片头部 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-6 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 rounded-md bg-blue-50 text-blue-600">
              <FileText className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-medium text-neutral-400">
              业务分析研报 · {block.createdAt}
            </span>
            {archived && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                <CheckCircle className="w-3 h-3" />
                已落盘归档
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-neutral-900 tracking-tight">
            {block.prompt}
          </h2>
        </div>

        {/* 右侧控制栏 (降噪技术操作) */}
        <div className="flex items-center gap-2 no-print self-start sm:self-auto">
          {/* 智能体反思自愈徽标 */}
          {block.self_healed && (
            <span
              className="flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg border border-purple-200/60 shadow-2xs"
              title="该查询首次执行遇阻，经智能体自动结合报错反思纠错后成功跑通！"
            >
              <Sparkles className="w-3 h-3 text-purple-600" />
              <span>自动反思自愈 (第 {block.heal_rounds || 2} 轮)</span>
            </span>
          )}

          {/* SQL 审计按钮 */}
          <button
            onClick={() => setIsAuditOpen(true)}
            className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>SQL 审计</span>
            <span className="text-[10px] text-neutral-400 font-mono">({block.duration_ms}ms)</span>
          </button>

          {/* 三权分立落盘归档 / 下载按钮 */}
          <button
            onClick={handleArchiveClick}
            disabled={isArchiving}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
              archived
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-semibold shadow-2xs'
                : 'bg-white hover:bg-neutral-900 hover:text-white text-neutral-700 border-neutral-300'
            }`}
            title={archived ? "点击下载已落盘的 Markdown 研报" : "确认将研报落地磁盘"}
          >
            {archived ? (
              <>
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>下载研报 (.md)</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>{isArchiving ? '落盘中...' : '确认落盘'}</span>
              </>
            )}
          </button>

          {onDelete && (
            <button
              onClick={() => onDelete(block.id)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="删除此研报"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 业务洞察卡 (Executive Summary) */}
      <div className="bg-neutral-50/70 rounded-xl p-4 border border-neutral-200/60 mb-6 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-neutral-700">
          <span className="font-semibold text-neutral-900 mr-1.5">核心管理洞察:</span>
          {block.summary}
        </div>
      </div>

      {/* 高管大指标三元组 */}
      {block.kpis && <ExecutiveTrio kpis={block.kpis} />}

      {/* 柔和平滑图表 */}
      {block.columns && block.rows && (
        <PublicationChart
          columns={block.columns}
          rows={block.rows}
          chartMeta={block.chart_meta}
        />
      )}

      {/* 明细数据表 */}
      {block.columns && block.rows && (
        <DataTable
          columns={block.columns}
          rows={block.rows}
          totalCount={block.row_count || block.rows.length}
        />
      )}

      {/* 抽屉式 SQL 安全审计弹窗 */}
      {block.safe_sql && block.sandbox_meta && (
        <SqlAuditDrawer
          isOpen={isAuditOpen}
          onClose={() => setIsAuditOpen(false)}
          sql={block.safe_sql}
          meta={block.sandbox_meta}
          durationMs={block.duration_ms || 0}
        />
      )}
    </article>
  );
};
