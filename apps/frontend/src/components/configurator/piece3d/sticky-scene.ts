'use client';

import { useEffect, useState } from 'react';

// Etapa 8 (40.5, revizuire M2 + m6): pe telefon scena 3D sta lipita sus, sub antetul
// aplicatiei; panoul zonei atinse trebuie sa ajunga INTREG sub scena, nu sub ea.

const GAP = 8;

// Cat trebuie derulata pagina (px; negativ = in sus) ca panoul sa stea intreg intre
// marginea de jos a scenei lipite si marginea de jos a ecranului. Cand panoul e mai
// inalt decat spatiul ramas, se aliniaza sus, sub scena (inceputul lui ramane vizibil).
export function zonePanelScrollDelta(
  panel: { top: number; bottom: number },
  sceneBottom: number,
  viewportHeight: number,
): number {
  const topLimit = sceneBottom + GAP;
  const bottomLimit = viewportHeight - GAP;
  if (panel.top < topLimit) return panel.top - topLimit;
  if (panel.bottom > bottomLimit) return Math.min(panel.bottom - bottomLimit, panel.top - topLimit);
  return 0;
}

// Marginea de jos a scenei DUPA derulare. Cat pagina e sus, scena nu e inca lipita: derularea o
// duce sub antet, deci limita panoului e pozitia ei lipita (`stickyTop` + inaltime), nu cea de
// acum. Fara asta, atingerea unei zone cu scena nelipita misca pagina doar cativa pixeli si
// panoul ramane sub ecran (verificarea in browser, etapa 8).
export function sceneBottomAfterScroll(
  scene: { bottom: number; height: number },
  stickyTop: number | null,
): number {
  if (stickyTop === null || !Number.isFinite(stickyTop)) return scene.bottom;
  return Math.min(scene.bottom, stickyTop + scene.height);
}

// Inaltimea reala a antetului lipit (app-header / public-header, `sticky top-0`), urmarita
// cand se schimba (meniu pe doua randuri, banner). null = necunoscuta (ramane rezerva 4rem).
export function useStickyHeaderHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const update = () => {
      const position = window.getComputedStyle(header).position;
      setHeight(position === 'sticky' || position === 'fixed' ? Math.round(header.getBoundingClientRect().height) : 0);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return height;
}
