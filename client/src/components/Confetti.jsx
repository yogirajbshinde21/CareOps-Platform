// client/src/components/Confetti.jsx - Lightweight CSS confetti animation
import { useEffect, useRef } from 'react';

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6'];
const CONFETTI_COUNT = 80;

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const pieces = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  id: i,
  color: COLORS[i % COLORS.length],
  left: randomBetween(0, 100),
  delay: randomBetween(0, 0.5),
  duration: randomBetween(1.5, 3.5),
  size: randomBetween(6, 12),
  rotation: randomBetween(0, 360),
  drift: randomBetween(-40, 40),
  shape: i % 3,
}));

const Confetti = ({ active, duration = 4000 }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;
    containerRef.current.style.display = 'block';
    const timer = setTimeout(() => {
      if (containerRef.current) containerRef.current.style.display = 'none';
    }, duration);
    return () => clearTimeout(timer);
  }, [active, duration]);

  if (!active) return null;

  return (
    <div ref={containerRef} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      pointerEvents: 'none', overflow: 'hidden',
    }}>
      {pieces.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            top: '-5%',
            left: `${p.left}%`,
            width: p.shape === 2 ? `${p.size * 1.5}px` : `${p.size}px`,
            height: p.shape === 2 ? `${p.size * 0.6}px` : `${p.size}px`,
            background: p.color,
            borderRadius: p.shape === 1 ? '50%' : '2px',
            transform: `rotate(${p.rotation}deg)`,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            '--drift': `${p.drift}px`,
            opacity: 0,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(0) translateX(0) rotate(0deg) scale(1);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(105vh) translateX(var(--drift)) rotate(720deg) scale(0.5);
          }
        }
      `}</style>
    </div>
  );
};

export default Confetti;
