import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, Play, Pause, Circle, Download, Loader2 } from 'lucide-react';
import AudioVisualizer from '../lib/AudioVisualizer';

export default function Visualizer() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const visRef = useRef<AudioVisualizer | null>(null);
  const [fileName, setFileName] = useState('');
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const vis = new AudioVisualizer({
      container: containerRef.current,
      width: 560,
      height: 560,
      fftSize: 512,
      smoothingFactor: 0.82,
      baseRadius: 80,
    });
    vis.start();
    visRef.current = vis;

    const audio = vis.audio;
    const onEnded = () => setPlaying(false);
    audio.addEventListener('pause', onEnded);
    audio.addEventListener('play', () => setPlaying(true));

    return () => {
      audio.removeEventListener('pause', onEnded);
      audio.removeEventListener('play', () => setPlaying(true));
      vis.destroy();
    };
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !visRef.current) return;
    setFileName(file.name);
    setRecorded(null);
    visRef.current.loadFile(file);
    visRef.current.play();
    setPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    if (!visRef.current) return;
    if (playing) {
      visRef.current.pause();
      setPlaying(false);
    } else {
      visRef.current.play();
      setPlaying(true);
    }
  }, [playing]);

  const handleStartRecord = useCallback(() => {
    if (!visRef.current) return;
    setRecorded(null);
    visRef.current.startRecord();
    setRecording(true);
  }, []);

  const handleStopRecord = useCallback(async () => {
    if (!visRef.current) return;
    const blob = await visRef.current.stopRecord();
    setRecording(false);
    if (blob) setRecorded(blob);
  }, []);

  const handleDownload = useCallback(() => {
    if (!recorded || !visRef.current) return;
    const url = visRef.current.getDownloadURL(recorded);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visualizer-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recorded]);

  return (
    <div
      className="h-screen w-screen flex flex-col items-center relative overflow-hidden"
      style={{ background: "url('/bg-auth.png') center/cover no-repeat, #060606" }}
    >
      {/* Ambient */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(100,160,220,0.06) 0%, transparent 50%)' }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between w-full px-8 py-5">
        <button onClick={() => navigate('/hub')}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors text-sm"
        >
          <ArrowLeft size={16} /> 返回 Hub
        </button>
        <div className="flex items-center gap-2">
          <Circle size={18} className="text-[var(--color-accent)]" />
          <span className="text-sm font-semibold text-[var(--color-text)]">频谱可视化</span>
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Canvas container */}
      <div ref={containerRef} className="relative z-10 rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 0 60px rgba(219,164,96,0.08)' }}
      />

      {/* Controls */}
      <div className="relative z-10 flex items-center gap-3 mt-6">
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFile} className="hidden" />

        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.06] text-sm text-[var(--color-text)] hover:border-white/20 hover:bg-white/[0.08] transition-all"
        >
          <Upload size={14} /> 上传音频
        </button>

        {fileName && (
          <button onClick={togglePlay}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-all"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? '暂停' : '播放'}
          </button>
        )}

        {fileName && !recording && (
          <button onClick={handleStartRecord}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-400/30 bg-red-400/10 text-sm text-red-400 hover:bg-red-400/15 transition-all"
          >
            <Circle size={10} className="fill-red-400" /> 录制
          </button>
        )}

        {recording && (
          <button onClick={handleStopRecord}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-400/30 bg-red-400/20 text-sm text-red-400 animate-pulse transition-all"
          >
            <Loader2 size={14} className="animate-spin" /> 停止录制
          </button>
        )}

        {recorded && (
          <button onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-green-400/30 bg-green-400/10 text-sm text-green-400 hover:bg-green-400/15 transition-all"
          >
            <Download size={14} /> 下载视频
          </button>
        )}
      </div>

      {fileName && (
        <p className="relative z-10 text-xs text-[var(--color-text-dim)] mt-3 font-mono">{fileName}</p>
      )}
    </div>
  );
}
