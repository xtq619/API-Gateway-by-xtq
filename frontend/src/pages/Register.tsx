import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.register({ email, password, name });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        const userRes = await api.getMe();
        const user = await userRes.json();
        setAuth(user, data.access_token);
        navigate('/dashboard');
      } else {
        const err = await res.json();
        setError(err.detail?.message || err.detail || '注册失败');
      }
    } catch {
      setError('网络错误');
    }
    setLoading(false);
  };

  const inputClass = "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-[13px] font-mono focus:outline-none focus:border-white placeholder:text-[var(--color-text-dim)]";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 w-full max-w-md">
        <h1 className="font-mono text-lg tracking-wider text-[var(--color-text)] mb-1">API GATEWAY</h1>
        <p className="text-[var(--color-text-muted)] text-[12px] font-mono mb-8 tracking-wide">注册账号</p>
        {error && (
          <div className="border border-[var(--color-danger)]/30 text-[var(--color-danger)] px-4 py-3 mb-6 text-[12px] font-mono">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">名称</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className={inputClass} placeholder="您的称呼" required />
          </div>
          <div>
            <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">邮箱</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className={inputClass} placeholder="your@example.com" required />
          </div>
          <div>
            <label className="block font-mono text-[10px] text-[var(--color-text-muted)] tracking-wider mb-1.5">密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={inputClass} placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-white text-black text-[12px] font-mono tracking-wider cursor-pointer border border-white transition-opacity hover:opacity-85 disabled:opacity-40">
            {loading ? '创建中...' : '注册'}
          </button>
        </form>
        <p className="text-[12px] text-[var(--color-text-muted)] mt-6 text-center font-mono">
          已有账号？<Link to="/login" className="text-[var(--color-accent)] hover:underline ml-1">去登录</Link>
        </p>
      </div>
    </div>
  );
}
