import React, { useEffect, useState } from 'react';
import { useTransition } from './Transition.jsx';

const W = 390;
const H = 844;

// Keeps the 390 x 844 design pixel-perfect on any screen by scaling it to fit,
// and applies the "leaving the page" fade/slide used between screens.
export default function Stage({ children }) {
  const [scale, setScale] = useState(1);
  const { leave } = useTransition();

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const leaving = leave !== null;
  const dx = leave === 'back' ? 22 : -22;

  return (
    <div className="viewport">
      <div className="frame" style={{ width: W * scale, height: H * scale }}>
        <div className="stage" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <div
            className="stage-inner"
            style={{
              transition: 'opacity .28s ease, transform .3s cubic-bezier(.32,.72,0,1)',
              opacity: leaving ? 0 : 1,
              transform: leaving ? `translateX(${dx}px) scale(.985)` : 'none',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
