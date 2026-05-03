import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import {
  LayoutDashboard, Key, Activity, CreditCard, Cpu, Shield, LogOut, MessageSquare, Newspaper, Server, Bot, ArrowLeft,
} from 'lucide-react';

const apiNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/keys', icon: Key, label: 'API 密钥' },
  { to: '/usage', icon: Activity, label: '用量统计' },
  { to: '/billing', icon: CreditCard, label: '充值计费' },
  { to: '/models', icon: Cpu, label: '模型列表' },
  { to: '/feedback', icon: MessageSquare, label: '建议留言' },
];

const aiNavItems = [
  { to: '/news', icon: Newspaper, label: 'AI 资讯' },
];

type Section = 'api' | 'ai';

function getSection(pathname: string): Section {
  if (pathname.startsWith('/news')) return 'ai';
  return 'api';
}

const sectionMeta: Record<Section, { icon: typeof Server; label: string; subtitle: string }> = {
  api: { icon: Server, label: '星辰大海', subtitle: 'LLM PROXY' },
  ai: { icon: Bot, label: 'AI 资讯', subtitle: 'AI INSIGHT' },
};

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuthStore();
  const section = getSection(location.pathname);
  const navItems = section === 'api' ? apiNavItems : aiNavItems;
  const meta = sectionMeta[section];
  const Icon = meta.icon;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 glass-panel flex flex-col fixed h-full z-30 border-r border-[rgba(255,255,255,0.06)]">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-2.5">
            <Icon size={16} className="text-[var(--color-accent)]" />
            <div>
              <h1 className="font-mono text-sm tracking-wider text-[var(--color-text)]">{meta.label}</h1>
              <p className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-[0.2em]">{meta.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => {
            const NavIcon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 text-[13px] tracking-wide rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text)]'
                }`}
              >
                <NavIcon size={16} />
                {item.label}
              </Link>
            );
          })}
          {isAdmin() && section === 'api' && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 text-[13px] tracking-wide rounded-lg transition-all ${
                location.pathname.startsWith('/admin')
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text)]'
              }`}
            >
              <Shield size={16} />
              管理后台
            </Link>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-[rgba(255,255,255,0.05)] space-y-2">
          <Link
            to="/hub"
            className="flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors rounded-lg hover:bg-white/[0.04]"
          >
            <ArrowLeft size={13} />
            返回选择页面
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white/90 text-black flex items-center justify-center text-[11px] font-mono font-medium rounded-full shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-[var(--color-text)] truncate leading-tight">{user?.name || '用户'}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] truncate font-mono">{user?.email}</p>
            </div>
            <button onClick={handleLogout} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shrink-0" title="退出登录">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 ml-60 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
