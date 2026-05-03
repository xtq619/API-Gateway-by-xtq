import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Bug, Lightbulb, Ellipsis, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';

const categoryConfig: Record<string, { icon: typeof MessageSquare; label: string }> = {
  suggestion: { icon: Lightbulb, label: '建议' },
  bug: { icon: Bug, label: '问题反馈' },
  other: { icon: Ellipsis, label: '其他' },
};

export default function PublicFeedback() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.listPublicFeedback().then((data: any) => {
      setItems(data.items || []);
      setTotal(data.total || 0);
    });
  }, []);

  return (
    <div className="auth-page" style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '80px' }}>
      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: '700px', padding: '0 24px' }}>
        <Link
          to="/login"
          className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          返回登录
        </Link>

        <h1 className="auth-hero-title" style={{ textAlign: 'left', marginBottom: '32px' }}>
          用户留言墙
        </h1>

        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-mono text-[13px] text-[var(--color-text)] tracking-wide uppercase flex items-center gap-2">
              <MessageSquare size={15} />
              全部留言（{total}）
            </h3>
            <Link
              to="/login"
              className="text-[12px] text-[var(--color-accent)] hover:text-[#e8b96d] transition-colors font-mono"
            >
              登录后留言 →
            </Link>
          </div>

          {items.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-muted)] text-center py-12">还没有留言，成为第一个留言的人吧</p>
          ) : (
            <div className="space-y-3">
              {items.map((item: any) => {
                const cfg = categoryConfig[item.category] || categoryConfig.other;
                const Icon = cfg.icon;
                return (
                  <div key={item.id} className="border border-[rgba(255,255,255,0.06)] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={13} className="text-[var(--color-text-muted)]" />
                      <span className="text-[11px] text-[var(--color-text-muted)] font-mono tracking-wide">{cfg.label}</span>
                      <span className="text-[11px] text-[var(--color-text-dim)] font-mono ml-auto">
                        {new Date(item.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{item.content}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
