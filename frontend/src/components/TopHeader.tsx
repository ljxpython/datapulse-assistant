import React from 'react';
import { Database, Printer, ChevronDown, PanelLeft, FolderArchive, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface TopHeaderProps {
  onPrint: () => void;
  serverStatus?: 'online' | 'offline' | 'checking';
  currentDbName: string;
  onOpenDbModal: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenArchivedModal: () => void;
  currentUser: User | null;
  onOpenLoginModal: () => void;
  onOpenWorkspaceDrawer: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onPrint,
  currentDbName,
  onOpenDbModal,
  isSidebarOpen,
  onToggleSidebar,
  onOpenArchivedModal,
  currentUser,
  onOpenLoginModal,
  onOpenWorkspaceDrawer
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FBFBFA]/95 backdrop-blur-md border-b border-[#EAEAE7] px-4 sm:px-6 py-2.5 no-print">
      <div className="w-full flex items-center justify-between">
        {/* 左侧产品 Logo 与侧边栏控制 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg border border-neutral-200/80 bg-white hover:bg-neutral-100 text-neutral-600 transition-colors"
            title={isSidebarOpen ? "收起表结构侧边栏" : "展开表结构侧边栏"}
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
              DP
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs tracking-tight text-neutral-900">
                  DataPulse Assistant
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200 font-mono">
                  v1.2
                </span>
              </div>
            </div>
          </div>

          <div className="hidden sm:block h-4 w-[1px] bg-neutral-200"></div>

          {/* 核心亮点：当前数据库挂载指示器 (可点击切换) */}
          <button
            onClick={onOpenDbModal}
            className="flex items-center gap-1.5 text-xs text-neutral-700 bg-white hover:bg-neutral-50 px-3 py-1 rounded-xl border border-neutral-200/90 shadow-2xs transition-all group"
            title="点击切换或添加目标数据库连接"
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-neutral-800 truncate max-w-[160px]">
              {currentDbName || 'sales_demo.sqlite'}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              AST 只读沙箱
            </span>
            <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-neutral-700 transition-colors" />
          </button>
        </div>

        {/* 右侧动作 */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenArchivedModal}
            className="flex items-center gap-1.5 text-xs text-neutral-700 hover:text-neutral-900 px-3 py-1 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors shadow-2xs font-medium"
            title="查看所有已落盘的归档文档库"
          >
            <FolderArchive className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">归档文档库</span>
          </button>

          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 px-3 py-1 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors shadow-2xs"
            title="打印或导出 A4 研报 PDF"
          >
            <Printer className="w-3.5 h-3.5 text-neutral-500" />
            <span className="hidden sm:inline">打印研报</span>
          </button>

          <div className="hidden sm:block h-4 w-[1px] bg-neutral-200"></div>

          {/* 用户资产状态 / 登录入口 (移动至最右侧) */}
          {currentUser ? (
            <button
              onClick={onOpenWorkspaceDrawer}
              className="flex items-center gap-2 text-xs text-neutral-800 bg-white hover:bg-neutral-50 px-3 py-1 rounded-xl border border-neutral-200/90 shadow-2xs transition-all"
              title="点击打开个人工作台 (历史对话与落盘文档)"
            >
              <div className="w-5 h-5 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold">
                {currentUser.nickname?.[0]?.toUpperCase() || currentUser.username?.[0]?.toUpperCase()}
              </div>
              <span className="font-semibold max-w-[100px] truncate">
                {currentUser.nickname || currentUser.username}
              </span>
              <span className="text-[10px] px-1 py-0.2 rounded-md bg-blue-50 text-blue-700 font-medium">
                工作台
              </span>
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="flex items-center gap-1.5 text-xs text-white bg-neutral-900 hover:bg-neutral-800 px-3 py-1 rounded-xl shadow-xs transition-all font-semibold"
              title="登录后可持久化历史会话并归档研报"
            >
              <UserIcon className="w-3.5 h-3.5 text-neutral-300" />
              <span>登录 / 体验账号</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
