import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Pencil, Trash2 } from 'lucide-react';

interface Model {
  id: string;
  provider: string;
  model_name: string;
  display_name: string;
  is_enabled: boolean;
  pricing_input: number;
  pricing_output: number;
  max_tokens_limit: number;
  base_url?: string;
  api_key?: string;
}

export default function Models() {
  const [models, setModels] = useState<Model[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Model | null>(null);
  const [saving, setSaving] = useState(false);
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');

  const loadModels = () => {
    api.listModels()
      .then(async r => {
        if (r.ok) setModels(await r.json());
        else setError('无法加载模型列表');
      })
      .catch(() => setError('网络错误，请稍后重试'));
  };

  useEffect(() => { loadModels(); }, []);

  const handleEdit = async (m: Model) => {
    setError(null);
    setEditing({ ...m, api_key: '加载中...' });
    const res = await api.adminGetModel(m.id);
    if (res.ok) {
      const detail = await res.json();
      setEditing({ ...m, base_url: detail.base_url, api_key: detail.api_key });
    } else {
      setEditing({ ...m, api_key: '' });
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const body: Record<string, unknown> = {
      provider: editing.provider,
      model_name: editing.model_name,
      display_name: editing.display_name,
      pricing_input: editing.pricing_input,
      pricing_output: editing.pricing_output,
      max_tokens_limit: editing.max_tokens_limit,
    };
    if (editing.base_url) body['base_url'] = editing.base_url;
    if (editing.api_key) body['api_key'] = editing.api_key;
    const res = await api.adminUpdateModel(editing.id, body);
    if (res.ok) { setEditing(null); loadModels(); }
    else {
      const data = await res.json().catch(() => null);
      setError(data?.detail?.message || data?.detail || '更新失败');
    }
    setSaving(false);
  };

  const handleDelete = async (model: Model) => {
    if (!confirm(`确定删除模型 "${model.display_name}" 吗？此操作不可撤销。`)) return;
    setError(null);
    const res = await api.adminDeleteModel(model.id);
    if (res.ok) loadModels();
    else {
      const data = await res.json().catch(() => null);
      setError(data?.detail?.message || data?.detail || '删除失败');
    }
  };

  const btnClass = "px-4 py-2 text-[12px] font-mono tracking-wider cursor-pointer border border-[var(--color-border)] transition-colors hover:bg-white hover:text-black hover:border-white";
  const btnPrimaryClass = "px-4 py-2 text-[12px] font-mono tracking-wider cursor-pointer bg-white text-black border border-white transition-opacity hover:opacity-85 disabled:opacity-40";
  const inputClass = "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-[12px] font-mono focus:outline-none focus:border-[var(--color-accent)]";

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">可用模型</h2>
        <p className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-[0.2em] mt-1">可用模型列表</p>
      </div>

      {error && (
        <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-6 text-[var(--color-danger)] text-[12px] font-mono">{error}</div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-lg mx-4">
            <h3 className="font-mono text-[13px] text-[var(--color-text)] tracking-wider mb-4">编辑模型</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">提供商</label>
                  <select value={editing.provider} onChange={e => setEditing({ ...editing, provider: e.target.value })}
                    className={inputClass}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="azure">Azure</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="xiaomi">Xiaomi MiMo</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">模型名称</label>
                  <input value={editing.model_name} onChange={e => setEditing({ ...editing, model_name: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">显示名称</label>
                  <input value={editing.display_name} onChange={e => setEditing({ ...editing, display_name: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">最大 Token</label>
                  <input type="number" value={editing.max_tokens_limit} onChange={e => setEditing({ ...editing, max_tokens_limit: Number(e.target.value) })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">输入价格 ($/1K)</label>
                  <input type="number" step="0.000001" value={editing.pricing_input} onChange={e => setEditing({ ...editing, pricing_input: Number(e.target.value) })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">输出价格 ($/1K)</label>
                  <input type="number" step="0.000001" value={editing.pricing_output} onChange={e => setEditing({ ...editing, pricing_output: Number(e.target.value) })}
                    className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">接口地址</label>
                  <input value={editing.base_url || ''} onChange={e => setEditing({ ...editing, base_url: e.target.value })}
                    className={inputClass} placeholder="https://api.deepseek.com/v1" />
                </div>
                <div className="col-span-2">
                  <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">上游 API 密钥</label>
                  <input value={editing.api_key || ''} onChange={e => setEditing({ ...editing, api_key: e.target.value })}
                    className={inputClass} />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleSave} disabled={saving} className={btnPrimaryClass}>{saving ? '保存中...' : '保存'}</button>
                <button onClick={() => setEditing(null)} className={btnClass}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map(model => (
          <div key={model.id} className="glass-card p-5 group">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[var(--color-text)] text-[15px]">{model.display_name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-1 border border-[var(--color-border)] text-[var(--color-text-muted)] tracking-wider uppercase">{model.provider}</span>
                {isAdmin && (
                  <>
                    <button onClick={() => handleEdit(model)} className="p-1.5 hover:bg-[var(--color-surface-light)] transition-colors text-[var(--color-text-dim)] hover:text-[var(--color-accent)]" title="编辑">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => handleDelete(model)} className="p-1.5 hover:bg-[var(--color-danger)]/10 transition-colors text-[var(--color-text-dim)] hover:text-[var(--color-danger)]" title="删除">
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-[12px] font-mono text-[var(--color-accent)]">{model.model_name}</p>
            <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex justify-between text-[11px] font-mono">
              <div>
                <p className="text-[var(--color-text-dim)]">输入</p>
                <p className="text-[var(--color-text)] mt-0.5">${model.pricing_input}/1K</p>
              </div>
              <div>
                <p className="text-[var(--color-text-dim)]">输出</p>
                <p className="text-[var(--color-text)] mt-0.5">${model.pricing_output}/1K</p>
              </div>
              <div>
                <p className="text-[var(--color-text-dim)]">上限</p>
                <p className="text-[var(--color-text)] mt-0.5">{model.max_tokens_limit}</p>
              </div>
            </div>
          </div>
        ))}
        {models.length === 0 && !error && (
          <div className="col-span-full glass-card p-16 text-center text-[var(--color-text-dim)] text-[12px] font-mono">
            暂无可用模型，请管理员先添加模型。
          </div>
        )}
      </div>
    </div>
  );
}
