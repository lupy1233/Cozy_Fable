'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Viewerul read-only al camerei 3D atasate cererii (feedback PO r3) — chunk
// separat (three.js), incarcat doar cand cineva chiar deschide camera.
export const RoomViewer3dDialog = dynamic(() => import('./room-viewer'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm">
      <Loader2 className="h-6 w-6 animate-spin text-white" />
    </div>
  ),
});
