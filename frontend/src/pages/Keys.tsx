import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check, Play, Loader2, Settings2 } from 'lucide-react';

interface AllowedModel {
  id: string;
  model_name: string;
  display_name: string;
}

function StatusDot({ enabled }: { enabled: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-[var(--color-success)] animate-status-pulse' : 'bg-[var(--color-text-dim)]'}`} />
      <span className={`text-[11px] font-mono tracking-wider ${enabled ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dim)]'}`}>
        {enabled ? '启用' : '禁用'}
      </span>
    </span>
  );
}

function TestResult({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className={`text-[12px] font-mono px-4 py-2 border ${
      data.success ? 'border-[var(--color-success)]/30' : 'border-[var(--color-danger)]/30'
    }`}>
      <div className="flex items-center gap-4 flex-wrap">
        <span className={data.success ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>{data.success ? '成功' : '失败'}</span>
        <span className="text-[var(--color-text-muted)]">模型: <code className="text-[var(--color-text)]">{data.model}</code></span>
        <span className="text-[var(--color-text-muted)]">延迟: <code className="text-[var(--color-text)]">{data.latency_ms}ms</code></span>
        {data.success && (
          <>
            <span className="text-[var(--color-text-muted)]">输入: <code className="text-[var(--color-text)]">{data.tokens?.input}</code></span>
            <span className="text-[var(--color-text-muted)]">输出: <code className="text-[var(--color-text)]">{data.tokens?.output}</code></span>
          </>
        )}
        {data.error_message && (
          <span className="truncate max-w-md" title={data.error_message}>{data.error_message}</span>
        )}
      </div>
      {data.response_text && (
        <div className="mt-2 p-2 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] leading-relaxed max-h-32 overflow-y-auto">
          {data.response_text}
        </div>
      )}
    </div>
  );
}

function ModelBadges({ models }: { models: AllowedModel[] }) {
  if (!models || models.length === 0) {
    return <span className="text-[11px] font-mono text-[var(--color-accent)] tracking-wider">全部模型</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {models.map(m => (
        <span key={m.id} className="text-[11px] font-mono px-2 py-0.5 border border-[var(--color-border)] text-[var(--color-text-muted)]">{m.model_name}</span>
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
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});

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
      const msg = testMessages[id] || 'Hi';
      const res = await api.testKey(id, msg);
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

  const btnClass = "px-4 py-2 text-[12px] font-mono tracking-wider cursor-pointer border border-[var(--color-border)] transition-colors hover:bg-white hover:text-black hover:border-white";
  const btnPrimaryClass = "px-4 py-2 text-[12px] font-mono tracking-wider cursor-pointer bg-white text-black border border-white transition-opacity hover:opacity-85";
  const inputClass = "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] font-mono focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-dim)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">API 密钥</h2>
          <p className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-[0.2em] mt-1">管理密钥</p>
        </div>
        <button onClick={() => { setShowCreate(true); setNewKey(null); }}
          className={btnPrimaryClass}>
          <span className="flex items-center gap-2"><Plus size={14} /> 创建密钥</span>
        </button>
      </div>

      {error && (
        <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-6 text-[var(--color-danger)] text-[12px] font-mono">{error}</div>
      )}

      {newKey && (
        <div className="border border-[var(--color-accent)]/30 px-6 py-5 mb-6 bg-[var(--color-accent-dim)]">
          <h3 className="font-mono text-[13px] text-[var(--color-accent)] tracking-wider mb-2">密钥已创建</h3>
          <p className="text-[12px] text-[var(--color-text-muted)] mb-3 font-mono">保存此密钥，关闭后无法再次查看</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-[var(--color-bg)] px-4 py-2 text-[var(--color-accent)] text-[13px] font-mono break-all">{newKey}</code>
            <button onClick={() => copyKey(newKey)}
              className="p-2 border border-[var(--color-border)] hover:bg-white hover:text-black transition-colors text-[var(--color-text-muted)]">
              {copied === newKey ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="glass-card p-6 mb-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider mb-1.5">名称</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  className={inputClass} placeholder="生产环境密钥" required />
              </div>
              <div>
                <label className="block font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider mb-1.5">速率限制 (RPM)</label>
                <input type="number" value={newRpm} onChange={e => setNewRpm(Number(e.target.value))}
                  className={inputClass} />
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 text-[12px] font-mono text-[var(--color-text-muted)]">
                <input type="checkbox" checked={allModels} onChange={e => setAllModels(e.target.checked)}
                  className="border-[var(--color-border)] bg-[var(--color-bg)] accent-white" />
                允许所有模型
              </label>
              {!allModels && models.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-[var(--color-bg)] border border-[var(--color-border)] mt-2 max-h-40 overflow-y-auto">
                  {models.map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-[11px] font-mono text-[var(--color-text-muted)] cursor-pointer">
                      <input type="checkbox" checked={selectedModelIds.includes(m.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedModelIds(prev => [...prev, m.id]);
                          else setSelectedModelIds(prev => prev.filter(id => id !== m.id));
                        }}
                        className="border-[var(--color-border)] bg-[var(--color-bg)] accent-white" />
                      {m.model_name}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button type="submit" className={btnPrimaryClass}>创建</button>
              <button type="button" onClick={() => setShowCreate(false)} className={btnClass}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--color-surface-light)] border-b border-[var(--color-border)]">
            <tr>
              <th className="text-left p-4 font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider font-normal">名称</th>
              <th className="text-left p-4 font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider font-normal">前缀</th>
              <th className="text-left p-4 font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider font-normal">状态</th>
              <th className="text-left p-4 font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider font-normal">模型</th>
              <th className="text-left p-4 font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider font-normal">最后使用</th>
              <th className="text-right p-4 font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider font-normal">操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr><td colSpan={6} className="p-12 text-center text-[var(--color-text-dim)] text-[12px] font-mono">暂无密钥 — 点击上方按钮创建</td></tr>
            )}
            {keys.map(key => (
              <React.Fragment key={key.id}>
              <tr className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-light)]/50 transition-colors">
                <td className="p-4 text-[var(--color-text)]">{key.name}</td>
                <td className="p-4">
                  <code className="text-[12px] font-mono text-[var(--color-text-muted)]">sk-{key.key_prefix}...</code>
                </td>
                <td className="p-4"><StatusDot enabled={key.is_enabled} /></td>
                <td className="p-4"><ModelBadges models={key.allowed_models} /></td>
                <td className="p-4 text-[var(--color-text-dim)] text-[11px] font-mono">
                  {key.last_used_at ? new Date(key.last_used_at).toLocaleString() : '—'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => handleEditModels(key)}
                      className="p-1.5 hover:bg-[var(--color-surface-light)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)]" title="模型权限">
                      <Settings2 size={14} />
                    </button>
                    <button onClick={() => handleTest(key.id)}
                      disabled={testing === key.id}
                      className="p-1.5 hover:bg-[var(--color-surface-light)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-accent)] disabled:opacity-40" title="测试密钥">
                      {testing === key.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    </button>
                    <button onClick={() => handleToggle(key.id)} className="p-1.5 hover:bg-[var(--color-surface-light)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                      {key.is_enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                    <button onClick={() => handleDelete(key.id)} className="p-1.5 hover:bg-[var(--color-danger)]/10 transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-danger)]">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
              {testResults[key.id] && (
                <tr key={`${key.id}-test`} className="border-t border-[var(--color-border)] bg-[var(--color-surface-light)]/30">
                  <td colSpan={6} className="p-3">
                    <TestResult data={testResults[key.id]} />
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        value={testMessages[key.id] || ''}
                        onChange={e => setTestMessages(prev => ({ ...prev, [key.id]: e.target.value }))}
                        placeholder="输入测试消息 (默认 Hi)..."
                        className="flex-1 px-2 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-[11px] font-mono focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-dim)]"
                      />
                      <button
                        onClick={() => handleTest(key.id)}
                        disabled={testing === key.id}
                        className="px-3 py-1 text-[11px] font-mono tracking-wider bg-white text-black border border-white cursor-pointer hover:opacity-85 disabled:opacity-40 transition-opacity"
                      >
                        {testing === key.id ? '...' : '发送'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {editingKey && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setEditingKey(null)}>
          <div className="glass-card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-mono text-[13px] text-[var(--color-text)] tracking-wider mb-4">模型权限 — {editingKey.name}</h3>
            <label className="flex items-center gap-2 text-[12px] font-mono text-[var(--color-text-muted)] mb-3">
              <input type="checkbox" checked={editAllModels} onChange={e => setEditAllModels(e.target.checked)}
                className="border-[var(--color-border)] bg-[var(--color-bg)] accent-white" />
              ALLOW 全部模型
            </label>
            {!editAllModels && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-[var(--color-bg)] border border-[var(--color-border)] max-h-48 overflow-y-auto mb-4">
                {models.map(m => (
                  <label key={m.id} className="flex items-center gap-2 text-[11px] font-mono text-[var(--color-text-muted)] cursor-pointer">
                    <input type="checkbox" checked={editSelectedIds.includes(m.id)}
                      onChange={e => {
                        if (e.target.checked) setEditSelectedIds(prev => [...prev, m.id]);
                        else setEditSelectedIds(prev => prev.filter(id => id !== m.id));
                      }}
                      className="border-[var(--color-border)] bg-[var(--color-bg)] accent-white" />
                    {m.model_name}
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={handleSaveModels} className={btnPrimaryClass}>保存</button>
              <button onClick={() => setEditingKey(null)} className={btnClass}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
