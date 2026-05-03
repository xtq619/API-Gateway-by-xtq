import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { Activity, CreditCard, Key, Zap } from 'lucide-react';

function TypewriterTitle() {
  const [text, setText] = useState('');
  const fullText = 'API Gateway';
  const idx = useRef(0);

  useEffect(() => {
    if (idx.current < fullText.length) {
      const timer = setTimeout(() => {
        setText(fullText.slice(0, idx.current + 1));
        idx.current++;
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [text]);

  return (
    <span className="font-mono text-[11px] tracking-[0.35em] text-[var(--color-text-muted)] uppercase">
      {text}<span className="animate-cursor-blink text-[var(--color-accent)]">_</span>
    </span>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getUsageSummary(1), api.getBalance()])
      .then(async ([summaryRes, balanceRes]) => {
        if (summaryRes.ok) setSummary(await summaryRes.json());
        else setError('无法加载用量数据');
        if (balanceRes.ok) setBalance((await balanceRes.json()).balance);
        else setError('无法加载余额数据');
      })
      .catch(() => setError('网络错误，请稍后重试'));
  }, []);

  const cards = [
    { label: '今日调用', value: summary?.total_calls ?? '...', icon: Activity, color: 'text-white' },
    { label: 'Token 消耗', value: summary?.total_tokens?.toLocaleString() ?? '...', icon: Zap, color: 'text-[var(--color-accent)]' },
    { label: '活跃密钥', value: summary?.active_keys ?? '...', icon: Key, color: 'text-[var(--color-success)]' },
    { label: '账户余额', value: `$${balance?.toFixed(4) ?? '...'}`, icon: CreditCard, color: 'text-[var(--color-accent)]' },
  ];

  return (
    <div>
      <div className="mb-8">
        <TypewriterTitle />
        <h2 className="text-2xl font-semibold text-[var(--color-text)] mt-3 tracking-tight">仪表盘</h2>
      </div>

      {error && (
        <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-6 text-[var(--color-danger)] text-[13px] font-mono">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="glass-card p-5 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Icon size={18} className={card.color} />
                <span className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase">{card.label}</span>
              </div>
              <p className="text-2xl font-semibold text-[var(--color-text)] font-mono tabular-nums">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="glass-card p-6">
        <h3 className="font-mono text-[13px] text-[var(--color-text)] tracking-wide mb-4 uppercase">快速开始</h3>
        <ol className="text-[13px] text-[var(--color-text-muted)] space-y-3 list-decimal list-inside">
          <li>在 <strong className="text-[var(--color-text)]">API 密钥</strong> 页面创建密钥</li>
          <li>在 <strong className="text-[var(--color-text)]">模型列表</strong> 查看可用模型和定价</li>
          <li>使用密钥调用兼容 OpenAI 格式的接口：<br />
            <code className="bg-[var(--color-bg)] px-3 py-1.5 text-[var(--color-accent)] text-[12px] font-mono mt-1.5 inline-block">
              curl -H "Authorization: Bearer sk-YOUR-KEY" http://host/v1/chat/completions
            </code>
          </li>
          <li>在 <strong className="text-[var(--color-text)]">用量统计</strong> 查看调用记录</li>
        </ol>
      </div>
    </div>
  );
}
