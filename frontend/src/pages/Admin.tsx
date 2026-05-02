import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showAddModel, setShowAddModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const PROVIDER_URLS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    azure: 'https://YOUR-RESOURCE.openai.azure.com',
    deepseek: 'https://api.deepseek.com/v1',
    custom: '',
  };

  const [modelForm, setModelForm] = useState({
    provider: 'deepseek', model_name: '', display_name: '', base_url: 'https://api.deepseek.com/v1',
    api_key: '', pricing_input: 0.00014, pricing_output: 0.00028, max_tokens_limit: 65536,
  });
  const handleProviderChange = (provider: string) => {
    setModelForm(f => ({ ...f, provider, base_url: PROVIDER_URLS[provider] || '' }));
  };

  useEffect(() => {
    Promise.all([api.adminUsers(), api.adminStats()])
      .then(async ([usersRes, statsRes]) => {
        if (usersRes.ok) setUsers(await usersRes.json());
        else setError('无法加载用户列表');
        if (statsRes.ok) setStats(await statsRes.json());
        else setError('无法加载统计数据');
      })
      .catch(() => setError('网络错误，请稍后重试'));
  }, []);

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.adminAddModel(modelForm);
    if (res.ok) {
      setShowAddModel(false);
      setModelForm({ ...modelForm, model_name: '', display_name: '', api_key: '' });
      setError(null);
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.detail?.message || data?.detail || '添加模型失败');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">管理后台</h2>
        <button onClick={() => setShowAddModel(true)}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm">
          添加模型
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">{error}</div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-sm text-slate-400">用户总数</p>
            <p className="text-2xl font-bold text-white">{stats.total_users}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-sm text-slate-400">API 调用总数</p>
            <p className="text-2xl font-bold text-white">{stats.total_calls}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-sm text-slate-400">总收入</p>
            <p className="text-2xl font-bold text-white">${stats.total_revenue?.toFixed(4)}</p>
          </div>
        </div>
      )}

      {showAddModel && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">添加新模型</h3>
          <form onSubmit={handleAddModel} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">供应商</label>
                <select value={modelForm.provider} onChange={e => handleProviderChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white">
                  <option value="deepseek">DeepSeek</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="azure">Azure</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">模型名称</label>
                <input value={modelForm.model_name} onChange={e => setModelForm({...modelForm, model_name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white" placeholder="gpt-4o" required />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">显示名称</label>
                <input value={modelForm.display_name} onChange={e => setModelForm({...modelForm, display_name: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white" placeholder="GPT-4o" required />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">基础 URL</label>
                <input value={modelForm.base_url} onChange={e => setModelForm({...modelForm, base_url: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white" required />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">上游 API 密钥</label>
                <input value={modelForm.api_key} onChange={e => setModelForm({...modelForm, api_key: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white" type="password" required />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">输入价格（$/1K tokens）</label>
                <input type="number" step="0.000001" value={modelForm.pricing_input} onChange={e => setModelForm({...modelForm, pricing_input: Number(e.target.value)})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">输出价格（$/1K tokens）</label>
                <input type="number" step="0.000001" value={modelForm.pricing_output} onChange={e => setModelForm({...modelForm, pricing_output: Number(e.target.value)})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">最大 Token 数</label>
                <input type="number" value={modelForm.max_tokens_limit} onChange={e => setModelForm({...modelForm, max_tokens_limit: Number(e.target.value)})}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm">添加模型</button>
              <button type="button" onClick={() => setShowAddModel(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">取消</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">用户列表</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="text-left p-3 text-slate-300 font-medium">昵称</th>
              <th className="text-left p-3 text-slate-300 font-medium">邮箱</th>
              <th className="text-left p-3 text-slate-300 font-medium">角色</th>
              <th className="text-left p-3 text-slate-300 font-medium">状态</th>
              <th className="text-left p-3 text-slate-300 font-medium">注册时间</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-slate-700/50">
                <td className="p-3 text-white">{user.name}</td>
                <td className="p-3 text-slate-300">{user.email}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    user.role === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'bg-slate-500/10 text-slate-400'
                  }`}>{user.role}</span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    user.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>{user.is_active ? '正常' : '已禁用'}</span>
                </td>
                <td className="p-3 text-slate-400 text-xs">{new Date(user.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
