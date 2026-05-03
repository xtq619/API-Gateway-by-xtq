import { useEffect, useRef, useCallback } from 'react';

export default function CursorRing() {
  const ringRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: -100, y: -100 });
  const target = useRef({ x: -100, y: -100 });
  const raf = useRef(0);

  const lerp = useCallback(() => {
    pos.current.x += (target.current.x - pos.current.x) * 0.12;
    pos.current.y += (target.current.y - pos.current.y) * 0.12;
    if (ringRef.current) {
      ringRef.current.style.left = `${pos.current.x}px`;
      ringRef.current.style.top = `${pos.current.y}px`;
    }
    raf.current = requestAnimationFrame(lerp);
  }, []);

  useEffect(() => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    if (isMobile) return;

    const ring = ringRef.current;
    if (!ring) return;

    const onMouseMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };

    const onMouseLeave = () => {
      ring.classList.add('cursor-hidden');
    };

    const onMouseEnter = () => {
      ring.classList.remove('cursor-hidden');
    };

    // Scale up on interactive elements
    const onElementEnter = () => ring.classList.add('cursor-hover');
    const onElementLeave = () => ring.classList.remove('cursor-hover');

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    document.documentElement.addEventListener('mouseenter', onMouseEnter);

    // Observe interactive elements
    const attachToInteractive = () => {
      const selectors = 'a, button, input, select, textarea, [role="button"], label, .cursor-target';
      document.querySelectorAll(selectors).forEach(el => {
        el.addEventListener('mouseenter', onElementEnter);
        el.addEventListener('mouseleave', onElementLeave);
      });
    };

    attachToInteractive();
    const observer = new MutationObserver(attachToInteractive);
    observer.observe(document.body, { childList: true, subtree: true });

    raf.current = requestAnimationFrame(lerp);

    return () => {
      cancelAnimationFrame(raf.current);
      document.removeEventListener('mousemove', onMouseMove);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      document.documentElement.removeEventListener('mouseenter', onMouseEnter);
      observer.disconnect();
    };
  }, [lerp]);

  return (
    <div
      ref={ringRef}
      className="cursor-ring"
      aria-hidden="true"
    />
  );
}
