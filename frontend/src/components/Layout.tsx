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
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <aside className="w-64 bg-[var(--color-bg)]/80 backdrop-blur-xl border-r border-[var(--color-border)] flex flex-col fixed h-full z-30">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h1 className="font-mono text-lg tracking-wider text-[var(--color-text)]">API GATEWAY</h1>
          <p className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-[0.2em] mt-1">LLM PROXY</p>
        </div>
        <nav className="flex-1 p-4 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 text-[13px] tracking-wide transition-colors ${
                  isActive
                    ? 'bg-white text-black'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
          {isAdmin() && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 text-[13px] tracking-wide transition-colors ${
                location.pathname.startsWith('/admin')
                  ? 'bg-white text-black'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-light)] hover:text-[var(--color-text)]'
              }`}
            >
              <Shield size={16} />
              管理后台
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black flex items-center justify-center text-xs font-mono font-medium">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[var(--color-text)] truncate">{user?.name || '用户'}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] truncate font-mono">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors" title="退出登录">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
