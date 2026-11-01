import React, { useState, useEffect } from 'react';
import { 
  X, FileText, Download, Copy, Check, Eye, Code, 
  RefreshCw, AlertCircle, Table as TableIcon,
  ShieldCheck
} from 'lucide-react';

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string | null;
  initialTitle?: string;
}

interface PreviewData {
  file_name: string;
  title: string;
  content: string;
  size_bytes: number;
  updated_at: string;
  download_url: string;
}

export const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({
  isOpen,
  onClose,
  fileName,
  initialTitle
}) => {
  const [data, setData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rendered' | 'raw'>('rendered');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && fileName) {
      fetchPreview(fileName);
    } else {
      setData(null);
      setErrorMsg(null);
    }
  }, [isOpen, fileName]);

  const fetchPreview = async (name: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/reports/preview/${encodeURIComponent(name)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: '加载研报失败' }));
        throw new Error(err.detail || '读取失败');
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setErrorMsg(e.message || '网络连接异常');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!data?.content) return;
    navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  // 全要素结构化 Markdown 渲染引擎 (包含内嵌矢量 SVG 图表、高管指标卡、SQL 终端与明细表格)
  const renderStructuredMarkdown = (content: string) => {
    // 1. 预提取所有 <svg ... </svg> 矢量图表，用唯一 token 占位，彻底免疫 Markdown 换行/空行/缩进切片
    const svgBlocks: string[] = [];
    const preprocessed = content.replace(/<svg[\s\S]*?<\/svg>/gi, (match) => {
      const idx = svgBlocks.length;
      svgBlocks.push(match);
      return `\n\n@@DATAPULSE_SVG_BLOCK_${idx}@@\n\n`;
    });

    const lines = preprocessed.split('\n');
    const elements: React.ReactNode[] = [];
    
    let inCodeBlock = false;
    let codeLines: string[] = [];
    let tableRows: string[] = [];
    let kpiItems: { label: string; value: string }[] = [];

    const flushKpis = (keyPrefix: number) => {
      if (kpiItems.length === 0) return null;
      const items = [...kpiItems];
      kpiItems = [];
      return (
        <div key={`kpis-${keyPrefix}`} className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          {items.map((kpi, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-neutral-50/80 border border-neutral-200/90 shadow-2xs">
              <span className="text-xs text-neutral-400 font-semibold block">{kpi.label}</span>
              <span className="text-lg font-extrabold text-neutral-900 mt-1 block tracking-tight font-mono">
                {kpi.value}
              </span>
            </div>
          ))}
        </div>
      );
    };

    const flushTable = (keyPrefix: number) => {
      if (tableRows.length === 0) return null;
      const rows = [...tableRows];
      tableRows = [];

      const headerLine = rows[0];
      const bodyLines = rows.slice(2);

      const parseCols = (line: string) => 
        line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);

      const headers = parseCols(headerLine);

      return (
        <div key={`table-${keyPrefix}`} className="my-5 rounded-xl border border-neutral-200 overflow-hidden shadow-2xs">
          <div className="bg-neutral-100/80 px-4 py-2 border-b border-neutral-200 flex items-center justify-between text-xs text-neutral-600 font-semibold">
            <span className="flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-blue-600" />
              明细数据切片表
            </span>
            <span className="text-[11px] font-mono text-neutral-400">共 {bodyLines.length} 行切片样本</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-50 text-neutral-700 font-bold border-b border-neutral-200">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-3.5 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {bodyLines.map((rowLine, rIdx) => {
                  const cols = parseCols(rowLine);
                  return (
                    <tr key={rIdx} className="hover:bg-neutral-50/80 transition-colors">
                      {cols.map((col, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2 whitespace-nowrap text-neutral-800 font-mono">
                          {col}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 1. 处理内嵌 SVG 矢量图表占位符
      const svgMatch = line.match(/@@DATAPULSE_SVG_BLOCK_(\d+)@@/);
      if (svgMatch) {
        if (kpiItems.length > 0) elements.push(flushKpis(i * 10 + 1));
        if (tableRows.length > 0) elements.push(flushTable(i * 10 + 2));
        const blockIdx = parseInt(svgMatch[1], 10);
        const rawSvg = svgBlocks[blockIdx];
        if (rawSvg) {
          elements.push(
            <div 
              key={`svg-block-${blockIdx}`} 
              className="my-5 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white p-2 shadow-xs"
              dangerouslySetInnerHTML={{ __html: rawSvg }} 
            />
          );
        }
        continue;
      }

      // 2. 处理代码块 ```sql ... ```
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          elements.push(
            <div key={`code-${i}`} className="my-5 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shadow-inner">
              <div className="px-4 py-2 bg-neutral-800/80 border-b border-neutral-700/60 flex items-center justify-between">
                <span className="text-[11px] font-mono text-neutral-400 font-semibold tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  经过 AST 安全沙箱审查的执行 SQL
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 font-mono">
                  LIMIT 500 自动注入保护
                </span>
              </div>
              <pre className="p-4 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                {codeLines.join('\n')}
              </pre>
            </div>
          );
          codeLines = [];
        } else {
          inCodeBlock = true;
          codeLines = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // 3. 处理 Markdown 表格
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        tableRows.push(line);
        continue;
      } else if (tableRows.length > 0) {
        elements.push(flushTable(i));
      }

      // 4. 识别高管核心大指标列表并升级为大卡片
      const kpiMatch = line.match(/^-\s+\*\*(.*?)\*\*:\s*(.*)$/);
      if (kpiMatch) {
        kpiItems.push({ label: kpiMatch[1], value: kpiMatch[2] });
        continue;
      } else if (kpiItems.length > 0) {
        elements.push(flushKpis(i));
      }

      // 5. 处理标题 #
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={`h1-${i}`} className="text-xl sm:text-2xl font-extrabold text-neutral-900 mt-2 mb-4 tracking-tight">
            {line.replace('# ', '')}
          </h1>
        );
        continue;
      }

      // 6. 处理二级标题 ##
      if (line.startsWith('## ')) {
        elements.push(
          <div key={`h2-${i}`} className="flex items-center gap-2 mt-7 mb-3 border-b border-neutral-100 pb-2">
            <div className="w-1.5 h-4 rounded-full bg-blue-600"></div>
            <h2 className="text-sm sm:text-base font-bold text-neutral-800">
              {line.replace('## ', '')}
            </h2>
          </div>
        );
        continue;
      }

      // 7. 处理引用块 >
      if (line.startsWith('> ')) {
        elements.push(
          <div key={`quote-${i}`} className="my-1.5 pl-3.5 py-1 border-l-2 border-blue-500 text-xs text-neutral-600 font-medium bg-blue-50/25 rounded-r-lg leading-relaxed">
            {line.replace('> ', '')}
          </div>
        );
        continue;
      }

      // 8. 处理水平线 ---
      if (line.trim() === '---') {
        elements.push(<hr key={`hr-${i}`} className="my-5 border-neutral-200/80" />);
        continue;
      }

      // 普通段落
      if (line.trim()) {
        elements.push(
          <p key={`p-${i}`} className="text-xs text-neutral-700 leading-relaxed my-2"
            dangerouslySetInnerHTML={{ 
              __html: line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
            }} 
          />
        );
      }
    }

    if (kpiItems.length > 0) {
      elements.push(flushKpis(9998));
    }
    if (tableRows.length > 0) {
      elements.push(flushTable(9999));
    }

    return elements;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs no-print animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 顶部标题与工具栏 */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/50">
                  .MD PREVIEW
                </span>
                <h3 className="text-sm font-bold text-neutral-900 truncate">
                  {data?.title || initialTitle || fileName || '研报全景预览'}
                </h3>
              </div>
              <p className="text-xs text-neutral-400 truncate mt-0.5 flex items-center gap-2">
                <span>{fileName}</span>
                {data && (
                  <>
                    <span>·</span>
                    <span>{(data.size_bytes / 1024).toFixed(1)} KB</span>
                    <span>·</span>
                    <span>{data.updated_at}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 切换渲染排版 / 原始源码 */}
            <div className="flex items-center gap-1 bg-neutral-200/60 p-1 rounded-xl text-xs">
              <button
                onClick={() => setActiveTab('rendered')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  activeTab === 'rendered' ? 'bg-white text-neutral-900 shadow-xs font-semibold' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>图文排版</span>
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  activeTab === 'raw' ? 'bg-white text-neutral-900 shadow-xs font-semibold' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>源码</span>
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200 px-3 py-1.5 rounded-lg transition-colors shadow-2xs font-medium"
              title="复制 Markdown 全文"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制' : '复制'}</span>
            </button>

            {data?.download_url && (
              <a
                href={data.download_url}
                download={data.file_name}
                className="flex items-center gap-1 text-xs text-white bg-neutral-900 hover:bg-neutral-800 px-3 py-1.5 rounded-lg transition-colors shadow-2xs font-semibold"
                title="直接下载 .md 文件"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载</span>
              </a>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 主内容区 */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white">
          {isLoading ? (
            <div className="py-24 text-center text-neutral-400 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin text-blue-500" />
              <p className="text-xs">正在从磁盘读取研报内容...</p>
            </div>
          ) : errorMsg ? (
            <div className="py-16 text-center text-red-500 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
              <p className="text-xs font-semibold">{errorMsg}</p>
            </div>
          ) : !data?.content ? (
            <div className="py-16 text-center text-neutral-400 text-xs">
              暂无内容
            </div>
          ) : activeTab === 'rendered' ? (
            <div className="prose prose-neutral max-w-none">
              {renderStructuredMarkdown(data.content)}
            </div>
          ) : (
            <div className="rounded-xl bg-neutral-900 p-4 border border-neutral-800">
              <pre className="font-mono text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed">
                {data.content}
              </pre>
            </div>
          )}
        </div>

        {/* 底部信息栏 */}
        <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
          <span>三权分立终审研报 · 嵌入式 SVG 矢量图表与结构化切片</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-medium transition-colors"
          >
            完成预览
          </button>
        </div>

      </div>
    </div>
  );
};
