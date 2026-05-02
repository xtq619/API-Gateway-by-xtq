import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Usage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([api.getUsageLogs(days), api.getUsageStats(days)])
      .then(async ([logsRes, statsRes]) => {
        if (logsRes.ok) setLogs(await logsRes.json());
        else setError('无法加载调用记录');
        if (statsRes.ok) setStats(await statsRes.json());
        else setError('无法加载统计数据');
      })
      .catch(() => setError('网络错误，请稍后重试'));
  }, [days]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">用量统计</h2>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500">
          <option value={1}>最近 24 小时</option>
          <option value={7}>最近 7 天</option>
          <option value={30}>最近 30 天</option>
          <option value={90}>最近 90 天</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">{error}</div>
      )}

      {stats.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">请求量趋势</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }}
              />
              <Bar dataKey="total_tokens" fill="#6366f1" radius={[4, 4, 0, 0]} name="Token 总量" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">调用记录</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="text-left p-3 text-slate-300 font-medium">时间</th>
              <th className="text-left p-3 text-slate-300 font-medium">Token 数</th>
              <th className="text-left p-3 text-slate-300 font-medium">费用</th>
              <th className="text-left p-3 text-slate-300 font-medium">延迟</th>
              <th className="text-left p-3 text-slate-300 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !error && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">暂无调用记录</td></tr>
            )}
            {logs.map(log => (
              <tr key={log.id} className="border-t border-slate-700/50">
                <td className="p-3 text-slate-300 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                <td className="p-3 text-white">{log.request_tokens + log.response_tokens}</td>
                <td className="p-3 text-indigo-400">${log.cost?.toFixed(6)}</td>
                <td className="p-3 text-slate-400">{log.latency_ms}ms</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    log.status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>{log.status === 'success' ? '成功' : '失败'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
