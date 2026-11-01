import React, { useState } from 'react';
import { Database, Table, Columns, Key, ChevronDown, ChevronRight, RefreshCw, PanelLeftClose, PanelLeft } from 'lucide-react';
import { DatabaseSchema, TableColumn } from '../types';

interface SchemaSidebarProps {
  schemaData: DatabaseSchema | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectField: (text: string) => void;
  onOpenDbModal: () => void;
}

export const SchemaSidebar: React.FC<SchemaSidebarProps> = ({
  schemaData,
  isOpen,
  onToggle,
  onSelectField,
  onOpenDbModal
}) => {
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({
    teams: true,
    sales_records: true
  });

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }));
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed left-3 top-20 z-20 no-print flex items-center gap-1.5 px-3 py-2 bg-white/90 backdrop-blur-md border border-neutral-200/90 rounded-xl shadow-sm text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-all"
        title="展开数据表结构树"
      >
        <PanelLeft className="w-4 h-4 text-neutral-500" />
        <span className="font-medium">表结构</span>
      </button>
    );
  }

  const tables = schemaData?.tables || [];
  const schemaDict = schemaData?.schema || {};

  return (
    <aside className="w-72 shrink-0 bg-white border-r border-[#EAEAE7] h-[calc(100vh-53px)] sticky top-[53px] flex flex-col z-20 no-print shadow-[1px_0_4px_rgba(0,0,0,0.01)] transition-all">
      {/* 头部 */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-neutral-800">目标数据库 Schema</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenDbModal}
            className="p-1 rounded-md text-neutral-400 hover:text-blue-600 hover:bg-neutral-100 transition-colors"
            title="更换数据库"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggle}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            title="收起侧栏"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 数据库源概要徽章 */}
      <div className="p-3 border-b border-neutral-100 bg-blue-50/30">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-neutral-400">已接入源:</span>
          <span className="font-mono text-neutral-700 truncate max-w-[170px]" title={schemaData?.connection_url}>
            {schemaData?.connection_url?.split('/').pop() || 'sales_demo.sqlite'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-neutral-500">
          <span>数据表: {tables.length} 张</span>
          <button
            onClick={onOpenDbModal}
            className="text-blue-600 font-medium hover:underline flex items-center gap-0.5"
          >
            <span>切换</span>
          </button>
        </div>
      </div>

      {/* 数据表与字段树 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {tables.length === 0 ? (
          <div className="text-center py-8 text-neutral-400 text-xs">
            暂无探查到的表结构
          </div>
        ) : (
          tables.map((tbl) => {
            const isExpanded = !!expandedTables[tbl];
            const cols = schemaDict[tbl] || [];
            return (
              <div key={tbl} className="rounded-xl border border-neutral-200/70 bg-white overflow-hidden text-xs">
                {/* 表头 */}
                <div
                  onClick={() => toggleTable(tbl)}
                  className="px-3 py-2 flex items-center justify-between bg-neutral-50/70 hover:bg-neutral-100/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
                    <Table className="w-3.5 h-3.5 text-neutral-500" />
                    <span className="truncate max-w-[150px]">{tbl}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                    <span>{cols.length} 列</span>
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </div>
                </div>

                {/* 展开的字段列表 */}
                {isExpanded && (
                  <div className="divide-y divide-neutral-50 px-2 py-1 bg-white">
                    {cols.map((col: TableColumn) => (
                      <div
                        key={col.name}
                        onClick={() => onSelectField(` ${col.name} `)}
                        className="py-1.5 px-2 flex items-center justify-between text-[11px] rounded hover:bg-blue-50/50 hover:text-blue-700 cursor-pointer group transition-colors"
                        title="点击插入到提问框"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {col.primary_key ? (
                            <Key className="w-3 h-3 text-amber-500 shrink-0" />
                          ) : (
                            <Columns className="w-3 h-3 text-neutral-300 group-hover:text-blue-500 shrink-0" />
                          )}
                          <span className="font-mono text-neutral-700 group-hover:text-blue-700 truncate">
                            {col.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {col.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 底部提示 */}
      <div className="p-3 border-t border-neutral-100 bg-neutral-50/50 text-[11px] text-neutral-400 leading-tight">
        💡 点击字段名可直接插入到上方搜索框，驱动 Agent 针对特定列精准分析。
      </div>
    </aside>
  );
};
