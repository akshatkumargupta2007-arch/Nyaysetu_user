import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Page-to-page motion: the current screen fades and slides away (300 ms),
// then the next route mounts and plays its own entrance animation.
const TransitionContext = createContext({ leave: null, go: () => {} });

export function TransitionProvider({ children }) {
  const navigate = useNavigate();
  const [leave, setLeave] = useState(null); // null | 'fwd' | 'back'
  const busy = useRef(false);

  const go = useCallback(
    (to, { back = false } = {}) => {
      if (busy.current) return;
      busy.current = true;
      setLeave(back ? 'back' : 'fwd');
      setTimeout(() => {
        navigate(to);
        setLeave(null);
        busy.current = false;
      }, 300);
    },
    [navigate]
  );

  const value = useMemo(() => ({ leave, go }), [leave, go]);
  return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>;
}

export const useTransition = () => useContext(TransitionContext);
export const useGo = () => useContext(TransitionContext).go;
