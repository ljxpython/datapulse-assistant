import React, { useState } from 'react';
import { X, Check, Copy, ShieldCheck, Terminal, Clock } from 'lucide-react';
import { SandboxMeta } from '../types';

interface SqlAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sql: string;
  meta: SandboxMeta;
  durationMs: number;
}

export const SqlAuditDrawer: React.FC<SqlAuditDrawerProps> = ({
  isOpen,
  onClose,
  sql,
  meta,
  durationMs
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs no-print">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-800">AST 只读安全沙箱审计报告</h3>
              <p className="text-xs text-neutral-400">语法树单语句解析 · 只读约束已通过</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 校验状态元数据徽章 */}
        <div className="px-6 py-3 bg-neutral-50/30 border-b border-neutral-100 flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            AST 校验通过 (只读 SELECT)
          </span>

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 font-medium">
            <Terminal className="w-3.5 h-3.5" />
            {meta.limit_injected ? `已注入 LIMIT ${meta.max_rows}` : '自限语句'}
          </span>

          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200/80 font-mono">
            <Clock className="w-3.5 h-3.5 text-neutral-400" />
            耗时 {durationMs}ms
          </span>
        </div>

        {/* SQL 代码展示区 */}
        <div className="p-6 overflow-y-auto flex-1 bg-neutral-900 text-neutral-100">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-800 text-xs text-neutral-400">
            <span>FORMATTED_SQL (DIALECT: {meta.dialect.toUpperCase()})</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制 SQL'}</span>
            </button>
          </div>
          <pre className="font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap text-emerald-300">
            {sql}
          </pre>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors"
          >
            完成审计
          </button>
        </div>
      </div>
    </div>
  );
};
