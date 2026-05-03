import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Trash2, Edit2, Plus, RefreshCw } from 'lucide-react';

export default function Admin() {
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showAddModel, setShowAddModel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'users' | 'news' | 'feedback'>('users');

  // Feedback management state
  const [feedbackItems, setFeedbackItems] = useState<any[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<Record<string, boolean>>({});

  const loadFeedback = async () => {
    const res = await api.adminListFeedback();
    if (res.ok) {
      const data = await res.json();
      setFeedbackItems(data.items || []);
      setFeedbackTotal(data.total || 0);
    }
  };

  const handleReply = async (id: string) => {
    const text = replyText[id]?.trim();
    if (!text) return;
    setReplying(prev => ({ ...prev, [id]: true }));
    const res = await api.adminReplyFeedback(id, text);
    if (res.ok) {
      setReplyText(prev => ({ ...prev, [id]: '' }));
      loadFeedback();
    }
    setReplying(prev => ({ ...prev, [id]: false }));
  };

  // News management state
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [newsTotal, setNewsTotal] = useState(0);
  const [showNewsForm, setShowNewsForm] = useState(false);
  const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
  const [autoFetching, setAutoFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [selectedNews, setSelectedNews] = useState<Set<string>>(new Set());
  const [newsForm, setNewsForm] = useState({
    title: '', summary: '', content: '', category: '新闻',
    source_name: '官方', source_url: '', is_published: false,
  });
  const PROVIDER_URLS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    azure: 'https://YOUR-RESOURCE.openai.azure.com',
    deepseek: 'https://api.deepseek.com/v1',
    xiaomi: 'https://s-model.cn-beijing.volces.com/api/v3',
    custom: '',
  };

  const [modelForm, setModelForm] = useState({
    provider: 'deepseek', model_name: '', display_name: '', base_url: 'https://api.deepseek.com/v1',
    api_key: '', pricing_input: 0.00014, pricing_output: 0.00028, max_tokens_limit: 65536,
  });
  const handleProviderChange = (provider: string) => {
    setModelForm(f => ({ ...f, provider, base_url: PROVIDER_URLS[provider] || '' }));
  };

  const loadNews = async () => {
    const res = await api.adminListNews(50, 0, false);
    if (res.ok) {
      const data = await res.json();
      setNewsItems(data.items || []);
      setNewsTotal(data.total || 0);
    }
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
    loadNews();
    loadFeedback();
  }, []);

  const handleSaveNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingNewsId) {
      const res = await api.adminUpdateNews(editingNewsId, newsForm);
      if (res.ok) { setShowNewsForm(false); setEditingNewsId(null); loadNews(); }
      else { const d = await res.json().catch(() => null); setError(d?.detail?.message || d?.detail || '更新失败'); }
    } else {
      const res = await api.adminCreateNews(newsForm as any);
      if (res.ok) { setShowNewsForm(false); loadNews(); }
      else { const d = await res.json().catch(() => null); setError(d?.detail?.message || d?.detail || '创建失败'); }
    }
  };

  const handleEditNews = async (id: string) => {
    const res = await api.adminGetNews(id);
    if (res.ok) {
      const n = await res.json();
      setNewsForm({ title: n.title, summary: n.summary, content: n.content || '', category: n.category, source_name: n.source_name, source_url: n.source_url || '', is_published: n.is_published });
      setEditingNewsId(id);
      setShowNewsForm(true);
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!confirm('确认删除这条资讯？')) return;
    const res = await api.adminDeleteNews(id);
    if (res.ok || res.status === 204) loadNews();
  };

  const handleAutoFetch = async () => {
    setAutoFetching(true);
    setFetchResult(null);
    try {
      const res = await api.autoFetchNews();
      const data = await res.json();
      if (res.ok) {
        setFetchResult(data.message || '已触发自动抓取');
        // Reload news after a delay to show new items
        setTimeout(() => loadNews(), 3000);
      } else {
        setFetchResult(data.detail?.message || data.detail || '抓取失败');
      }
    } catch {
      setFetchResult('网络错误');
    }
    setAutoFetching(false);
  };

  const handleBatchDelete = async () => {
    if (selectedNews.size === 0) return;
    if (!confirm(`确认删除选中的 ${selectedNews.size} 条资讯？`)) return;
    for (const id of selectedNews) {
      await api.adminDeleteNews(id);
    }
    setSelectedNews(new Set());
    loadNews();
  };

  const toggleSelectAll = () => {
    if (selectedNews.size === newsItems.length) {
      setSelectedNews(new Set());
    } else {
      setSelectedNews(new Set(newsItems.map((n: any) => n.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedNews(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          <div className="glass-card p-5">
            <p className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">用户</p>
            <p className="text-2xl font-semibold text-[var(--color-text)] mt-1 font-mono tabular-nums">{stats.total_users}</p>
          </div>
          <div className="glass-card p-5">
            <p className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">API 调用</p>
            <p className="text-2xl font-semibold text-[var(--color-text)] mt-1 font-mono tabular-nums">{stats.total_calls}</p>
          </div>
          <div className="glass-card p-5">
            <p className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider uppercase">收入</p>
            <p className="text-2xl font-semibold text-[var(--color-text)] mt-1 font-mono tabular-nums">${stats.total_revenue?.toFixed(4)}</p>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('users')} className={`px-4 py-2 text-[12px] font-mono tracking-wide rounded-lg border transition-all ${
          tab === 'users' ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'border-[rgba(255,255,255,0.08)] text-[var(--color-text-muted)] hover:border-[rgba(255,255,255,0.2)]'
        }`}>用户管理</button>
        <button onClick={() => { setTab('news'); loadNews(); }} className={`px-4 py-2 text-[12px] font-mono tracking-wide rounded-lg border transition-all ${
          tab === 'news' ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'border-[rgba(255,255,255,0.08)] text-[var(--color-text-muted)] hover:border-[rgba(255,255,255,0.2)]'
        }`}>AI 资讯管理</button>
        <button onClick={() => { setTab('feedback'); loadFeedback(); }} className={`px-4 py-2 text-[12px] font-mono tracking-wide rounded-lg border transition-all ${
          tab === 'feedback' ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]' : 'border-[rgba(255,255,255,0.08)] text-[var(--color-text-muted)] hover:border-[rgba(255,255,255,0.2)]'
        }`}>留言管理</button>
      </div>

      {tab === 'users' && (<>
      {showAddModel && (
        <div className="glass-card p-6 mb-6">
          <h3 className="font-mono text-[13px] text-[var(--color-text)] tracking-wider mb-4">添加模型</h3>
          <form onSubmit={handleAddModel} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">提供商</label>
                <select value={modelForm.provider} onChange={e => handleProviderChange(e.target.value)}
                  className={inputClass}>
                  <option value="deepseek">DeepSeek</option>
                  <option value="xiaomi">Xiaomi MiMo</option>
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

      <div className="glass-card overflow-hidden">
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
              <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">操作</th>
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
                <td className="p-3">
                  <button
                    onClick={() => {
                      if (!confirm(`确认删除用户 "${user.name}" (${user.email})？此操作不可撤销。`)) return;
                      api.adminDeleteUser(user.id).then(res => {
                        if (res.ok || res.status === 204) {
                          setUsers(prev => prev.filter(u => u.id !== user.id));
                        }
                      });
                    }}
                    className="text-[var(--color-text-dim)] hover:text-[var(--color-danger)] transition-colors"
                    title="删除用户"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}

      {tab === 'news' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase">AI 资讯列表（{newsTotal}）</h3>
            <div className="flex items-center gap-2">
              {selectedNews.size > 0 && (
                <button onClick={handleBatchDelete}
                  className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-mono tracking-wider border border-[var(--color-danger)] text-[var(--color-danger)] transition-all hover:bg-[var(--color-danger)]/10 cursor-pointer">
                  <Trash2 size={12} /> 批量删除（{selectedNews.size}）
                </button>
              )}
              {fetchResult && (
                <span className="text-[11px] font-mono text-[var(--color-accent)] mr-2">{fetchResult}</span>
              )}
              <button onClick={handleAutoFetch} disabled={autoFetching}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-mono tracking-wider border border-[var(--color-accent)] text-[var(--color-accent)] transition-all hover:bg-[var(--color-accent-dim)] cursor-pointer disabled:opacity-40">
                <RefreshCw size={12} className={autoFetching ? 'animate-spin' : ''} />
                {autoFetching ? '抓取 中...' : '自动抓取'}
              </button>
              <button onClick={() => { setEditingNewsId(null); setNewsForm({ title: '', summary: '', content: '', category: '新闻', source_name: '官方', source_url: '', is_published: false }); setShowNewsForm(true); }} className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-mono tracking-wider bg-white text-black border border-white transition-opacity hover:opacity-85 cursor-pointer">
                <Plus size={12} /> 新建资讯
              </button>
            </div>
          </div>

          {showNewsForm && (
            <div className="p-6 border-b border-[var(--color-border)]">
              <h4 className="font-mono text-[12px] text-[var(--color-text)] tracking-wider mb-4">{editingNewsId ? '编辑资讯' : '新建资讯'}</h4>
              <form onSubmit={handleSaveNews} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1">标题 *</label>
                    <input value={newsForm.title} onChange={e => setNewsForm({...newsForm, title: e.target.value})} className={inputClass} required />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1">分类</label>
                    <select value={newsForm.category} onChange={e => setNewsForm({...newsForm, category: e.target.value})} className={inputClass}>
                      <option value="新闻">新闻</option>
                      <option value="论文">论文</option>
                      <option value="工具">工具</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1">摘要 *</label>
                    <textarea value={newsForm.summary} onChange={e => setNewsForm({...newsForm, summary: e.target.value})} className={inputClass} rows={2} required />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1">正文</label>
                    <textarea value={newsForm.content} onChange={e => setNewsForm({...newsForm, content: e.target.value})} className={inputClass} rows={4} />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1">来源名称</label>
                    <input value={newsForm.source_name} onChange={e => setNewsForm({...newsForm, source_name: e.target.value})} className={inputClass} />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1">来源链接</label>
                    <input value={newsForm.source_url} onChange={e => setNewsForm({...newsForm, source_url: e.target.value})} className={inputClass} placeholder="https://..." />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-[11px] font-mono text-[var(--color-text-muted)] cursor-pointer">
                    <input type="checkbox" checked={newsForm.is_published} onChange={e => setNewsForm({...newsForm, is_published: e.target.checked})} />
                    发布
                  </label>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="px-4 py-2 text-[12px] font-mono tracking-wider cursor-pointer bg-white text-black border border-white transition-opacity hover:opacity-85">{editingNewsId ? '更新' : '创建'}</button>
                  <button type="button" onClick={() => { setShowNewsForm(false); setEditingNewsId(null); }} className={btnClass}>取消</button>
                </div>
              </form>
            </div>
          )}

          {newsItems.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-text-muted)] font-mono text-[12px]">暂无资讯</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-[var(--color-surface-light)]">
                <tr>
                  <th className="p-3 w-10">
                    <input type="checkbox" checked={newsItems.length > 0 && selectedNews.size === newsItems.length} onChange={toggleSelectAll}
                      className="cursor-pointer accent-[var(--color-accent)]" />
                  </th>
                  <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">标题</th>
                  <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">分类</th>
                  <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">状态</th>
                  <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">日期</th>
                  <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                {newsItems.map(item => (
                  <tr key={item.id} className="border-t border-[var(--color-border)]">
                    <td className="p-3 w-10">
                      <input type="checkbox" checked={selectedNews.has(item.id)} onChange={() => toggleSelectOne(item.id)}
                        className="cursor-pointer accent-[var(--color-accent)]" />
                    </td>
                    <td className="p-3 text-[var(--color-text)] max-w-xs truncate">{item.title}</td>
                    <td className="p-3">
                      <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 bg-[var(--color-surface-light)] text-[var(--color-text-dim)]">{item.category}</span>
                    </td>
                    <td className="p-3">
                      <span className={`text-[10px] font-mono tracking-wider ${item.is_published ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dim)]'}`}>
                        {item.is_published ? '已发布' : '草稿'}
                      </span>
                    </td>
                    <td className="p-3 text-[var(--color-text-dim)] text-[11px] font-mono">{new Date(item.created_at).toLocaleDateString('zh-CN')}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditNews(item.id)} className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors"><Edit2 size={13} /></button>
                        <button onClick={() => handleDeleteNews(item.id)} className="text-[var(--color-text-dim)] hover:text-[var(--color-danger)] transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'feedback' && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h3 className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase">用户留言（{feedbackTotal}）</h3>
          </div>
          {feedbackItems.length === 0 ? (
            <div className="p-12 text-center text-[var(--color-text-muted)] font-mono text-[12px]">暂无留言</div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {feedbackItems.map((item: any) => (
                <div key={item.id} className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      item.category === 'bug' ? 'text-red-400 bg-red-400/10' :
                      item.category === 'suggestion' ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]' :
                      'text-[var(--color-text-dim)] bg-[rgba(255,255,255,0.06)]'
                    }`}>
                      {item.category === 'suggestion' ? '建议' : item.category === 'bug' ? '问题' : '其他'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      item.status === 'pending' ? 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]' :
                      item.status === 'reviewed' ? 'text-[var(--color-success)] bg-[var(--color-success)]/15' :
                      'text-[var(--color-text-dim)] bg-[rgba(255,255,255,0.06)]'
                    }`}>
                      {item.status === 'pending' ? '待处理' : item.status === 'reviewed' ? '已回复' : '已关闭'}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-dim)] font-mono ml-auto">
                      {new Date(item.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--color-text)] leading-relaxed whitespace-pre-wrap mb-3">{item.content}</p>

                  {item.reply ? (
                    <div className="ml-4 pl-4 border-l-2 border-[var(--color-success)]/30 bg-[rgba(46,204,113,0.03)] rounded p-3">
                      <p className="text-[10px] text-[var(--color-success)] font-mono tracking-wider mb-1">管理员回复</p>
                      <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">{item.reply}</p>
                      {item.replied_at && (
                        <p className="text-[10px] text-[var(--color-text-dim)] font-mono mt-1">{new Date(item.replied_at).toLocaleDateString('zh-CN')}</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        value={replyText[item.id] || ''}
                        onChange={e => setReplyText(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className={inputClass}
                        placeholder="输入回复内容..."
                      />
                      <button
                        onClick={() => handleReply(item.id)}
                        disabled={replying[item.id] || !(replyText[item.id]?.trim())}
                        className="px-3 py-2 text-[11px] font-mono tracking-wider bg-[var(--color-accent)] text-black border border-[var(--color-accent)] transition-opacity hover:opacity-85 disabled:opacity-30 cursor-pointer shrink-0"
                      >
                        {replying[item.id] ? '...' : '回复'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
