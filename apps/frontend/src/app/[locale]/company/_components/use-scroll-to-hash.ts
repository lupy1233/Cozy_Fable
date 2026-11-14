'use client';

import { useEffect } from 'react';

// h1 (etapa 11): pasii din „Pregateste-ti firma” (Panou) duc la /company#sectiune. Sectiunile
// apar abia dupa incarcarea firmei, deci browserul nu mai gaseste ancora singur → o cautam noi.
// Revizuire m5:
// - doar la o navigare noua cu ancora: la „Inapoi” / „Inainte” (back_forward) sau cand pagina
//   e deja derulata (pozitie restaurata de browser) nu atingem pozitia;
// - dupa derulare, focusul trece pe titlul sectiunii (tastatura, cititoare de ecran).
export function useScrollToHashSection(delayMs = 50) {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    if (isBackForward() || window.scrollY > 0) return;
    const timer = window.setTimeout(() => {
      const section = document.getElementById(id);
      if (!section) return;
      section.scrollIntoView({ block: 'start' });
      const heading = section.querySelector<HTMLElement>('h1, h2, h3') ?? section;
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);
}

function isBackForward(): boolean {
  try {
    const nav = performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === 'back_forward';
  } catch {
    return false;
  }
}
