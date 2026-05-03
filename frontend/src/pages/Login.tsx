import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { api } from '../lib/api';

export default function Login() {
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
      const res = await api.login({ email, password });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        const userRes = await api.getMe();
        const user = await userRes.json();
        setAuth(user, data.access_token);
        navigate('/hub');
      } else {
        const err = await res.json();
        setError(err.detail?.message || err.detail || '登录失败');
      }
    } catch {
      setError('网络错误');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-form-panel">
        <h1 className="auth-hero-title">智能之上，是星辰大海。</h1>
        <p className="auth-hero-subtitle">Beyond intelligence, the cosmos awaits.</p>
        <div className="auth-form-card">
          <h3>登录</h3>
          <p className="subtitle">Sign in to your account</p>
          <div className="auth-divider" />

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div className="stagger-1 animate-fade-in-up">
              <label className="auth-label">账号</label>
              <input
                type="text" value={email} onChange={e => setEmail(e.target.value)}
                className="auth-input-v3" placeholder="用户名或邮箱" required
              />
            </div>
            <div className="stagger-2 animate-fade-in-up">
              <label className="auth-label">密码</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="auth-input-v3" placeholder="••••••••" required
              />
            </div>
            <button type="submit" disabled={loading} className="auth-btn-v3 stagger-3 animate-fade-in-up">
              {loading ? '验证中...' : '登 录'}
            </button>
          </form>

          <p className="auth-link stagger-4 animate-fade-in-up">
            还没有账号？<Link to="/register">注册</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
