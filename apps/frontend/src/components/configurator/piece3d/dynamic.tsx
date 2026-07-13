'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// three.js (~160KB gzip) se incarca DOAR cand un step configurator-3d ajunge
// pe ecran (docs/10 §5) — primul next/dynamic ssr:false din aplicatie: WebGL
// nu exista pe server, iar bundle-ul nu trebuie sa atinga restul paginilor.
export const Configurator3dStep = dynamic(() => import('./configurator3d-step'), {
  ssr: false,
  loading: () => (
    <div className="grid h-[320px] w-full place-items-center rounded-xl border border-border-2 bg-surface-2 sm:h-[420px]">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

// Viewerul READ-ONLY al piesei (U4): deschis la cerere din detaliul cererii
// (marketplace firma + client) — overlay cu spinner cat se incarca chunk-ul.
export const PieceViewer3dDialog = dynamic(() => import('./piece-viewer'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm">
      <Loader2 className="h-6 w-6 animate-spin text-white" />
    </div>
  ),
});
