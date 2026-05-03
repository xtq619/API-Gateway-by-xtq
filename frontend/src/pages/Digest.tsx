import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Mail, Clock, Save, Loader2 } from 'lucide-react';

interface UserDigestPref {
  id: string;
  is_enabled: boolean;
  email: string;
  send_time: string;
}

export default function Digest() {
  const [pref, setPref] = useState<UserDigestPref | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await api.getMyDigestPref();
      if (res.ok) setPref(await res.json());
      else setError('加载失败');
    } catch {
      setError('网络错误');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (data: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.updateMyDigestPref(data);
      if (res.ok) {
        const updated = await res.json();
        setPref(updated);
        setSuccess('已保存');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.detail?.message || body?.detail || '保存失败');
      }
    } catch {
      setError('网络错误');
    }
    setSaving(false);
  };

  const handleToggle = () => {
    if (!pref) return;
    if (!pref.is_enabled && !pref.email) {
      setError('请先填写邮箱地址');
      return;
    }
    save({ is_enabled: !pref.is_enabled });
  };

  const handleSaveEmail = () => {
    if (!pref) return;
    if (!pref.email.includes('@')) { setError('请输入有效邮箱'); return; }
    save({ email: pref.email });
  };

  const handleSaveTime = () => {
    if (!pref) return;
    save({ send_time: pref.send_time });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (!pref) return null;

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Mail size={22} className="text-[var(--color-accent)]" />
          <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">每日摘要</h2>
        </div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-text-muted)] mt-1 uppercase">
          每天自动收到 AI 新闻日报邮件
        </p>
      </div>

      {error && (
        <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-6 text-[var(--color-danger)] text-[13px] font-mono">{error}</div>
      )}
      {success && (
        <div className="border border-green-500/30 px-4 py-3 mb-6 text-green-400 text-[13px] font-mono">{success}</div>
      )}

      {/* 开关 */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)]">接收每日摘要</h3>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-1">
              开启后每天定时收到 AI 领域新闻摘要邮件
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              pref.is_enabled ? 'bg-[var(--color-accent)]' : 'bg-white/10'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              pref.is_enabled ? 'left-[26px]' : 'left-0.5'
            }`} />
          </button>
        </div>
      </div>

      {/* 邮箱 */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-[15px] font-semibold text-[var(--color-text)] mb-4">接收邮箱</h3>
        <div className="flex gap-3">
          <input
            value={pref.email}
            onChange={e => setPref({ ...pref, email: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleSaveEmail()}
            className="glass-input flex-1 font-mono text-[13px]"
            placeholder="your@email.com"
          />
          <button onClick={handleSaveEmail} disabled={saving} className="btn-secondary text-[12px]">
            <Save size={14} /> 保存
          </button>
        </div>
      </div>

      {/* 接收时间 */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock size={16} className="text-[var(--color-accent)]" />
          <h3 className="text-[15px] font-semibold text-[var(--color-text)]">接收时间</h3>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="time"
            value={pref.send_time}
            onChange={e => setPref({ ...pref, send_time: e.target.value })}
            className="glass-input font-mono text-[13px] w-40"
          />
          <button onClick={handleSaveTime} disabled={saving} className="btn-secondary text-[12px]">
            <Save size={14} /> 保存
          </button>
        </div>
        <p className="text-[11px] text-[var(--color-text-dim)] mt-2 font-mono">
          北京时间（UTC+8）
        </p>
      </div>
    </div>
  );
}
