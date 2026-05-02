import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Activity, CreditCard, Key, Zap } from 'lucide-react';

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
    { label: '今日调用', value: summary?.total_calls ?? '...', icon: Activity, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Token 消耗', value: summary?.total_tokens?.toLocaleString() ?? '...', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: '活跃密钥', value: summary?.active_keys ?? '...', icon: Key, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: '账户余额', value: `$${balance?.toFixed(4) ?? '...'}`, icon: CreditCard, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">仪表盘</h2>
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon size={20} className={card.color} />
                </div>
                <span className="text-sm text-slate-400">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{card.value}</p>
            </div>
          );
        })}
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">快速开始</h3>
        <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
          <li>在 <strong>API 密钥</strong> 页面创建密钥</li>
          <li>在 <strong>模型列表</strong> 查看可用模型和定价</li>
          <li>使用密钥调用兼容 OpenAI 格式的接口：<br />
            <code className="bg-slate-900 px-2 py-1 rounded text-indigo-400 text-xs mt-1 inline-block">
              curl -H "Authorization: Bearer sk-YOUR-KEY" http://服务地址/v1/chat/completions
            </code>
          </li>
          <li>在 <strong>用量统计</strong> 查看调用记录</li>
        </ol>
      </div>
    </div>
  );
}
