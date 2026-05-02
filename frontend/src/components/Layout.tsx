import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { useEffect } from 'react';
import { api } from '../lib/api';
import {
  LayoutDashboard, Key, Activity, CreditCard, Cpu, Shield, LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/keys', icon: Key, label: 'API 密钥' },
  { to: '/usage', icon: Activity, label: '用量统计' },
  { to: '/billing', icon: CreditCard, label: '充值计费' },
  { to: '/models', icon: Cpu, label: '模型列表' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setAuth, logout, isAdmin } = useAuthStore();

  useEffect(() => {
    if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/register')) {
      api.getMe().then(res => {
        if (res.ok) res.json().then(u => setAuth(u, localStorage.getItem('token') || ''));
        else navigate('/login');
      });
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-white">API 中转站</h1>
          <p className="text-sm text-slate-400">LLM 代理平台</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
          {isAdmin() && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                location.pathname.startsWith('/admin')
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              <Shield size={18} />
              管理后台
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-medium">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{user?.name || '用户'}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-white" title="退出登录">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
