import { useEffect, useRef, useState } from 'react';

// Soft glowing orb that follows the mouse cursor.
// Default: relaxed glow. Pressed: shrinks slightly, glow intensifies.
export function CursorOrb() {
  const ref = useRef();
  const [pressed, setPressed] = useState(false);

  // Skip on touch-only devices (no mouse hover).
  const [enabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(hover: none)').matches;
  });

  useEffect(() => {
    if (!enabled) return;

    const move = (e) => {
      if (!ref.current) return;
      ref.current.style.transform =
        `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    const leave = () => {
      // Hide orb when cursor leaves the window
      if (ref.current) ref.current.style.opacity = '0';
    };
    const enter = () => {
      if (ref.current) ref.current.style.opacity = '1';
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    window.addEventListener('mouseleave', leave);
    document.addEventListener('mouseenter', enter);

    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mouseleave', leave);
      document.removeEventListener('mouseenter', enter);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      className={`cursor-orb${pressed ? ' pressed' : ''}`}
      aria-hidden="true"
    />
  );
}
