import React, { useState, useEffect } from 'react';
import { 
  X, Database, ShieldCheck, ArrowRight, Check, Lock, 
  Plus, Trash2, KeyRound, Server, AlertCircle
} from 'lucide-react';
import { DatabasePreset } from '../types';

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onApplyConnection: (url: string, datasourceId?: string) => Promise<boolean>;
}

export const DatabaseModal: React.FC<DatabaseModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  onApplyConnection
}) => {
  const [modalTab, setModalTab] = useState<'presets' | 'add'>('presets');
  const [presets, setPresets] = useState<DatabasePreset[]>([]);
  const [customSources, setCustomSources] = useState<DatabasePreset[]>([]);
  
  // 选中的数据源
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedMaskedUrl, setSelectedMaskedUrl] = useState<string>(currentUrl);
  
  // 表单状态 (新建数据源)
  const [inputType, setInputType] = useState<'form' | 'raw'>('form');
  const [formName, setFormName] = useState('');
  const [formDbType, setFormDbType] = useState<'postgresql' | 'mysql' | 'sqlite'>('postgresql');
  const [formHost, setFormHost] = useState('');
  const [formPort, setFormPort] = useState('5432');
  const [formDatabase, setFormDatabase] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [rawConnectionUrl, setRawConnectionUrl] = useState('');

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // 拉取预设与用户加密数据源
  const fetchDatasources = async () => {
    const token = localStorage.getItem('datapulse_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch('/api/v1/database/presets', { headers });
      if (res.ok) {
        const data = await res.json();
        setPresets(data.presets || []);
        setCustomSources(data.custom_datasources || []);
      }
    } catch (e) {
      console.error('拉取数据源列表失败', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDatasources();
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 选择已脱敏的数据源预设
  const handleSelectPreset = (item: DatabasePreset) => {
    setSelectedId(item.id);
    setSelectedMaskedUrl(item.masked_url);
    setTestResult(null);
  };

  // 挂载选中的数据源
  const handleMountAndConnect = async () => {
    if (!selectedMaskedUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const ok = await onApplyConnection(selectedMaskedUrl.trim(), selectedId);
      if (ok) {
        setTestResult({ success: true, msg: "✓ 数据库挂载成功！密码已在密柜中安全还原并探查" });
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setTestResult({ success: false, msg: "❌ 数据库挂载失败，请检查网络权限" });
      }
    } catch (e: any) {
      setTestResult({ success: false, msg: `❌ 挂载错误: ${e.message}` });
    } finally {
      setIsTesting(false);
    }
  };

  // 提交新建自定义数据源 (先测试连通性，再对称加密存库)
  const handleSaveCustomSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTestResult(null);

    const token = localStorage.getItem('datapulse_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const payload = inputType === 'raw' 
      ? {
          name: formName.trim() || '自定义连接串',
          db_type: formDbType,
          connection_url: rawConnectionUrl.trim(),
          description: formDesc.trim() || undefined
        }
      : {
          name: formName.trim(),
          db_type: formDbType,
          host: formHost.trim(),
          port: parseInt(formPort, 10) || (formDbType === 'postgresql' ? 5432 : 3306),
          database: formDatabase.trim(),
          username: formUser.trim() || undefined,
          password: formPassword || undefined,
          description: formDesc.trim() || undefined
        };

    try {
      const res = await fetch('/api/v1/database/custom', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || '连通性测试失败');
      }

      setTestResult({ success: true, msg: "✅ 数据库测试成功！密码已对称加密托管，前端仅保留脱敏掩码" });
      await fetchDatasources();
      
      // 自动选中新数据源并切回列表
      if (data.datasource) {
        setSelectedId(data.datasource.id);
        setSelectedMaskedUrl(data.datasource.masked_url);
      }
      setTimeout(() => {
        setModalTab('presets');
        setTestResult(null);
      }, 1500);

    } catch (err: any) {
      setTestResult({ success: false, msg: `❌ 接入失败: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  // 删除自定义数据源
  const handleDeleteCustomSource = async (e: React.MouseEvent, id?: string) => {
    e.stopPropagation();
    if (!id) return;
    if (!confirm('确定要移除此私有数据源配置吗？')) return;

    const token = localStorage.getItem('datapulse_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`/api/v1/database/custom/${id}`, {
        method: 'DELETE',
        headers
      });
      if (res.ok) {
        fetchDatasources();
        if (selectedId === id) {
          setSelectedId(undefined);
          setSelectedMaskedUrl('sqlite:///backend/data/sales_demo.sqlite');
        }
      }
    } catch (e) {
      console.error('删除数据源失败', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs no-print animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-neutral-900">数据源接入与凭据加密中心</h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/50 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  账密脱敏防护
                </span>
              </div>
              <p className="text-xs text-neutral-500">连接串自动掩码保护，后端对称加密存储，不对外暴露真实敏感凭据</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 选项卡切换 */}
        <div className="flex border-b border-neutral-100 px-6 pt-3 bg-white">
          <button
            onClick={() => { setModalTab('presets'); setTestResult(null); }}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              modalTab === 'presets'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>可用数据源列表 ({presets.length + customSources.length})</span>
          </button>
          <button
            onClick={() => { setModalTab('add'); setTestResult(null); }}
            className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              modalTab === 'add'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>接入新真实数据库 (加密密柜)</span>
          </button>
        </div>

        {/* 主体内容 */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {testResult && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {testResult.success ? <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
              <span className="font-medium">{testResult.msg}</span>
            </div>
          )}

          {modalTab === 'presets' ? (
            <div className="space-y-4">
              {/* 用户自定义已加密库 */}
              {customSources.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                      我的私有加密数据源
                    </span>
                    <span className="text-[10px] text-neutral-400">已对称加密落库</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5">
                    {customSources.map((item) => {
                      const isSelected = selectedId === item.id || selectedMaskedUrl === item.masked_url;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectPreset(item)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/20 shadow-xs'
                              : 'border-neutral-200/90 bg-white hover:border-neutral-300 hover:shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase bg-blue-100 text-blue-800">
                                  {item.type}
                                </span>
                                <h4 className="text-xs font-bold text-neutral-800 truncate">
                                  {item.name}
                                </h4>
                                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/50 flex items-center gap-0.5">
                                  <Lock className="w-2.5 h-2.5" />
                                  密码已加密
                                </span>
                              </div>
                              <p className="font-mono text-[11px] text-neutral-500 truncate mt-1 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-100">
                                {item.masked_url}
                              </p>
                              {item.description && (
                                <p className="text-[11px] text-neutral-400 mt-1">{item.description}</p>
                              )}
                            </div>

                            <button
                              onClick={(e) => handleDeleteCustomSource(e, item.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="移除此私有数据源"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 预设数据源 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-neutral-600" />
                    内置与云端真实预设
                  </span>
                  <span className="text-[10px] text-neutral-400">点击选中后即可快速挂载</span>
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {presets.map((item, idx) => {
                    const isSelected = selectedId === item.id || selectedMaskedUrl === item.masked_url;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleSelectPreset(item)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/20 shadow-xs'
                            : 'border-neutral-200/90 bg-white hover:border-neutral-300 hover:shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                                item.type === 'postgresql' ? 'bg-indigo-100 text-indigo-800' : 'bg-neutral-100 text-neutral-700'
                              }`}>
                                {item.type}
                              </span>
                              <h4 className="text-xs font-bold text-neutral-800 truncate">
                                {item.name}
                              </h4>
                              {item.masked_url.includes('******') && (
                                <span className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                  <Lock className="w-2.5 h-2.5" />
                                  已脱敏
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-neutral-500 truncate mt-1 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-100">
                              {item.masked_url}
                            </p>
                            <p className="text-[11px] text-neutral-400 mt-1">{item.description}</p>
                          </div>

                          <div className="shrink-0 mt-1">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-neutral-300 bg-white'
                            }`}>
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* 新增私有数据源表单 */
            <form onSubmit={handleSaveCustomSource} className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <span className="text-xs font-bold text-neutral-800">数据库凭据安全密柜录入</span>
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setInputType('form')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      inputType === 'form' ? 'bg-white text-neutral-900 shadow-xs font-semibold' : 'text-neutral-500'
                    }`}
                  >
                    分段表单录入
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputType('raw')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      inputType === 'raw' ? 'bg-white text-neutral-900 shadow-xs font-semibold' : 'text-neutral-500'
                    }`}
                  >
                    直接粘贴连接串
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  数据源别名与备注 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="例如: 华东财务只读库"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="选填描述 (例如: 仅含订单与用户表)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              {inputType === 'form' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">数据库类型</label>
                      <select
                        value={formDbType}
                        onChange={(e: any) => {
                          setFormDbType(e.target.value);
                          setFormPort(e.target.value === 'postgresql' ? '5432' : e.target.value === 'mysql' ? '3306' : '');
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 bg-white focus:outline-hidden focus:border-blue-500 transition-all font-semibold"
                      >
                        <option value="postgresql">PostgreSQL (推荐)</option>
                        <option value="mysql">MySQL 5.7 / 8.0</option>
                        <option value="sqlite">SQLite 本地/挂载文件</option>
                      </select>
                    </div>

                    {formDbType !== 'sqlite' && (
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">端口 Port</label>
                        <input
                          type="number"
                          value={formPort}
                          onChange={(e) => setFormPort(e.target.value)}
                          placeholder="5432"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 font-mono"
                        />
                      </div>
                    )}
                  </div>

                  {formDbType !== 'sqlite' ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">主机 Host / IP</label>
                          <input
                            type="text"
                            required
                            value={formHost}
                            onChange={(e) => setFormHost(e.target.value)}
                            placeholder="例如: 49.233.222.54 或 localhost"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">数据库名 Database</label>
                          <input
                            type="text"
                            required
                            value={formDatabase}
                            onChange={(e) => setFormDatabase(e.target.value)}
                            placeholder="例如: platform_api"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 font-mono"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">用户名 Username</label>
                          <input
                            type="text"
                            value={formUser}
                            onChange={(e) => setFormUser(e.target.value)}
                            placeholder="例如: reader_user"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1 flex items-center gap-1">
                            <span>密码 Password</span>
                            <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded font-normal">落库加密</span>
                          </label>
                          <input
                            type="password"
                            value={formPassword}
                            onChange={(e) => setFormPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 font-mono"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">SQLite 绝对文件路径</label>
                      <input
                        type="text"
                        required
                        value={formDatabase}
                        onChange={(e) => setFormDatabase(e.target.value)}
                        placeholder="例如: /home/ubuntu/data/mydb.sqlite"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 font-mono"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    完整连接串 (系统将自动提取并进行密码对称加密)
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={rawConnectionUrl}
                    onChange={(e) => setRawConnectionUrl(e.target.value)}
                    placeholder="例如: postgresql://username:password@host:5432/database"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 font-mono resize-none"
                  />
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>验证连通性并加密入库</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* 底部操作控制 */}
        {modalTab === 'presets' && (
          <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
            <div className="text-xs text-neutral-500 truncate max-w-sm">
              当前挂载: <span className="font-mono text-neutral-800 font-semibold">{selectedMaskedUrl}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 text-xs font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleMountAndConnect}
                disabled={isTesting}
                className="px-4 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isTesting ? (
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full" />
                ) : (
                  <>
                    <span>挂载并切换数据库</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
