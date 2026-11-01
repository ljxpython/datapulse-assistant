import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Calendar, HardDrive, Sparkles, RefreshCw, Eye } from 'lucide-react';
import { ReportPreviewModal } from './ReportPreviewModal';

interface ArchivedReportItem {
  file_name: string;
  title: string;
  size_bytes: number;
  updated_at: string;
  download_url: string;
}

interface ArchivedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchivedModal: React.FC<ArchivedModalProps> = ({ isOpen, onClose }) => {
  const [reports, setReports] = useState<ArchivedReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewFileName, setPreviewFileName] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | undefined>(undefined);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/reports/list');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch {
      // 忽略
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleOpenPreview = (fileName: string, title: string) => {
    setPreviewFileName(fileName);
    setPreviewTitle(title);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs no-print">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
          {/* 顶部标题栏 */}
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">落盘归档研报文档库</h3>
                <p className="text-xs text-neutral-500">所有经过人类分析师审查确认落盘的真实 Markdown 报告</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={fetchReports}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                title="刷新文档列表"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 列表内容 */}
          <div className="p-6 overflow-y-auto space-y-3 flex-1">
            {reports.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-xs">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
                <p>暂无落盘归档的研报文档</p>
                <p className="text-[11px] text-neutral-400 mt-1">在分析卡片右上角点击“确认落盘”后即可在此集中查看与下载</p>
              </div>
            ) : (
              reports.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-neutral-200/80 bg-white hover:border-neutral-300 hover:shadow-xs transition-all flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/50">
                        .MD
                      </span>
                      <h4 className="text-xs font-bold text-neutral-800 truncate" title={item.title}>
                        {item.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {item.updated_at}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <HardDrive className="w-3 h-3" />
                        {formatSize(item.size_bytes)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenPreview(item.file_name, item.title)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold transition-colors shadow-2xs"
                      title="在线阅读研报内容与数据"
                    >
                      <Eye className="w-3.5 h-3.5 text-neutral-500" />
                      <span>预览</span>
                    </button>

                    <a
                      href={item.download_url}
                      download={item.file_name}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>下载</span>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 底部 */}
          <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
            <span>共计 {reports.length} 篇落盘文档</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-medium transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>

      {/* 嵌入预览 Modal */}
      <ReportPreviewModal
        isOpen={Boolean(previewFileName)}
        onClose={() => setPreviewFileName(null)}
        fileName={previewFileName}
        initialTitle={previewTitle}
      />
    </>
  );
};
