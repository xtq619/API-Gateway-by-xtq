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

  const btnPrimaryClass = "px-4 py-2 text-[12px] font-mono tracking-wider cursor-pointer bg-white text-black border border-white transition-opacity hover:opacity-85";
  const btnClass = "px-4 py-2 text-[12px] font-mono tracking-wider cursor-pointer border border-[var(--color-border)] transition-colors hover:bg-white hover:text-black hover:border-white";
  const inputClass = "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-[12px] font-mono focus:outline-none focus:border-[var(--color-accent)]";

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">管理后台</h2>
          <p className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-[0.2em] mt-1">系统管理</p>
        </div>
        <button onClick={() => setShowAddModel(true)} className={btnPrimaryClass}>添加模型</button>
      </div>

      {error && (
        <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-6 text-[var(--color-danger)] text-[12px] font-mono">{error}</div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
            <p className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">用户</p>
            <p className="text-2xl font-semibold text-[var(--color-text)] mt-1 font-mono tabular-nums">{stats.total_users}</p>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
            <p className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">API 调用</p>
            <p className="text-2xl font-semibold text-[var(--color-text)] mt-1 font-mono tabular-nums">{stats.total_calls}</p>
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5">
            <p className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">收入</p>
            <p className="text-2xl font-semibold text-[var(--color-text)] mt-1 font-mono tabular-nums">${stats.total_revenue?.toFixed(4)}</p>
          </div>
        </div>
      )}

      {showAddModel && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 mb-6">
          <h3 className="font-mono text-[13px] text-[var(--color-text)] tracking-wider mb-4">添加模型</h3>
          <form onSubmit={handleAddModel} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">提供商</label>
                <select value={modelForm.provider} onChange={e => handleProviderChange(e.target.value)}
                  className={inputClass}>
                  <option value="deepseek">DeepSeek</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="azure">Azure</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">模型名称</label>
                <input value={modelForm.model_name} onChange={e => setModelForm({...modelForm, model_name: e.target.value})}
                  className={inputClass} placeholder="gpt-4o" required />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">显示名称</label>
                <input value={modelForm.display_name} onChange={e => setModelForm({...modelForm, display_name: e.target.value})}
                  className={inputClass} placeholder="GPT-4o" required />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">接口地址</label>
                <input value={modelForm.base_url} onChange={e => setModelForm({...modelForm, base_url: e.target.value})}
                  className={inputClass} required />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">上游 API 密钥</label>
                <input value={modelForm.api_key} onChange={e => setModelForm({...modelForm, api_key: e.target.value})}
                  className={inputClass} type="password" required />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">输入价格 ($/1K)</label>
                <input type="number" step="0.000001" value={modelForm.pricing_input} onChange={e => setModelForm({...modelForm, pricing_input: Number(e.target.value)})}
                  className={inputClass} />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">输出价格 ($/1K)</label>
                <input type="number" step="0.000001" value={modelForm.pricing_output} onChange={e => setModelForm({...modelForm, pricing_output: Number(e.target.value)})}
                  className={inputClass} />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">最大 Token</label>
                <input type="number" value={modelForm.max_tokens_limit} onChange={e => setModelForm({...modelForm, max_tokens_limit: Number(e.target.value)})}
                  className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className={btnPrimaryClass}>添加模型</button>
              <button type="button" onClick={() => setShowAddModel(false)} className={btnClass}>取消</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h3 className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase">用户列表</h3>
        </div>
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--color-surface-light)]">
            <tr>
              <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">姓名</th>
              <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">邮箱</th>
              <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">角色</th>
              <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">状态</th>
              <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">注册时间</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-[var(--color-border)]">
                <td className="p-3 text-[var(--color-text)]">{user.name}</td>
                <td className="p-3 text-[var(--color-text-muted)] font-mono text-[11px]">{user.email}</td>
                <td className="p-3">
                  <span className={`text-[10px] font-mono tracking-wider px-2 py-0.5 ${
                    user.role === 'admin' ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]' : 'text-[var(--color-text-dim)] bg-[var(--color-surface-light)]'
                  }`}>{user.role.toUpperCase()}</span>
                </td>
                <td className="p-3">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wider ${
                    user.is_active ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-[var(--color-success)] animate-status-pulse' : 'bg-[var(--color-danger)]'}`} />
                    {user.is_active ? '活跃' : '已禁用'}
                  </span>
                </td>
                <td className="p-3 text-[var(--color-text-dim)] text-[11px] font-mono">{new Date(user.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
