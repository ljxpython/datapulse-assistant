import React from 'react';
import { Download, Table as TableIcon } from 'lucide-react';

interface DataTableProps {
  columns: string[];
  rows: (string | number | null)[][];
  totalCount: number;
}

export const DataTable: React.FC<DataTableProps> = ({ columns, rows, totalCount }) => {
  if (!rows || rows.length === 0) return null;

  const exportCsv = () => {
    const csvContent = [
      columns.join(','),
      ...rows.map(r => r.map(c => `"${String(c || '')}"`).join(','))
    ].join('\n');

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `data_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 shadow-sm overflow-hidden mb-6">
      <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
        <div className="flex items-center gap-2">
          <TableIcon className="w-4 h-4 text-neutral-500" />
          <span className="text-xs font-semibold text-neutral-800">查询结果明细表</span>
          <span className="text-[11px] text-neutral-400">
            (展示前 {rows.length} 条 · 总共 {totalCount} 行 · LIMIT 500 注入防护)
          </span>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 px-2.5 py-1 rounded-md border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-neutral-500" />
          <span>导出 CSV</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/30 text-neutral-500 font-medium">
              {columns.map((col, idx) => {
                // 判断第一列通常为文本，后续列如果为数值则右对齐
                const isNumeric = idx > 0;
                return (
                  <th
                    key={idx}
                    className={`px-5 py-2.5 ${isNumeric ? 'text-right' : 'text-left'}`}
                  >
                    {col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-neutral-50/60 transition-colors">
                {row.map((cell, cIdx) => {
                  const isNumeric = typeof cell === 'number' || (cIdx > 0 && !isNaN(Number(cell)));
                  return (
                    <td
                      key={cIdx}
                      className={`px-5 py-3 text-neutral-700 ${
                        isNumeric ? 'text-right font-mono tabular-nums text-neutral-900 font-medium' : 'text-left'
                      }`}
                    >
                      {cell !== null && cell !== undefined ? String(cell) : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
