import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { Swords, ArrowLeft, Play, Loader2, Scale, Bot, User } from 'lucide-react';

interface Turn {
  round: number;
  model: 'a' | 'b';
  model_name: string;
  content: string;
}

interface Model {
  id: string;
  display_name: string;
  model_name: string;
  is_enabled: boolean;
}

export default function Battle() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [topic, setTopic] = useState('');
  const [models, setModels] = useState<Model[]>([]);
  const [modelA, setModelA] = useState('');
  const [modelB, setModelB] = useState('');
  const [judgeModel, setJudgeModel] = useState('');
  const [rounds, setRounds] = useState(3);
  const [streaming, setStreaming] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [currentContent, setCurrentContent] = useState('');
  const [currentModel, setCurrentModel] = useState<'a' | 'b' | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [judgeSummary, setJudgeSummary] = useState('');
  const [error, setError] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.listModels().then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        const enabled = data.filter((m: Model) => m.is_enabled);
        setModels(enabled);
        if (enabled.length >= 3) {
          setModelA(enabled[0].id);
          setModelB(enabled[1].id);
          setJudgeModel(enabled[2].id);
        } else if (enabled.length >= 2) {
          setModelA(enabled[0].id);
          setModelB(enabled[1].id);
          setJudgeModel(enabled[0].id);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [turns, currentContent, judgeSummary]);

  const handleStart = async () => {
    if (!topic.trim() || !modelA || !modelB || !judgeModel) return;
    setStreaming(true);
    setTurns([]);
    setCurrentContent('');
    setCurrentModel(null);
    setJudgeSummary('');
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/v1/battle/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic: topic.trim(),
          model_a_id: modelA,
          model_b_id: modelB,
          judge_model_id: judgeModel,
          rounds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.detail || '对战启动失败');
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'turn') {
              setCurrentModel(event.model);
              setCurrentRound(event.round);
              // Typewriter effect
              const text = event.content;
              for (let i = 0; i <= text.length; i++) {
                setCurrentContent(text.slice(0, i));
                await new Promise((r) => setTimeout(r, 15));
              }
              setTurns((prev) => [...prev, {
                round: event.round,
                model: event.model,
                model_name: event.model_name,
                content: event.content,
              }]);
              setCurrentContent('');
              setCurrentModel(null);
            } else if (event.type === 'judge') {
              const text = event.content;
              for (let i = 0; i <= text.length; i++) {
                setJudgeSummary(text.slice(0, i));
                await new Promise((r) => setTimeout(r, 10));
              }
            } else if (event.type === 'error') {
              setError(event.detail || '对战过程中发生错误');
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? `错误: ${e.message}` : '网络错误');
    }
    setStreaming(false);
  };

  const getModelColor = (model: 'a' | 'b') => {
    return model === 'a'
      ? { bg: 'rgba(100,160,220,0.12)', border: 'rgba(100,160,220,0.3)', align: 'left' }
      : { bg: 'rgba(219,164,96,0.12)', border: 'rgba(219,164,96,0.3)', align: 'right' };
  };

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden"
      style={{ background: "url('/bg-auth.png') center/cover no-repeat, #060606" }}
    >
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, rgba(100,160,220,0.06) 0%, transparent 50%)' }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5">
        <button onClick={() => navigate('/hub')}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-sm"
        >
          <ArrowLeft size={16} /> 返回 Hub
        </button>
        <div className="flex items-center gap-2">
          <Swords size={18} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-text)]">模型擂台</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <User size={14} /> {user?.name || '用户'}
        </div>
      </div>

      {/* Controls */}
      <div className="relative z-10 px-8 pb-4">
        <div className="max-w-[900px] mx-auto flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">讨论主题</label>
            <input
              value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="输入一个话题，如：AI会取代程序员吗？"
              className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] outline-none focus:border-[var(--color-accent)]/50 transition-colors"
              disabled={streaming}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">辩手 A</label>
            <select value={modelA} onChange={e => setModelA(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--color-text)] outline-none"
              disabled={streaming}
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">辩手 B</label>
            <select value={modelB} onChange={e => setModelB(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--color-text)] outline-none"
              disabled={streaming}
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">裁判</label>
            <select value={judgeModel} onChange={e => setJudgeModel(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-[var(--color-text)] outline-none"
              disabled={streaming}
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">轮数: {rounds}</label>
            <input type="range" min={1} max={5} value={rounds}
              onChange={e => setRounds(Number(e.target.value))}
              className="w-20 accent-[var(--color-accent)]" disabled={streaming}
            />
          </div>
          <button
            onClick={handleStart}
            disabled={streaming || !topic.trim()}
            className="px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-black text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2"
          >
            {streaming ? <><Loader2 size={14} className="animate-spin" /> 对战中...</> : <><Play size={14} /> 开始</>}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2 max-w-[900px] mx-auto">{error}</p>}
      </div>

      {/* Chat area */}
      <div ref={chatRef} className="relative z-10 flex-1 overflow-y-auto px-8 pb-8">
        <div className="max-w-[900px] mx-auto flex flex-col gap-4">
          {turns.map((turn, i) => {
            const style = getModelColor(turn.model);
            const isLeft = turn.model === 'a';
            return (
              <div key={i} className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
                <div className="max-w-[75%] rounded-2xl px-5 py-3 border"
                  style={{ background: style.bg, borderColor: style.border }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Bot size={12} className="text-[var(--color-text-muted)]" />
                    <span className="text-xs font-mono text-[var(--color-text-muted)]">
                      {turn.model_name} · 第{turn.round}轮
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{turn.content}</p>
                </div>
              </div>
            );
          })}

          {/* Current streaming turn */}
          {currentModel && currentContent && (
            <div className={`flex ${currentModel === 'a' ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[75%] rounded-2xl px-5 py-3 border"
                style={{ background: getModelColor(currentModel).bg, borderColor: getModelColor(currentModel).border }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 size={12} className="animate-spin text-[var(--color-accent)]" />
                  <span className="text-xs font-mono text-[var(--color-accent)]">
                    {currentModel === 'a' ? '辩手A' : '辩手B'} 正在思考... · 第{currentRound}轮
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{currentContent}<span className="animate-pulse">|</span></p>
              </div>
            </div>
          )}

          {/* Judge summary */}
          {judgeSummary && (
            <div className="mt-4 rounded-2xl px-6 py-4 border"
              style={{ background: 'rgba(160,120,220,0.1)', borderColor: 'rgba(160,120,220,0.3)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Scale size={14} className="text-purple-400" />
                <span className="text-xs font-semibold text-purple-400">裁判总结</span>
              </div>
              <div className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-wrap">{judgeSummary}</div>
            </div>
          )}

          {turns.length === 0 && !streaming && (
            <div className="text-center py-20 text-[var(--color-text-dim)] text-sm">
              输入话题，选择模型，开始一场 AI 辩论
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
