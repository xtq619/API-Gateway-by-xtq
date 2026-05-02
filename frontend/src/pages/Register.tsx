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

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md border border-slate-700">
        <h1 className="text-2xl font-bold text-white mb-2">注册账号</h1>
        <p className="text-slate-400 mb-6">加入 API Gateway</p>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">昵称</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="您的称呼" required />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">邮箱</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="your@example.com" required />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">密码</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {loading ? '创建中...' : '注册'}
          </button>
        </form>
        <p className="text-sm text-slate-400 mt-4 text-center">
          已有账号？<Link to="/login" className="text-indigo-400 hover:underline">去登录</Link>
        </p>
      </div>
    </div>
  );
}
