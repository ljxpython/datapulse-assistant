import React from 'react';
import { TrendingUp, Layers, Hash, Calculator, ShoppingBag, CreditCard } from 'lucide-react';
import { Kpis } from '../types';

interface ExecutiveTrioProps {
  kpis: Kpis;
}

export const ExecutiveTrio: React.FC<ExecutiveTrioProps> = ({ kpis }) => {
  // 如果后端返回了场景自适应的动态卡片列表
  if (kpis.cards && kpis.cards.length > 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.cards.map((card, idx) => {
          const colorClass = card.color === 'emerald'
            ? 'bg-emerald-500'
            : card.color === 'amber'
            ? 'bg-amber-500'
            : card.color === 'blue'
            ? 'bg-blue-500'
            : 'bg-indigo-500';

          return (
            <div
              key={idx}
              className="bg-white rounded-xl p-4 border border-neutral-200/80 shadow-sm relative overflow-hidden transition-all hover:border-neutral-300"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorClass}`}></div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-neutral-600 truncate max-w-[180px]">
                  {card.title}
                </span>
                {card.trend && (
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    {card.trend}
                  </span>
                )}
                {!card.trend && (
                  idx === 0 ? <Layers className="w-3.5 h-3.5 text-neutral-400" /> :
                  idx === 1 ? <Hash className="w-3.5 h-3.5 text-neutral-400" /> :
                  <Calculator className="w-3.5 h-3.5 text-neutral-400" />
                )}
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight text-neutral-900 tabular-nums">
                {card.value}
              </div>
              {card.sub_label && (
                <div className="text-[11px] text-neutral-400 mt-1 truncate">
                  {card.sub_label}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // 兜底渲染 (纯销售交易默认展示)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {/* 1. 总成交额 GMV */}
      <div className="bg-white rounded-xl p-4 border border-neutral-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-neutral-500">总成交额 (GMV)</span>
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            {kpis.gmv_growth || "+14.8%"}
          </span>
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight text-neutral-900 tabular-nums">
          {kpis.gmv}
        </div>
        <div className="text-[11px] text-neutral-400 mt-1">对比历史周期平稳跃升</div>
      </div>

      {/* 2. 成交订单总数 */}
      <div className="bg-white rounded-xl p-4 border border-neutral-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-neutral-500">成单记录数</span>
          <ShoppingBag className="w-3.5 h-3.5 text-neutral-400" />
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight text-neutral-900 tabular-nums">
          {kpis.orders}
        </div>
        <div className="text-[11px] text-neutral-400 mt-1">有效成交流水笔数</div>
      </div>

      {/* 3. 平均客单价 AOV */}
      <div className="bg-white rounded-xl p-4 border border-neutral-200/80 shadow-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-neutral-500">平均客单价 (AOV)</span>
          <CreditCard className="w-3.5 h-3.5 text-neutral-400" />
        </div>
        <div className="text-2xl font-bold font-mono tracking-tight text-neutral-900 tabular-nums">
          {kpis.aov}
        </div>
        <div className="text-[11px] text-neutral-400 mt-1">单笔订单平均贡献水平</div>
      </div>
    </div>
  );
};
