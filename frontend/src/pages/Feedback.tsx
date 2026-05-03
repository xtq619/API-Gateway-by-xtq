import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { MessageSquare, Send, Bug, Lightbulb, Ellipsis, Trash2, ArrowLeft } from 'lucide-react';

const categoryConfig: Record<string, { icon: typeof MessageSquare; label: string }> = {
  suggestion: { icon: Lightbulb, label: '建议' },
  bug: { icon: Bug, label: '问题反馈' },
  other: { icon: Ellipsis, label: '其他' },
};

export default function Feedback() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('suggestion');
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadFeedback = async () => {
    const res = await api.listMyFeedback();
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    }
  };

  useEffect(() => { loadFeedback(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.createFeedback({ content: content.trim(), category });
      if (res.ok) {
        setContent('');
        setSuccess('感谢你的反馈！');
        loadFeedback();
      } else {
        const err = await res.json();
        setError(err.detail?.message || err.detail || '提交失败');
      }
    } catch {
      setError('网络错误');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除这条留言？')) return;
    const res = await api.deleteFeedback(id);
    if (res.ok || res.status === 204) {
      loadFeedback();
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div
      className="min-h-screen w-full relative"
      style={{ background: "url('/bg-auth.png') center/cover no-repeat, #060606" }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(160,120,220,0.05) 0%, transparent 50%)' }}
      />

      <div className="relative z-10 max-w-[720px] mx-auto px-6 pt-12 pb-20">
        <button
          onClick={() => navigate('/hub')}
          className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          返回选择页面
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">建议留言</h1>
          <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-text-muted)] mt-1 uppercase">
            {total} 条留言
          </p>
        </div>

        {/* 写留言 */}
        <div className="glass-card p-6 mb-6">
          <h3 className="font-mono text-[13px] text-[var(--color-text)] tracking-wide mb-4 uppercase flex items-center gap-2">
            <MessageSquare size={15} />
            写下你的想法
          </h3>

          {error && <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-4 text-[var(--color-danger)] text-[12px] font-mono">{error}</div>}
          {success && (
            <div className="border border-green-500/30 px-4 py-3 mb-4 text-green-400 text-[12px] font-mono">{success}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              {Object.entries(categoryConfig).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg border transition-all ${
                      category === key
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                        : 'border-[rgba(255,255,255,0.08)] text-[var(--color-text-muted)] hover:border-[rgba(255,255,255,0.2)]'
                    }`}
                  >
                    <Icon size={13} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="glass-input w-full min-h-[100px] resize-y text-[13px]"
              placeholder="请输入你的建议或反馈..."
              maxLength={2000}
              required
            />

            <button type="submit" disabled={submitting || !content.trim()} className="btn-primary text-[13px]">
              {submitting ? '提交中...' : <span className="flex items-center justify-center gap-2"><Send size={14} />提 交</span>}
            </button>
          </form>
        </div>

        {/* 全部留言 */}
        <div className="space-y-3">
          {items.map((item: any) => {
            const cfg = categoryConfig[item.category] || categoryConfig.other;
            const Icon = cfg.icon;
            const canDelete = isAdmin || item.user_name === user?.name;
            return (
              <div key={item.id} className="glass-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={13} className="text-[var(--color-text-muted)]" />
                    <span className="text-[11px] text-[var(--color-text-muted)] font-mono tracking-wide">{cfg.label}</span>
                    {item.user_name && (
                      <span className="text-[11px] text-[var(--color-text-dim)] font-mono">· {item.user_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--color-text-dim)] font-mono">
                      {new Date(item.created_at).toLocaleDateString('zh-CN')}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-[var(--color-text-dim)] hover:text-[var(--color-danger)] transition-colors"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[13px] text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{item.content}</p>
                {item.reply && (
                  <div className="mt-3 ml-2 pl-3 border-l-2 border-[var(--color-success)]/30 bg-[rgba(46,204,113,0.03)] rounded p-2">
                    <p className="text-[10px] text-[var(--color-success)] font-mono tracking-wider mb-0.5">管理员回复</p>
                    <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">{item.reply}</p>
                  </div>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="glass-card p-12 text-center">
              <p className="text-[13px] text-[var(--color-text-muted)]">还没有留言，成为第一个留言的人吧</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
