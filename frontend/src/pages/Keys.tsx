import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check, Play, Loader2, Settings2 } from 'lucide-react';

interface AllowedModel {
  id: string;
  model_name: string;
  display_name: string;
}

function TestResult({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className={`flex items-center gap-4 text-sm rounded-lg px-4 py-2 ${
      data.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'
    }`}>
      <span className={`font-medium ${data.success ? 'text-green-400' : 'text-red-400'}`}>
        {data.success ? '连通成功' : '连通失败'}
      </span>
      <span className="text-slate-400">模型: <code className="text-slate-300">{data.model}</code></span>
      <span className="text-slate-400">延迟: <code className="text-slate-300">{data.latency_ms}ms</code></span>
      {data.success && (
        <>
          <span className="text-slate-400">输入: <code className="text-slate-300">{data.tokens?.input}</code></span>
          <span className="text-slate-400">输出: <code className="text-slate-300">{data.tokens?.output}</code></span>
        </>
      )}
      {data.error_message && (
        <span className="text-red-400 truncate max-w-md" title={data.error_message}>{data.error_message}</span>
      )}
    </div>
  );
}

function ModelBadges({ models }: { models: AllowedModel[] }) {
  if (!models || models.length === 0) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-indigo-500/10 text-indigo-400">全部模型</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {models.map(m => (
        <span key={m.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300">{m.model_name}</span>
      ))}
    </div>
  );
}

export default function Keys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRpm, setNewRpm] = useState(60);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [models, setModels] = useState<AllowedModel[]>([]);
  const [allModels, setAllModels] = useState(true);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [editingKey, setEditingKey] = useState<any>(null);
  const [editAllModels, setEditAllModels] = useState(true);
  const [editSelectedIds, setEditSelectedIds] = useState<string[]>([]);

  const loadKeys = async () => {
    try {
      const res = await api.listKeys();
      if (res.ok) setKeys(await res.json());
      else setError('无法加载密钥列表');
    } catch {
      setError('网络错误，请稍后重试');
    }
  };

  const loadModels = async () => {
    try {
      const res = await api.listModels();
      if (res.ok) setModels(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => { loadKeys(); loadModels(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.createKey({
      name: newName,
      rate_limit_rpm: newRpm,
      model_ids: allModels ? undefined : selectedModelIds,
    });
    if (res.ok) {
      const data = await res.json();
      setNewKey(data.full_key);
      setShowCreate(false);
      setNewName('');
      setAllModels(true);
      setSelectedModelIds([]);
      loadKeys();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定删除此密钥吗？删除后立即失效。')) {
      setError(null);
      const res = await api.deleteKey(id);
      if (res.ok) loadKeys();
      else setError('删除密钥失败');
    }
  };

  const handleToggle = async (id: string) => {
    setError(null);
    const res = await api.toggleKey(id);
    if (res.ok) loadKeys();
    else setError('切换密钥状态失败');
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setTestResults(prev => ({ ...prev, [id]: null }));
    try {
      const res = await api.testKey(id);
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [id]: data }));
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { success: false, error_message: '网络错误' } }));
    } finally {
      setTesting(null);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleEditModels = (key: any) => {
    setEditingKey(key);
    if (!key.allowed_models || key.allowed_models.length === 0) {
      setEditAllModels(true);
      setEditSelectedIds([]);
    } else {
      setEditAllModels(false);
      setEditSelectedIds(key.allowed_models.map((m: AllowedModel) => m.id));
    }
  };

  const handleSaveModels = async () => {
    if (!editingKey) return;
    const res = await api.updateKeyModels(editingKey.id, editAllModels ? [] : editSelectedIds);
    if (res.ok) {
      setEditingKey(null);
      loadKeys();
    } else {
      setError('更新模型权限失败');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">API 密钥</h2>
        <button onClick={() => { setShowCreate(true); setNewKey(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> 创建密钥
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">{error}</div>
      )}

      {newKey && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 mb-6">
          <h3 className="text-green-400 font-semibold mb-2">密钥创建成功</h3>
          <p className="text-sm text-slate-300 mb-3">请立即保存密钥，关闭后无法再次查看！</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-900 px-4 py-2 rounded-lg text-green-400 text-sm break-all">{newKey}</code>
            <button onClick={() => copyKey(newKey)}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">
              {copied === newKey ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">密钥名称</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  placeholder="例如：生产环境密钥" required />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">速率限制（次/分钟）</label>
                <input type="number" value={newRpm} onChange={e => setNewRpm(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                <input type="checkbox" checked={allModels} onChange={e => setAllModels(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500" />
                允许访问所有模型
              </label>
              {!allModels && models.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-slate-900 rounded-lg border border-slate-600 max-h-40 overflow-y-auto">
                  {models.map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                      <input type="checkbox" checked={selectedModelIds.includes(m.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedModelIds(prev => [...prev, m.id]);
                          else setSelectedModelIds(prev => prev.filter(id => id !== m.id));
                        }}
                        className="rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500" />
                      {m.display_name || m.model_name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm">创建</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">取消</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="text-left p-4 text-slate-300 font-medium">名称</th>
              <th className="text-left p-4 text-slate-300 font-medium">前缀</th>
              <th className="text-left p-4 text-slate-300 font-medium">状态</th>
              <th className="text-left p-4 text-slate-300 font-medium">可用模型</th>
              <th className="text-left p-4 text-slate-300 font-medium">最后使用</th>
              <th className="text-right p-4 text-slate-300 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">暂无 API 密钥，点击上方按钮创建</td></tr>
            )}
            {keys.map(key => (
              <React.Fragment key={key.id}>
              <tr className="border-t border-slate-700/50">
                <td className="p-4 text-white">{key.name}</td>
                <td className="p-4">
                  <code className="text-slate-300 text-xs bg-slate-900 px-2 py-1 rounded">sk-{key.key_prefix}...</code>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                    key.is_enabled ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>{key.is_enabled ? '启用' : '已禁用'}</span>
                </td>
                <td className="p-4">
                  <ModelBadges models={key.allowed_models} />
                </td>
                <td className="p-4 text-slate-400 text-xs">
                  {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : '从未使用'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => handleEditModels(key)}
                      className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                      title="模型权限">
                      <Settings2 size={16} />
                    </button>
                    <button onClick={() => handleTest(key.id)}
                      disabled={testing === key.id}
                      className="p-1.5 hover:bg-indigo-500/20 rounded text-slate-400 hover:text-indigo-400 disabled:opacity-50"
                      title="测试密钥">
                      {testing === key.id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    </button>
                    <button onClick={() => handleToggle(key.id)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                      {key.is_enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => handleDelete(key.id)} className="p-1.5 hover:bg-red-500/20 rounded text-slate-400 hover:text-red-400">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
              {testResults[key.id] && (
                <tr key={`${key.id}-test`} className="border-t border-slate-700/50">
                  <td colSpan={6} className="p-4">
                    <TestResult data={testResults[key.id]} />
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {editingKey && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingKey(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">模型权限 — {editingKey.name}</h3>
            <label className="flex items-center gap-2 text-sm text-slate-300 mb-3">
              <input type="checkbox" checked={editAllModels} onChange={e => setEditAllModels(e.target.checked)}
                className="rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500" />
              允许访问所有模型
            </label>
            {!editAllModels && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-900 rounded-lg border border-slate-600 max-h-48 overflow-y-auto mb-4">
                {models.map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={editSelectedIds.includes(m.id)}
                      onChange={e => {
                        if (e.target.checked) setEditSelectedIds(prev => [...prev, m.id]);
                        else setEditSelectedIds(prev => prev.filter(id => id !== m.id));
                      }}
                      className="rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500" />
                    {m.display_name || m.model_name}
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={handleSaveModels} className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm">保存</button>
              <button onClick={() => setEditingKey(null)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
