import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import {
  LayoutDashboard, Key, Activity, CreditCard, Cpu, Shield, LogOut,
  Newspaper, Server, Bot, ArrowLeft, Mail, PanelLeftClose, PanelLeftOpen, Menu, X,
} from 'lucide-react';

const apiNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/keys', icon: Key, label: 'API 密钥' },
  { to: '/usage', icon: Activity, label: '用量统计' },
  { to: '/billing', icon: CreditCard, label: '充值计费' },
  { to: '/models', icon: Cpu, label: '模型列表' },
];

const aiNavItems = [
  { to: '/news', icon: Newspaper, label: 'AI 资讯' },
  { to: '/digest', icon: Mail, label: '每日摘要' },
];

type Section = 'api' | 'ai';

function getSection(pathname: string): Section {
  if (pathname.startsWith('/news') || pathname.startsWith('/digest')) return 'ai';
  return 'api';
}

const sectionMeta: Record<Section, { icon: typeof Server; label: string; subtitle: string }> = {
  api: { icon: Server, label: 'API Gateway', subtitle: 'LLM PROXY' },
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

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // 关闭移动抽屉
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarW = collapsed && !isMobile ? 'w-16' : 'w-60';
  const mainMl = isMobile ? 'ml-0' : collapsed ? 'ml-16' : 'ml-60';

  return (
    <div className="flex min-h-screen">
      {/* 移动端遮罩 */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 侧栏 */}
      <aside
        className={`${sidebarW} glass-panel flex flex-col fixed h-full z-40 border-r border-[rgba(255,255,255,0.06)] transition-all duration-300 ${
          isMobile
            ? `${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`
            : ''
        }`}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[rgba(255,255,255,0.05)] flex items-center justify-between">
          {(!collapsed || isMobile) ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon size={16} className="text-[var(--color-accent)] shrink-0" />
              <div className="min-w-0">
                <h1 className="font-mono text-sm tracking-wider text-[var(--color-text)] truncate">{meta.label}</h1>
                <p className="font-mono text-[10px] text-[var(--color-text-muted)] tracking-[0.2em]">{meta.subtitle}</p>
              </div>
            </div>
          ) : (
            <Icon size={16} className="text-[var(--color-accent)] mx-auto" />
          )}
          {/* 移动端关闭按钮 */}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
              <X size={18} />
            </button>
          )}
        </div>

        {/* 导航 */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => {
            const NavIcon = item.icon;
            const isActive = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg transition-all ${
                  collapsed && !isMobile
                    ? 'justify-center px-0 py-2.5'
                    : 'px-3 py-2.5 text-[13px] tracking-wide'
                } ${
                  isActive
                    ? 'bg-white text-black shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text)]'
                }`}
                title={collapsed && !isMobile ? item.label : undefined}
              >
                <NavIcon size={16} />
                {(!collapsed || isMobile) && item.label}
              </Link>
            );
          })}
          {isAdmin() && section === 'api' && (
            <Link
              to="/admin"
              className={`flex items-center gap-3 rounded-lg transition-all ${
                collapsed && !isMobile
                  ? 'justify-center px-0 py-2.5'
                  : 'px-3 py-2.5 text-[13px] tracking-wide'
              } ${
                location.pathname.startsWith('/admin')
                  ? 'bg-white text-black shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:bg-white/[0.06] hover:text-[var(--color-text)]'
              }`}
              title={collapsed && !isMobile ? '管理后台' : undefined}
            >
              <Shield size={16} />
              {(!collapsed || isMobile) && '管理后台'}
            </Link>
          )}
        </nav>

        {/* 底部 */}
        <div className="p-3 border-t border-[rgba(255,255,255,0.05)] space-y-2">
          <Link
            to="/hub"
            className={`flex items-center gap-2 py-2 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors rounded-lg hover:bg-white/[0.04] ${
              collapsed && !isMobile ? 'justify-center px-0' : 'px-3'
            }`}
            title={collapsed && !isMobile ? '返回选择页面' : undefined}
          >
            <ArrowLeft size={13} />
            {(!collapsed || isMobile) && '返回选择页面'}
          </Link>
          <div className={`flex items-center ${collapsed && !isMobile ? 'justify-center' : 'gap-2.5'}`}>
            <div className="w-7 h-7 bg-white/90 text-black flex items-center justify-center text-[11px] font-mono font-medium rounded-full shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {(!collapsed || isMobile) && (
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[var(--color-text)] truncate leading-tight">{user?.name || '用户'}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate font-mono">{user?.email}</p>
              </div>
            )}
            {(!collapsed || isMobile) && (
              <button onClick={handleLogout} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shrink-0" title="退出登录">
                <LogOut size={13} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className={`flex-1 ${mainMl} transition-all duration-300 overflow-x-hidden min-w-0`}>
        {/* 顶部栏：移动端汉堡按钮 + 桌面端收起按钮 */}
        <div className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,255,255,0.04)]" style={{ background: 'rgba(6,6,6,0.8)', backdropFilter: 'blur(12px)' }}>
          {isMobile ? (
            <button
              onClick={() => setMobileOpen(true)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <Menu size={20} />
            </button>
          ) : (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              title={collapsed ? '展开侧栏' : '收起侧栏'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}
          <span className="text-[12px] font-mono text-[var(--color-text-muted)] tracking-wider">{meta.label}</span>
        </div>

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
