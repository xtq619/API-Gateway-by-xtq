import { useState, useEffect, useCallback, useRef } from 'react';
import { Music, Pause, SkipBack, SkipForward } from 'lucide-react';

const playlist = [
  { src: '/周杰伦-晴天.mp3', name: '晴天' },
  { src: '/周杰伦-不能说的秘密.mp3', name: '不能说的秘密' },
  { src: '/周杰伦 - .爱在西元前.mp3', name: '爱在西元前' },
];

const BAR_COUNT = 5;

export default function MusicPlayer() {
  const audioRef = useRef(new Audio(playlist[0].src));
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(2));
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  const initAudioAnalyser = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    const source = ctx.createMediaElementSource(audioRef.current);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
  }, []);

  const animate = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    // Pick 5 frequency bands
    const step = Math.floor(data.length / BAR_COUNT);
    const newBars = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const val = data[i * step] || 0;
      newBars.push(2 + (val / 255) * 14);
    }
    setBars(newBars);
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (playing) {
      initAudioAnalyser();
      rafRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(rafRef.current);
      setBars(new Array(BAR_COUNT).fill(2));
    }
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [playing, animate, initAudioAnalyser]);

  useEffect(() => {
    const audio = audioRef.current;
    audio.volume = 0.12;
    audio.loop = true;

    audio.play().then(() => setPlaying(true)).catch(() => {
      const startOnClick = () => {
        audio.play().then(() => setPlaying(true)).catch(() => {});
        document.removeEventListener('click', startOnClick);
      };
      document.addEventListener('click', startOnClick);
    });

    return () => { audio.pause(); };
  }, []);

  const switchTrack = useCallback((index: number) => {
    const audio = audioRef.current;
    audio.pause();
    audio.src = playlist[index].src;
    audio.loop = true;
    audio.currentTime = 0;
    audio.play().then(() => setPlaying(true)).catch(() => {});
    setCurrent(index);
  }, []);

  const prev = useCallback(() => {
    switchTrack((current - 1 + playlist.length) % playlist.length);
  }, [current, switchTrack]);

  const next = useCallback(() => {
    switchTrack((current + 1) % playlist.length);
  }, [current, switchTrack]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing]);

  return (
    <div className="music-player-wrapper">
      {playing && (
        <div className="music-bars">
          {bars.map((h, i) => (
            <div
              key={i}
              className="music-bar"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
      )}
      <div className="music-controls">
        <button onClick={prev} className="music-btn-sm" title="上一首">
          <SkipBack size={14} />
        </button>
        <button
          onClick={toggle}
          className={`music-btn ${playing ? 'music-btn--playing' : ''}`}
          title={playing ? '暂停' : '播放'}
        >
          {playing ? <Pause size={16} /> : <Music size={16} />}
        </button>
        <button onClick={next} className="music-btn-sm" title="下一首">
          <SkipForward size={14} />
        </button>
      </div>
    </div>
  );
}
