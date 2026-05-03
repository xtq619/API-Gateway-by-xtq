import { useState, useEffect, useCallback } from 'react';
import { Music, Pause } from 'lucide-react';

const audio = new Audio('/周杰伦-晴天.mp3');
audio.loop = true;
audio.volume = 0.12;

let _autoplayBlocked = false;

export default function MusicPlayer() {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    audio.play().then(() => setPlaying(true)).catch(() => {
      _autoplayBlocked = true;
      const startOnClick = () => {
        audio.play().then(() => setPlaying(true)).catch(() => {});
        document.removeEventListener('click', startOnClick);
      };
      document.addEventListener('click', startOnClick);
    });
  }, []);

  const toggle = useCallback(() => {
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing]);

  return (
    <div className="music-player-wrapper">
      <button
        onClick={toggle}
        className={`music-btn ${playing ? 'music-btn--playing' : ''}`}
        title={playing ? '暂停' : '播放'}
      >
        {playing ? <Pause size={16} /> : <Music size={16} />}
      </button>
    </div>
  );
}
