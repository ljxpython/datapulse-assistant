import React, { useState, useEffect } from 'react';
import { Sparkles, CornerDownLeft, Loader2, Database, HelpCircle } from 'lucide-react';

interface SearchCapsuleProps {
  onSearch: (prompt: string) => void;
  isLoading: boolean;
  dbName: string;
  tableCount: number;
  recommendedPrompts: string[];
  injectedText?: string;
  onOpenDbModal: () => void;
}

export const SearchCapsule: React.FC<SearchCapsuleProps> = ({
  onSearch,
  isLoading,
  dbName,
  tableCount,
  recommendedPrompts,
  injectedText,
  onOpenDbModal
}) => {
  const [inputVal, setInputVal] = useState("");

  // 当左侧字段树点击插入时，追加到输入框
  useEffect(() => {
    if (injectedText) {
      setInputVal(prev => prev + injectedText);
    }
  }, [injectedText]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim() || isLoading) return;
    onSearch(inputVal.trim());
    setInputVal("");
  };

  const handlePresetClick = (q: string) => {
    if (isLoading) return;
    onSearch(q);
  };

  return (
    <div className="w-full mb-8 no-print">
      {/* 数据库感知提示行 (解决用户不知道在查哪个库的困惑) */}
      <div className="flex items-center justify-between px-2 mb-2 text-xs">
        <div className="flex items-center gap-1.5 text-neutral-500">
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span>当前目标数据库:</span>
          <span className="font-semibold text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded-md font-mono">
            {dbName}
          </span>
          <span className="text-neutral-400">({tableCount} 张数据表已就绪)</span>
        </div>
        <button
          onClick={onOpenDbModal}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs flex items-center gap-1"
        >
          <span>更换目标数据库 / 接入新库</span>
        </button>
      </div>

      {/* 搜索胶囊外框 */}
      <div className="relative bg-white rounded-2xl border border-neutral-200/90 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] transition-all focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
        <form onSubmit={handleSubmit} className="flex items-center px-4 py-3.5 gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>

          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isLoading}
            placeholder="用自然语言提问 (例如: 统计各大区战队的总成单金额和客单价，或点击左侧字段)..."
            className="flex-1 bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!inputVal.trim() || isLoading}
            className="flex items-center justify-center px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed gap-1.5 shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>AI 架构分析中...</span>
              </>
            ) : (
              <>
                <span>生成研报</span>
                <CornerDownLeft className="w-3 h-3 text-neutral-400" />
              </>
            )}
          </button>
        </form>

        {/* 快捷推荐气泡 (根据数据库动态变化) */}
        {recommendedPrompts && recommendedPrompts.length > 0 && (
          <div className="px-4 pb-3 pt-1.5 border-t border-neutral-100 flex flex-wrap items-center gap-2 text-xs bg-neutral-50/40 rounded-b-2xl">
            <span className="text-neutral-400 font-medium flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              推荐探查:
            </span>
            {recommendedPrompts.map((q, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isLoading}
                onClick={() => handlePresetClick(q)}
                className="text-neutral-600 hover:text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg border border-neutral-200/80 bg-white transition-all text-left truncate max-w-[280px]"
                title={q}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
