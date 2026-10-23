'use client';
import { useCallback, useEffect, useState } from 'react';

export const LOADING_TIMEOUT_MS = 15_000;

// Dupa `ms` de `active` continuu, timedOut devine true (skeletonul cere „Reincearca").
// restart() reseteaza manual (dupa apasarea pe Reincearca).
export function useLoadingTimeout(active: boolean, ms: number = LOADING_TIMEOUT_MS) {
  const [timedOut, setTimedOut] = useState(false);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!active) {
      setTimedOut(false);
      return;
    }
    const id = setTimeout(() => setTimedOut(true), ms);
    return () => clearTimeout(id);
  }, [active, ms, epoch]);

  const restart = useCallback(() => {
    setTimedOut(false);
    setEpoch((e) => e + 1);
  }, []);

  return { timedOut, restart };
}
