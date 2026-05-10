import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Newspaper, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../lib/store';

const categories = ['全部', '新闻', '论文', '工具', '其他'];

const categoryColors: Record<string, string> = {
  '新闻': 'border-blue-400/30 bg-blue-400/10 text-blue-400',
  '论文': 'border-purple-400/30 bg-purple-400/10 text-purple-400',
  '工具': 'border-green-400/30 bg-green-400/10 text-green-400',
  '其他': 'border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.05)] text-[var(--color-text-muted)]',
};

export default function AiNews() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('全部');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { isAdmin } = useAuthStore();

  const [error, setError] = useState<string | null>(null);

  const loadNews = async () => {
    try {
      const cat = category === '全部' ? undefined : category;
      const data = await api.listNews(20, 0, cat);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setError(null);
    } catch (e: any) {
      setError('加载资讯失败: ' + (e?.message || '未知错误'));
    }
  };

  useEffect(() => { loadNews(); }, [category]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groupByDate = (list: any[]) => {
    const groups: Record<string, any[]> = {};
    list.forEach(item => {
      const d = new Date(item.created_at).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
      if (!groups[d]) groups[d] = [];
      groups[d].push(item);
    });
    return groups;
  };

  const groups = groupByDate(items);

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Newspaper size={22} className="text-[var(--color-accent)]" />
          <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">AI 每日资讯</h2>
        </div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-text-muted)] mt-1 uppercase">
          {total} 条资讯
          {isAdmin() && (
            <span className="ml-3 text-[var(--color-accent)]">
              <a href="/admin" className="hover:underline">管理后台 →</a>
            </span>
          )}
        </p>
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 text-[12px] rounded-lg border transition-all font-mono tracking-wide ${
              category === cat
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-dim)] text-[var(--color-accent)]'
                : 'border-[rgba(255,255,255,0.08)] text-[var(--color-text-muted)] hover:border-[rgba(255,255,255,0.2)]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-6 text-[var(--color-danger)] text-[13px] font-mono">{error}</div>
      )}

      {items.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Newspaper size={40} className="mx-auto mb-4 text-[var(--color-text-dim)]" />
          <p className="text-[var(--color-text-muted)] font-mono text-[13px]">暂无资讯</p>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(groups).map(([date, groupItems]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
                <span className="text-[11px] text-[var(--color-text-dim)] font-mono tracking-wider whitespace-nowrap">{date}</span>
                <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
              </div>
              <div className="space-y-3">
                {(groupItems as any[]).map(item => {
                  const isExpanded = !!expanded[item.id];
                  return (
                    <div key={item.id} className="glass-card p-5 max-w-full overflow-hidden" style={{ background: 'rgba(30,35,50,0.65)', borderColor: 'rgba(255,255,255,0.14)' }}>
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-mono ${categoryColors[item.category] || categoryColors['其他']}`}>
                              {item.category}
                            </span>
                            <span className="text-[11px] text-[var(--color-text-dim)] font-mono">{item.source_name}</span>
                          </div>
                          <h3 className="text-[15px] font-semibold text-[var(--color-text)] mb-2 leading-snug break-words">{item.title}</h3>
                          <p className="text-[13px] leading-relaxed break-words" style={{ color: 'rgba(235,230,220,0.92)' }}>{item.summary}</p>

                          {item.content && (
                            <>
                              <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[2000px] mt-3' : 'max-h-0'}`}>
                                <div className="border-t border-[rgba(255,255,255,0.06)] pt-3 mt-1">
                                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words" style={{ color: 'rgba(235,230,220,0.88)' }}>{item.content}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => toggleExpand(item.id)}
                                className="flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:text-[#e8b96d] transition-colors mt-2 font-mono"
                              >
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {isExpanded ? '收起' : '展开全文'}
                              </button>
                            </>
                          )}

                          {item.source_url && (
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] transition-colors mt-3 font-mono"
                            >
                              <ExternalLink size={11} /> 来源链接
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
