import React, { useState } from 'react';
import { BarChart3, LineChart } from 'lucide-react';
import { ChartMeta } from '../types';

interface PublicationChartProps {
  columns: string[];
  rows: (string | number | null)[][];
  chartMeta?: ChartMeta;
}

export const PublicationChart: React.FC<PublicationChartProps> = ({ columns, rows, chartMeta }) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!rows || rows.length === 0) return null;

  // 1. 确定 X 轴与 Y 轴的列索引
  let xIdx = chartMeta?.x_index ?? 0;
  let yIdx = chartMeta?.y_index ?? (columns.length > 1 ? 1 : 0);

  // 兜底智能推断：如果默认选中的 Y 轴值全部为 0 或非数值，自动探测第一个有正数的数值列
  const testVal = (idx: number) => {
    return rows.some(r => {
      const v = r[idx];
      return v !== null && !isNaN(Number(v)) && Number(v) > 0;
    });
  };

  if (!testVal(yIdx)) {
    for (let c = 0; c < columns.length; c++) {
      if (c !== xIdx && testVal(c)) {
        yIdx = c;
        break;
      }
    }
  }

  // 2. 提取并规整图表数据
  const chartData = rows.map((r, i) => {
    const rawLabel = r[xIdx];
    let label = String(rawLabel !== null && rawLabel !== undefined ? rawLabel : `项目${i + 1}`);
    
    // 如果 X 轴是单纯的数字 ID (例如 1, 2)，尝试找相邻的名称列 (如 team_name)
    if (/^\d+$/.test(label) && columns.length > 2) {
      const nameColIdx = columns.findIndex(col => /name|team|region/i.test(col));
      if (nameColIdx !== -1 && r[nameColIdx]) {
        label = `${String(r[nameColIdx])} (${label})`;
      }
    }

    const rawVal = r[yIdx];
    const val = rawVal !== null && rawVal !== undefined && !isNaN(Number(rawVal))
      ? Number(rawVal)
      : parseFloat(String(rawVal || 0).replace(/[¥,]/g, '')) || 0;

    return { label, val, rawRow: r };
  });

  const maxVal = Math.max(...chartData.map(d => d.val), 1);
  const minVal = Math.min(...chartData.map(d => d.val), 0);

  const chartHeight = 220;
  const chartWidth = 760;
  const paddingLeft = 65;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 35;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  // 坐标点映射
  const stepX = innerWidth / Math.max(chartData.length - 1, 1);
  const points = chartData.map((d, idx) => ({
    x: paddingLeft + idx * stepX,
    y: paddingTop + innerHeight - ((d.val - (minVal < 0 ? minVal : 0)) / (maxVal - (minVal < 0 ? minVal : 0) || 1)) * innerHeight,
    ...d
  }));

  // 生成平滑贝塞尔曲线 SVG path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx = (p0.x + p1.x) / 2;
    pathD += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  // 面积填充封闭路径
  const baselineY = paddingTop + innerHeight;
  const areaD = `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

  // 识别当前 Y 轴是否为金额/货币类指标
  const isCurrency = /(gmv|amount|price|revenue|sales|cost|fee|aov|money|pay)/i.test(columns[yIdx] || '');

  // 智能格式化显示 (非金额指标绝不胡乱加 ¥)
  const formatVal = (v: number) => {
    const prefix = isCurrency ? '¥' : '';
    if (v >= 100000000) return `${prefix}${(v / 100000000).toFixed(1)}亿`;
    if (v >= 10000) return `${prefix}${(v / 10000).toFixed(1)}w`;
    if (v >= 1000) return `${prefix}${(v / 1000).toFixed(1)}k`;
    return `${prefix}${v.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}`;
  };

  const xColTitle = columns[xIdx] || '统计维度';
  const yColTitle = columns[yIdx] || '指标数值';

  return (
    <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 shadow-sm mb-6">
      {/* 头部信息与图表切换 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-neutral-800">趋势分布与业务量化对比</h4>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-200/50">
              Y: {yColTitle}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            X 轴基准: <span className="text-neutral-600 font-medium">{xColTitle}</span> · 样本点: {chartData.length} 组
          </p>
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs">
          <button
            onClick={() => setChartType('area')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              chartType === 'area'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>平滑面积图</span>
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              chartType === 'bar'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>柱状直方图</span>
          </button>
        </div>
      </div>

      {/* SVG 容器 */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-56 select-none overflow-visible">
          <defs>
            <linearGradient id="areaGradientDynamic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="barGradientDynamic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.75" />
            </linearGradient>
          </defs>

          {/* Y 轴刻度线与标签 */}
          {[0, 0.33, 0.66, 1].map((ratio, i) => {
            const yPos = baselineY - ratio * innerHeight;
            const valAtGrid = (minVal < 0 ? minVal : 0) + ratio * (maxVal - (minVal < 0 ? minVal : 0));
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={chartWidth - paddingRight}
                  y2={yPos}
                  stroke="#F1F2F4"
                  strokeDasharray={i === 0 ? "none" : "3 3"}
                  strokeWidth={i === 0 ? "1.5" : "1"}
                />
                <text
                  x={paddingLeft - 8}
                  y={yPos + 3}
                  textAnchor="end"
                  className="text-[10px] fill-neutral-400 font-mono"
                >
                  {formatVal(valAtGrid)}
                </text>
              </g>
            );
          })}

          {chartType === 'area' ? (
            <>
              {/* 面积渐变 */}
              <path d={areaD} fill="url(#areaGradientDynamic)" />
              {/* 平滑折线 */}
              <path
                d={pathD}
                fill="none"
                stroke="#2563EB"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* 数据节点与文字标签 */}
              {points.map((p, i) => {
                const isHovered = hoveredIdx === i;
                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    {/* 竖向参考辅助线 */}
                    {isHovered && (
                      <line
                        x1={p.x}
                        y1={paddingTop}
                        x2={p.x}
                        y2={baselineY}
                        stroke="#93C5FD"
                        strokeDasharray="2 2"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6 : 4}
                      fill="#FFFFFF"
                      stroke="#2563EB"
                      strokeWidth={isHovered ? 3 : 2}
                      className="transition-all"
                    />
                    {/* X 轴文字 */}
                    <text
                      x={p.x}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-sans ${isHovered ? 'fill-neutral-900 font-semibold' : 'fill-neutral-400'}`}
                    >
                      {p.label.length > 7 ? p.label.slice(0, 6) + '..' : p.label}
                    </text>
                    {/* 数值标签 */}
                    <text
                      x={p.x}
                      y={p.y - 9}
                      textAnchor="middle"
                      className={`text-[10px] font-mono font-bold ${isHovered ? 'fill-blue-700' : 'fill-neutral-600'}`}
                    >
                      {formatVal(p.val)}
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            <>
              {/* 柱状直方图 */}
              {chartData.map((d, i) => {
                const barWidth = Math.min(Math.max(innerWidth / chartData.length * 0.55, 14), 48);
                const barX = paddingLeft + (i + 0.5) * (innerWidth / chartData.length) - barWidth / 2;
                const barH = ((d.val - (minVal < 0 ? minVal : 0)) / (maxVal - (minVal < 0 ? minVal : 0) || 1)) * innerHeight;
                const barY = baselineY - barH;
                const isHovered = hoveredIdx === i;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={Math.max(barH, 3)}
                      rx="4"
                      fill="url(#barGradientDynamic)"
                      className={`transition-all ${isHovered ? 'opacity-100 brightness-110' : 'opacity-90'}`}
                    />
                    <text
                      x={barX + barWidth / 2}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      className={`text-[10px] font-sans ${isHovered ? 'fill-neutral-900 font-semibold' : 'fill-neutral-400'}`}
                    >
                      {d.label.length > 7 ? d.label.slice(0, 6) + '..' : d.label}
                    </text>
                    <text
                      x={barX + barWidth / 2}
                      y={barY - 7}
                      textAnchor="middle"
                      className={`text-[10px] font-mono font-bold ${isHovered ? 'fill-blue-700' : 'fill-neutral-600'}`}
                    >
                      {formatVal(d.val)}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
};
