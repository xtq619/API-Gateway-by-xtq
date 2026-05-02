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
    if (res.ok) {
      setEditing(null);
      loadModels();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.detail?.message || data?.detail || '更新失败');
    }
    setSaving(false);
  };

  const handleDelete = async (model: Model) => {
    if (!confirm(`确定删除模型 "${model.display_name}" 吗？此操作不可撤销。`)) return;
    setError(null);
    const res = await api.adminDeleteModel(model.id);
    if (res.ok) {
      loadModels();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.detail?.message || data?.detail || '删除失败');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">可用模型</h2>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">{error}</div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">编辑模型</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">供应商</label>
                  <select
                    value={editing.provider}
                    onChange={e => setEditing({ ...editing, provider: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="azure">Azure</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">模型名称</label>
                  <input
                    value={editing.model_name}
                    onChange={e => setEditing({ ...editing, model_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">显示名称</label>
                  <input
                    value={editing.display_name}
                    onChange={e => setEditing({ ...editing, display_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">最大 Token 数</label>
                  <input
                    type="number"
                    value={editing.max_tokens_limit}
                    onChange={e => setEditing({ ...editing, max_tokens_limit: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">输入价格（$/1K tokens）</label>
                  <input
                    type="number" step="0.000001"
                    value={editing.pricing_input}
                    onChange={e => setEditing({ ...editing, pricing_input: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">输出价格（$/1K tokens）</label>
                  <input
                    type="number" step="0.000001"
                    value={editing.pricing_output}
                    onChange={e => setEditing({ ...editing, pricing_output: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">Base URL</label>
                  <input
                    value={editing.base_url || ''}
                    onChange={e => setEditing({ ...editing, base_url: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                    placeholder="https://api.deepseek.com/v1"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm text-slate-300 mb-1">上游 API Key</label>
                  <input
                    value={editing.api_key || ''}
                    onChange={e => setEditing({ ...editing, api_key: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map(model => (
          <div key={model.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5 relative group">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">{model.display_name}</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">{model.provider}</span>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => handleEdit(model)}
                      className="p-1.5 hover:bg-indigo-500/20 rounded text-slate-500 hover:text-indigo-400 transition-colors"
                      title="编辑模型"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(model)}
                      className="p-1.5 hover:bg-red-500/20 rounded text-slate-500 hover:text-red-400 transition-colors"
                      title="删除模型"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-400 mb-1">模型：<code className="text-indigo-400 text-xs">{model.model_name}</code></p>
            <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between text-xs">
              <div>
                <p className="text-slate-400">输入</p>
                <p className="text-white">${model.pricing_input}/1K tokens</p>
              </div>
              <div>
                <p className="text-slate-400">输出</p>
                <p className="text-white">${model.pricing_output}/1K tokens</p>
              </div>
              <div>
                <p className="text-slate-400">最大 Token</p>
                <p className="text-white">{model.max_tokens_limit}</p>
              </div>
            </div>
          </div>
        ))}
        {models.length === 0 && !error && (
          <div className="col-span-full bg-slate-800 border border-slate-700 rounded-xl p-12 text-center text-slate-500">
            暂无可用模型，请管理员先添加模型。
          </div>
        )}
      </div>
    </div>
  );
}
