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

  const inputClass = "flex-1 px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] font-mono focus:outline-none focus:border-[var(--color-accent)]";
  const btnClass = "px-5 py-2 text-[12px] font-mono tracking-wider cursor-pointer bg-white text-black border border-white transition-opacity hover:opacity-85 disabled:opacity-40";

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">充值计费</h2>
        <p className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-[0.2em] mt-1">计费管理</p>
      </div>

      {error && (
        <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-6 text-[var(--color-danger)] text-[12px] font-mono">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-1 glass-card p-6">
          <span className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-[0.25em] uppercase">余额</span>
          <p className="text-3xl font-semibold text-[var(--color-text)] mt-2 font-mono tabular-nums">${balance.toFixed(4)}</p>
          <div className="mt-5 space-y-3">
            <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider">金额 (USD)</label>
            <div className="flex gap-2">
              <input type="number" value={rechargeAmount} onChange={e => setRechargeAmount(Number(e.target.value))}
                min={1} className={inputClass} />
              <button onClick={handleRecharge} disabled={loading} className={btnClass}>
                {loading ? '...' : '充值'}
              </button>
            </div>
            <p className="text-[11px] text-[var(--color-text-dim)] font-mono">演示版：手动充值。生产环境请对接 Stripe/支付宝。</p>
          </div>
        </div>

        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)]">
            <h3 className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-wider uppercase">交易记录</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead className="bg-[var(--color-surface-light)]">
              <tr>
                <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">时间</th>
                <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">类型</th>
                <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">金额</th>
                <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">余额</th>
                <th className="text-left p-3 font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider font-normal">备注</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr><td colSpan={5} className="p-12 text-center text-[var(--color-text-dim)] text-[12px] font-mono">暂无交易记录</td></tr>
              )}
              {transactions.map(tx => (
                <tr key={tx.id} className="border-t border-[var(--color-border)]">
                  <td className="p-3 text-[var(--color-text-muted)] text-[11px] font-mono">{new Date(tx.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-mono tracking-wider px-2 py-0.5 ${
                      tx.type === 'recharge' ? 'text-[var(--color-success)] bg-[var(--color-success)]/10' : 'text-[var(--color-accent)] bg-[var(--color-accent-dim)]'
                    }`}>{tx.type === 'recharge' ? '充值' : tx.type === 'deduction' ? '消费' : tx.type.toUpperCase()}</span>
                  </td>
                  <td className={`p-3 font-mono tabular-nums ${tx.amount >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                    {tx.amount >= 0 ? '+' : '-'}${Math.abs(tx.amount).toFixed(4)}
                  </td>
                  <td className="p-3 text-[var(--color-text)] font-mono tabular-nums">${tx.balance_after.toFixed(4)}</td>
                  <td className="p-3 text-[var(--color-text-dim)] text-[11px]">{tx.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
