import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { MessageSquare, Send, Bug, Lightbulb, Ellipsis, Trash2 } from 'lucide-react';
import { useAuthStore } from '../lib/store';

const categoryConfig: Record<string, { icon: typeof MessageSquare; label: string }> = {
  suggestion: { icon: Lightbulb, label: '建议' },
  bug: { icon: Bug, label: '问题反馈' },
  other: { icon: Ellipsis, label: '其他' },
};

export default function Feedback() {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('suggestion');
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuthStore();
  const _isAdmin = user?.role === 'admin';

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

  const statusLabel = (s: string) => s === 'pending' ? '待处理' : s === 'reviewed' ? '已查看' : '已关闭';

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">建议留言</h2>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-text-muted)] mt-1 uppercase">Feedback</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="glass-card p-6">
            <h3 className="font-mono text-[13px] text-[var(--color-text)] tracking-wide mb-5 uppercase flex items-center gap-2">
              <MessageSquare size={15} />
              写下你的想法
            </h3>

            {error && <div className="auth-error">{error}</div>}
            {success && (
              <div className="border border-[var(--color-success)]/30 px-4 py-3 mb-5 text-[var(--color-success)] text-[12px] rounded-lg">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                className="auth-input-v3 min-h-[140px] resize-y"
                placeholder="请输入你的建议或反馈..."
                maxLength={2000}
                required
              />

              <button type="submit" disabled={submitting || !content.trim()} className="auth-btn-v3" style={{ marginTop: 0 }}>
                {submitting ? '提交中...' : <span className="flex items-center justify-center gap-2"><Send size={14} />提 交</span>}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="glass-card p-6">
            <h3 className="font-mono text-[13px] text-[var(--color-text)] tracking-wide mb-5 uppercase">
              我的留言（{total}）
            </h3>
            {items.length === 0 ? (
              <p className="text-[13px] text-[var(--color-text-muted)]">还没有留言</p>
            ) : (
              <div className="space-y-3">
                {items.map((item: any) => {
                  const cfg = categoryConfig[item.category] || categoryConfig.other;
                  const Icon = cfg.icon;
                  return (
                    <div key={item.id} className="border border-[rgba(255,255,255,0.06)] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon size={13} className="text-[var(--color-text-muted)]" />
                          <span className="text-[11px] text-[var(--color-text-muted)] font-mono tracking-wide">{cfg.label}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                            item.status === 'pending' ? 'bg-[var(--color-accent-dim)] text-[var(--color-accent)]' :
                            item.status === 'reviewed' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' :
                            'bg-[rgba(255,255,255,0.06)] text-[var(--color-text-dim)]'
                          }`}>{statusLabel(item.status)}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-[11px] text-[var(--color-text-dim)] font-mono">
                            {new Date(item.created_at).toLocaleDateString('zh-CN')}
                          </span>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-[var(--color-text-dim)] hover:text-[var(--color-danger)] transition-colors"
                            title="删除"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[13px] text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{item.content}</p>
                      {item.reply && (
                        <div className="mt-3 ml-2 pl-3 border-l-2 border-[var(--color-success)]/30 bg-[rgba(46,204,113,0.03)] rounded p-2">
                          <p className="text-[10px] text-[var(--color-success)] font-mono tracking-wider mb-0.5">管理员回复</p>
                          <p className="text-[12px] text-[var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">{item.reply}</p>
                          {item.replied_at && (
                            <p className="text-[10px] text-[var(--color-text-dim)] font-mono mt-0.5">{new Date(item.replied_at).toLocaleDateString('zh-CN')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
