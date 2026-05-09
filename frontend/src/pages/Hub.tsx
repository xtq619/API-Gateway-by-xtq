import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { Server, Bot, LogOut, Sparkles, ArrowRight, MessageSquare, Swords } from 'lucide-react';

const sections = [
  {
    key: 'api',
    icon: Server,
    title: '模型广场',
    subtitle: 'MODEL HUB',
    desc: '统一代理 OpenAI、Claude 等多模型 API，管理密钥、用量计费、速率限制',
    route: '/dashboard',
    iconBg: 'rgba(219,164,96,0.15)',
    iconBorder: 'rgba(219,164,96,0.25)',
  },
  {
    key: 'ai',
    icon: Bot,
    title: 'AI 早报',
    subtitle: 'AI DAILY',
    desc: '每日精选 AI 行业新闻、论文、工具动态，保持前沿洞察',
    route: '/news',
    iconBg: 'rgba(100,160,220,0.15)',
    iconBorder: 'rgba(100,160,220,0.25)',
  },
  {
    key: 'battle',
    icon: Swords,
    title: '模型擂台',
    subtitle: 'MODEL ARENA',
    desc: '两个 AI 模型围绕话题进行多轮辩论，裁判 AI 总结评判',
    route: '/battle',
    iconBg: 'rgba(220,120,100,0.15)',
    iconBorder: 'rgba(220,120,100,0.25)',
  },
  {
    key: 'feedback',
    icon: MessageSquare,
    title: '建议留言',
    subtitle: 'FEEDBACK',
    desc: '写下你的想法和建议，查看其他用户的反馈，共同改进平台',
    route: '/feedback',
    iconBg: 'rgba(160,120,220,0.15)',
    iconBorder: 'rgba(160,120,220,0.25)',
  },
];

export default function Hub() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: "url('/bg-auth.png') center/cover no-repeat, #060606",
      }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 45%, rgba(100,160,220,0.06) 0%, transparent 50%), radial-gradient(ellipse at 50% 60%, rgba(219,164,96,0.03) 0%, transparent 40%)',
        }}
      />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.5) 100%)' }}
      />

      {/* Top bar */}
      <div className="fixed top-7 right-8 flex items-center gap-4 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-white/90 text-black flex items-center justify-center text-xs font-mono font-medium rounded-full">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <p className="text-[13px] text-[var(--color-text)]">{user?.name || '用户'}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] font-mono">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-white/8 hover:border-white/20 hover:bg-white/[0.04] rounded-lg transition-all text-xs"
          title="退出登录"
        >
          <LogOut size={13} />
          退出
        </button>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center px-6 w-full max-w-[900px]">
        {/* Title */}
        <div className="text-center mb-12 animate-fade-in-up">
          <Sparkles size={20} className="text-[var(--color-accent)] mx-auto mb-4" />
          <h1 className="text-[26px] font-semibold text-[var(--color-text)] tracking-tight" style={{ fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif" }}>
            选择你的工作空间
          </h1>
          <p className="font-mono text-[11px] tracking-[0.35em] text-[var(--color-text-muted)] mt-2 uppercase">
            CHOOSE YOUR WORKSPACE
          </p>
        </div>

        {/* Cards */}
        <div className="flex gap-6 w-full">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => navigate(s.route)}
                className="group flex-1 flex flex-col items-start p-8 rounded-2xl border border-white/[0.12] border-t-white/[0.18] cursor-pointer text-left transition-all duration-300 hover:-translate-y-1 relative overflow-hidden animate-fade-in-up"
                style={{
                  animationDelay: `${0.2 + i * 0.15}s`,
                  background: 'linear-gradient(180deg, rgba(40,70,110,0.18) 0%, rgba(12,14,20,0.35) 100%), rgba(8,12,20,0.3)',
                  backdropFilter: 'blur(36px) saturate(150%)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4), 0 8px 48px rgba(0,0,0,0.3)',
                }}
              >
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t border-l rounded-tl-2xl" style={{ borderColor: 'rgba(180,210,240,0.15)' }} />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b border-r rounded-br-2xl" style={{ borderColor: 'rgba(219,164,96,0.15)' }} />

                {/* Icon */}
                <div
                  className="w-[52px] h-[52px] flex items-center justify-center rounded-[14px] mb-6 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(219,164,96,0.1)]"
                  style={{ background: s.iconBg, border: `1px solid ${s.iconBorder}` }}
                >
                  <Icon size={26} className="text-[var(--color-accent)]" />
                </div>

                {/* Body */}
                <div className="flex-1">
                  <p className="font-mono text-[10px] tracking-[0.25em] text-[var(--color-text-muted)] mb-1.5 uppercase">{s.subtitle}</p>
                  <h2 className="text-xl font-semibold text-[var(--color-text)] mb-2.5 tracking-tight" style={{ fontFamily: "'Inter','PingFang SC','Microsoft YaHei',sans-serif" }}>
                    {s.title}
                  </h2>
                  <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)]">{s.desc}</p>
                </div>

                {/* Arrow */}
                <div className="absolute bottom-8 right-8 text-xl text-[var(--color-text-dim)] transition-all duration-300 group-hover:text-[var(--color-accent)] group-hover:translate-x-1">
                  <ArrowRight size={20} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
