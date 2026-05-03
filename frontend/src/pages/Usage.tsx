import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PERIOD_LABELS: Record<number, string> = { 1: '过去 24 小时', 7: '过去 7 天', 30: '过去 30 天', 90: '过去 90 天' };

function SummaryCards({ summary }: { summary: any }) {
  const cards = [
    { label: '总调用次数', value: summary.total_calls.toLocaleString(), color: 'var(--color-text)' },
    { label: '总 Token 数', value: summary.total_tokens.toLocaleString(), color: 'var(--color-text)' },
    { label: '总费用', value: `$${summary.total_cost.toFixed(6)}`, color: 'var(--color-accent)' },
    { label: '活跃密钥', value: summary.active_keys, color: 'var(--color-success)' },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((c, i) => (
        <div key={c.label} className="glass-card px-5 py-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
          <div className="text-[10px] font-mono tracking-[0.15em] text-[var(--color-text-muted)] mb-2">{c.label}</div>
          <div className="text-xl font-mono tabular-nums" style={{ color: c.color }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function PerModelTable({ stats }: { stats: any[] }) {
  const grouped: Record<string, { tokens: number; calls: number; cost: number }> = {};
  stats.forEach(s => {
    const key = s.model_name;
    if (!grouped[key]) grouped[key] = { tokens: 0, calls: 0, cost: 0 };
    grouped[key].tokens += s.total_tokens;
    grouped[key].calls += s.request_count;
    grouped[key].cost += s.total_cost;
  });
  const entries = Object.entries(grouped).sort((a, b) => b[1].tokens - a[1].tokens);
  if (entries.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden mb-6">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h3 className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase">模型用量明细</h3>
      </div>
      <table className="w-full text-[12px]">
        <thead className="bg-[var(--color-surface-light)]">
          <tr>
            <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">模型</th>
            <th className="text-right p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">调用次数</th>
            <th className="text-right p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">Token</th>
            <th className="text-right p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">费用</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([model, data]) => (
            <tr key={model} className="border-t border-[var(--color-border)]">
              <td className="p-3 text-[var(--color-text)] font-mono text-[11px]">{model}</td>
              <td className="p-3 text-[var(--color-text-muted)] font-mono tabular-nums text-right">{data.calls}</td>
              <td className="p-3 text-[var(--color-text)] font-mono tabular-nums text-right">{data.tokens.toLocaleString()}</td>
              <td className="p-3 text-[var(--color-accent)] font-mono tabular-nums text-right">${data.cost.toFixed(6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function aggregateByDate(stats: any[]) {
  const map: Record<string, { total_tokens: number; total_cost: number }> = {};
  stats.forEach(s => {
    if (!map[s.date]) map[s.date] = { total_tokens: 0, total_cost: 0 };
    map[s.date].total_tokens += s.total_tokens;
    map[s.date].total_cost += s.total_cost;
  });
  return Object.entries(map)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export default function Usage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDaysChange = (newDays: number) => {
    if (newDays === days) return;
    setDays(newDays);
    setLogs([]);
    setStats([]);
    setSummary(null);
    setError(null);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getUsageLogs(days),
      api.getUsageStats(days),
      api.getUsageSummary(days),
    ])
      .then(async ([logsRes, statsRes, summaryRes]) => {
        if (logsRes.ok) setLogs(await logsRes.json());
        else setError('无法加载调用记录');
        if (statsRes.ok) setStats(await statsRes.json());
        else setError('无法加载统计数据');
        if (summaryRes.ok) setSummary(await summaryRes.json());
      })
      .catch(() => setError('网络错误，请稍后重试'))
      .finally(() => setLoading(false));
  }, [days]);

  const chartData = aggregateByDate(stats);
  const dateLabel = PERIOD_LABELS[days] || `Last ${days} days`;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">用量统计</h2>
          <p className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-[0.2em] mt-1 uppercase">{dateLabel}</p>
        </div>
        <select
          value={days}
          onChange={e => handleDaysChange(Number(e.target.value))}
          className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-[12px] font-mono focus:outline-none focus:border-[var(--color-accent)]"
        >
          <option value={1}>24H</option>
          <option value={7}>7D</option>
          <option value={30}>30D</option>
          <option value={90}>90D</option>
        </select>
      </div>

      {error && (
        <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-6 text-[var(--color-danger)] text-[12px] font-mono">{error}</div>
      )}

      {summary && <SummaryCards summary={summary} />}

      {stats.length > 0 && (
        <PerModelTable stats={stats} />
      )}

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="glass-card p-6">
            <h3 className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase mb-4">Token 用量</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" stroke="#6b6b7b" tick={{ fontSize: 10, fontFamily: 'Menlo, Monaco, Consolas, monospace' }} />
                <YAxis stroke="#6b6b7b" tick={{ fontSize: 10, fontFamily: 'Menlo, Monaco, Consolas, monospace' }} />
                <Tooltip
                  contentStyle={{
                    background: '#141414',
                    border: '1px solid #2a2a2a',
                    color: '#f6f3ec',
                    fontFamily: 'Menlo, Monaco, Consolas, monospace',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="total_tokens" fill="#dba460" radius={[0, 0, 0, 0]} name="Tokens" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card p-6">
            <h3 className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase mb-4">费用 (USD)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" stroke="#6b6b7b" tick={{ fontSize: 10, fontFamily: 'Menlo, Monaco, Consolas, monospace' }} />
                <YAxis stroke="#6b6b7b" tick={{ fontSize: 10, fontFamily: 'Menlo, Monaco, Consolas, monospace' }} />
                <Tooltip
                  contentStyle={{
                    background: '#141414',
                    border: '1px solid #2a2a2a',
                    color: '#f6f3ec',
                    fontFamily: 'Menlo, Monaco, Consolas, monospace',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="total_cost" fill="#f6f3ec" radius={[0, 0, 0, 0]} name="Cost" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!loading && chartData.length === 0 && summary && !error && (
        <div className="glass-card px-6 py-10 mb-6 text-center">
          <div className="text-[11px] font-mono text-[var(--color-text-dim)] tracking-wider">所选时间段暂无数据</div>
        </div>
      )}

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h3 className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase">调用记录</h3>
        </div>
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--color-surface-light)]">
            <tr>
              <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">时间</th>
              <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">模型</th>
              <th className="text-right p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">Token</th>
              <th className="text-right p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">费用</th>
              <th className="text-right p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">延迟</th>
              <th className="text-center p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">状态</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr><td colSpan={6} className="p-12 text-center text-[var(--color-text-dim)] text-[12px] font-mono">暂无调用记录</td></tr>
            )}
            {logs.map(log => (
              <tr key={log.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-light)]/50 transition-colors">
                <td className="p-3 text-[var(--color-text-muted)] text-[11px] font-mono">{new Date(log.created_at).toLocaleString()}</td>
                <td className="p-3">
                  <code className="text-[11px] font-mono text-[var(--color-text)]">{log.model_name || '—'}</code>
                </td>
                <td className="p-3 text-[var(--color-text)] font-mono tabular-nums text-right">{log.request_tokens + log.response_tokens}</td>
                <td className="p-3 text-[var(--color-accent)] font-mono tabular-nums text-right">${log.cost?.toFixed(6)}</td>
                <td className="p-3 text-[var(--color-text-muted)] font-mono tabular-nums text-right">{log.latency_ms}ms</td>
                <td className="p-3 text-center">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono tracking-wider ${
                    log.status === 'success' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-[var(--color-success)] animate-status-pulse' : 'bg-[var(--color-danger)]'}`} />
                    {log.status === 'success' ? '成功' : '失败'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
