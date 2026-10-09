import React from 'react';
import { useGo } from './Transition.jsx';

// A normal <a> that plays the "tap burst" and then navigates with the page transition.
export function TLink({ to, onClick, children, ...rest }) {
  const go = useGo();
  return (
    <a
      href={to}
      {...rest}
      onClick={(e) => {
        const r = onClick ? onClick(e) : undefined;
        e.preventDefault();
        if (r === false) return; // the screen decided not to leave (it may navigate itself later)
        const el = e.currentTarget;
        el.classList.add('tapped');
        setTimeout(() => el.classList.remove('tapped'), 700);
        go(to, { back: rest['aria-label'] === 'Go back' });
      }}
    >
      {children}
    </a>
  );
}
