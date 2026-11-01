import React from 'react';
import { Database, ShieldCheck, Sparkles, ArrowRight, Table2, Layers, Compass } from 'lucide-react';
import { DatabaseSchema } from '../types';

interface OnboardingHeroProps {
  schemaData: DatabaseSchema | null;
  onQuickStart: (prompt: string) => void;
  onOpenDbModal: () => void;
}

export const OnboardingHero: React.FC<OnboardingHeroProps> = ({
  schemaData,
  onQuickStart,
  onOpenDbModal
}) => {
  const tables = schemaData?.tables || [];
  const dbName = schemaData?.connection_url?.split('/').pop() || 'sales_demo.sqlite';

  const defaultScenarios = [
    {
      title: "销售战队成单总额与环比",
      prompt: "统计过去半年每个销售团队的成单总额与环比增长",
      desc: "多表关联 + 窗口函数 LAG 计算业绩月度起伏"
    },
    {
      title: "大区各品类客单价与贡献",
      prompt: "按大区分析各品类客单价与总成单贡献",
      desc: "大区维度聚合、AOV 客单价与规模矩阵分析"
    },
    {
      title: "高净值客户采购频次排行",
      prompt: "查询高价值客户成单频次与累计贡献排行",
      desc: "客户画像分层，探查头部复购频次与贡献集中度"
    }
  ];

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-sm p-8 mb-8 no-print transition-all">
      {/* 头部引导 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1 rounded-md bg-blue-50 text-blue-600">
              <Compass className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              交互分析就绪
            </span>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            当前已就绪数据库：<span className="font-mono text-blue-600">{dbName}</span>
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Agent 已自动完成 Schema 表结构探查，你可以随时输入业务自然语言，或切换为自己的业务数据库。
          </p>
        </div>

        <button
          onClick={onOpenDbModal}
          className="self-start md:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors"
        >
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span>切换为我的数据库</span>
        </button>
      </div>

      {/* 数据库状态指标三格卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-100/60 text-blue-700">
            <Table2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 font-medium">已探查数据表</div>
            <div className="text-base font-bold text-neutral-800">
              {tables.length} 张业务表
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-100/60 text-indigo-700">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 font-medium">表名称概要</div>
            <div className="text-xs font-bold font-mono text-neutral-800 truncate max-w-[140px]">
              {tables.join(', ') || 'N/A'}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/60 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-100/60 text-emerald-700">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-neutral-400 font-medium">安全防护等级</div>
            <div className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <span>AST 只读沙箱 + 锁死 LIMIT</span>
            </div>
          </div>
        </div>
      </div>

      {/* 推荐探索卡片 */}
      <div>
        <div className="text-xs font-semibold text-neutral-700 mb-3 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>推荐探索场景 (点击直接生成出版级研报):</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {defaultScenarios.map((sc, i) => (
            <div
              key={i}
              onClick={() => onQuickStart(sc.prompt)}
              className="p-4 rounded-xl border border-neutral-200/80 hover:border-blue-500/80 hover:bg-blue-50/20 cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-xs text-neutral-900 group-hover:text-blue-600 transition-colors">
                  {sc.title}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-[11px] text-neutral-400 line-clamp-2">{sc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
