import { useState, useEffect, useCallback, useRef } from 'react';
import { Music, Pause, SkipBack, SkipForward } from 'lucide-react';

const playlist = [
  { src: '/周杰伦-晴天.mp3', name: '晴天' },
  { src: '/周杰伦-不能说的秘密.mp3', name: '不能说的秘密' },
  { src: '/周杰伦 - .爱在西元前.mp3', name: '爱在西元前' },
];

export default function MusicPlayer() {
  const audioRef = useRef(new Audio(playlist[0].src));
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

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
