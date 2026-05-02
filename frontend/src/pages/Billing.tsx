import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Billing() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [rechargeAmount, setRechargeAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [balRes, txRes] = await Promise.all([api.getBalance(), api.getTransactions()]);
      if (balRes.ok) setBalance((await balRes.json()).balance);
      else setError('无法加载余额');
      if (txRes.ok) setTransactions((await txRes.json()).items);
      else setError('无法加载交易记录');
    } catch {
      setError('网络错误，请稍后重试');
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleRecharge = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.recharge(rechargeAmount);
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        loadData();
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.detail?.message || data?.detail || '充值失败');
      }
    } catch {
      setError('网络错误，请稍后重试');
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">充值计费</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1 bg-slate-800 border border-slate-700 rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-1">当前余额</p>
          <p className="text-3xl font-bold text-white">${balance.toFixed(4)}</p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-slate-300">充值金额（美元）</label>
            <div className="flex gap-2">
              <input type="number" value={rechargeAmount} onChange={e => setRechargeAmount(Number(e.target.value))}
                min={1} className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500" />
              <button onClick={handleRecharge} disabled={loading}
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                {loading ? '处理中' : '充值'}
              </button>
            </div>
            <p className="text-xs text-slate-500">演示版：手动充值。生产环境请对接 Stripe/支付宝等支付网关。</p>
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">交易记录</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="text-left p-3 text-slate-300 font-medium">时间</th>
                <th className="text-left p-3 text-slate-300 font-medium">类型</th>
                <th className="text-left p-3 text-slate-300 font-medium">金额</th>
                <th className="text-left p-3 text-slate-300 font-medium">余额</th>
                <th className="text-left p-3 text-slate-300 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">暂无交易记录</td></tr>
              )}
              {transactions.map(tx => (
                <tr key={tx.id} className="border-t border-slate-700/50">
                  <td className="p-3 text-slate-300 text-xs">{new Date(tx.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      tx.type === 'recharge' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                    }`}>{tx.type === 'recharge' ? '充值' : tx.type === 'deduction' ? '扣费' : tx.type}</span>
                  </td>
                  <td className={`p-3 ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(4)}
                  </td>
                  <td className="p-3 text-white">${tx.balance_after.toFixed(4)}</td>
                  <td className="p-3 text-slate-400 text-xs">{tx.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
