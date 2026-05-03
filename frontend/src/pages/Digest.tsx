import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Mail, Clock, Plus, X, Send, Save, Loader2 } from 'lucide-react';

interface DigestSettings {
  id: string;
  is_enabled: boolean;
  cron_expr: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password_masked: string;
  smtp_sender: string;
  recipients: string[];
}

export default function Digest() {
  const [settings, setSettings] = useState<DigestSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  // 编辑状态
  const [smtpPassword, setSmtpPassword] = useState('');
  const [newRecipient, setNewRecipient] = useState('');

  const load = async () => {
    try {
      const res = await api.getDigestSettings();
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        setError('加载配置失败');
      }
    } catch {
      setError('网络错误');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (data: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.updateDigestSettings(data);
      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
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

  const handleSaveSmtp = () => {
    if (!settings) return;
    const data: Record<string, unknown> = {
      smtp_host: settings.smtp_host,
      smtp_port: settings.smtp_port,
      smtp_user: settings.smtp_user,
      smtp_sender: settings.smtp_sender,
    };
    if (smtpPassword) data.smtp_password = smtpPassword;
    update(data);
  };

  const handleToggle = () => {
    if (!settings) return;
    update({ is_enabled: !settings.is_enabled });
  };

  const handleSaveCron = () => {
    if (!settings) return;
    update({ cron_expr: settings.cron_expr });
  };

  const handleAddRecipient = () => {
    if (!settings || !newRecipient.trim()) return;
    const email = newRecipient.trim();
    if (!email.includes('@')) { setError('请输入有效邮箱'); return; }
    if (settings.recipients.includes(email)) { setError('已存在'); return; }
    const updated = [...settings.recipients, email];
    update({ recipients: updated });
    setNewRecipient('');
  };

  const handleRemoveRecipient = (email: string) => {
    if (!settings) return;
    update({ recipients: settings.recipients.filter(r => r !== email) });
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.sendTestDigest();
      if (res.ok) {
        setSuccess('测试邮件已发送，请检查收件箱');
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.detail?.message || body?.detail || '发送失败');
      }
    } catch {
      setError('网络错误');
    }
    setTesting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Mail size={22} className="text-[var(--color-accent)]" />
          <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight">每日摘要</h2>
        </div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-text-muted)] mt-1 uppercase">
          DAILY AI DIGEST
        </p>
      </div>

      {error && (
        <div className="border border-[var(--color-danger)]/30 px-4 py-3 mb-6 text-[var(--color-danger)] text-[13px] font-mono">{error}</div>
      )}
      {success && (
        <div className="border border-green-500/30 px-4 py-3 mb-6 text-green-400 text-[13px] font-mono">{success}</div>
      )}

      {/* 总开关 + 定时 */}
      <div className="glass-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text)]">功能开关</h3>
            <p className="text-[12px] text-[var(--color-text-muted)] mt-1">开启后将按设定时间自动发送 AI 新闻摘要邮件</p>
          </div>
          <button
            onClick={handleToggle}
            disabled={saving}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.is_enabled ? 'bg-[var(--color-accent)]' : 'bg-white/10'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              settings.is_enabled ? 'left-[26px]' : 'left-0.5'
            }`} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Clock size={14} className="text-[var(--color-text-dim)]" />
          <span className="text-[13px] text-[var(--color-text-muted)]">Cron:</span>
          <input
            value={settings.cron_expr}
            onChange={e => setSettings({ ...settings, cron_expr: e.target.value })}
            className="glass-input flex-1 max-w-[200px] font-mono text-[13px]"
            placeholder="0 8 * * *"
          />
          <button onClick={handleSaveCron} disabled={saving} className="btn-secondary text-[12px]">
            更新时间
          </button>
        </div>
        <p className="text-[11px] text-[var(--color-text-dim)] mt-2 font-mono">
          格式: 分 时 日 月 周 · 例: 0 8 * * * = 每天 8:00 · 30 9 * * 1-5 = 工作日 9:30
        </p>
      </div>

      {/* SMTP 配置 */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-[15px] font-semibold text-[var(--color-text)] mb-4">SMTP 邮箱配置</h3>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label-text">SMTP 主机</label>
            <input
              value={settings.smtp_host}
              onChange={e => setSettings({ ...settings, smtp_host: e.target.value })}
              className="glass-input w-full font-mono text-[13px]"
              placeholder="smtp.qq.com"
            />
          </div>
          <div>
            <label className="label-text">端口</label>
            <input
              type="number"
              value={settings.smtp_port}
              onChange={e => setSettings({ ...settings, smtp_port: parseInt(e.target.value) || 465 })}
              className="glass-input w-full font-mono text-[13px]"
            />
          </div>
          <div>
            <label className="label-text">发件账号</label>
            <input
              value={settings.smtp_user}
              onChange={e => setSettings({ ...settings, smtp_user: e.target.value })}
              className="glass-input w-full font-mono text-[13px]"
              placeholder="your@qq.com"
            />
          </div>
          <div>
            <label className="label-text">授权码</label>
            <input
              type="password"
              value={smtpPassword}
              onChange={e => setSmtpPassword(e.target.value)}
              className="glass-input w-full font-mono text-[13px]"
              placeholder={settings.smtp_password_masked || '输入 SMTP 授权码'}
            />
          </div>
          <div>
            <label className="label-text">发件人名称</label>
            <input
              value={settings.smtp_sender}
              onChange={e => setSettings({ ...settings, smtp_sender: e.target.value })}
              className="glass-input w-full font-mono text-[13px]"
              placeholder="同发件账号"
            />
          </div>
        </div>

        <button onClick={handleSaveSmtp} disabled={saving} className="btn-primary text-[13px]">
          <Save size={14} />
          保存 SMTP 配置
        </button>
      </div>

      {/* 收件人 */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-[15px] font-semibold text-[var(--color-text)] mb-4">收件人</h3>

        <div className="flex gap-2 mb-4">
          <input
            value={newRecipient}
            onChange={e => setNewRecipient(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddRecipient()}
            className="glass-input flex-1 font-mono text-[13px]"
            placeholder="输入邮箱地址"
          />
          <button onClick={handleAddRecipient} className="btn-secondary text-[12px]">
            <Plus size={14} /> 添加
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {settings.recipients.map(email => (
            <span key={email} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-[rgba(255,255,255,0.08)] text-[12px] font-mono text-[var(--color-text)]">
              {email}
              <button onClick={() => handleRemoveRecipient(email)} className="text-[var(--color-text-dim)] hover:text-[var(--color-danger)]">
                <X size={12} />
              </button>
            </span>
          ))}
          {settings.recipients.length === 0 && (
            <p className="text-[12px] text-[var(--color-text-dim)] font-mono">暂无收件人</p>
          )}
        </div>
      </div>

      {/* 测试 */}
      <div className="glass-card p-6">
        <h3 className="text-[15px] font-semibold text-[var(--color-text)] mb-2">发送测试</h3>
        <p className="text-[12px] text-[var(--color-text-muted)] mb-4">
          立即发送一封测试邮件到上述收件人，验证配置是否正确
        </p>
        <button onClick={handleTest} disabled={testing || settings.recipients.length === 0} className="btn-primary text-[13px]">
          <Send size={14} />
          {testing ? '发送中...' : '发送测试邮件'}
        </button>
      </div>
    </div>
  );
}
