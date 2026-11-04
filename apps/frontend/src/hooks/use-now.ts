'use client';

import { useEffect, useState } from 'react';

// E-company-6: "acum" care se reimprospateaza periodic — termenele calculate la randare
// (gratia de 30 min, fereastra de retragere a ofertei, SLA) comuta singure fara reload.
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
