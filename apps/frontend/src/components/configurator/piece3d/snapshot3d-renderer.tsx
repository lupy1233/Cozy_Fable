'use client';

import type { Piece3dKind, PieceConfig3d } from '@marketplace/shared';
import { useEffect, useRef } from 'react';
import { PieceCanvas, type SnapshotFn } from './piece-canvas';

// d4 pas 2: scena piesei desenata ascuns (in afara ecranului) din configuratie, ca Sumarul sa
// poata face imaginea cand ea lipseste sau e mai veche decat configuratia (inclusiv dupa
// modul "Campuri clasice"). Asteapta sa se aseze scena (feroneria GLB, mediul), apoi face
// imaginea; o imagine goala (doar fundalul) sau lipsa functiei de captura = esec (null).

// cat lasam scena sa se incarce inainte de prima incercare
export const RENDER_SETTLE_MS = 1500;
const RETRY_MS = 500;
const MAX_ATTEMPTS = 12;
// un PNG doar cu fundal (640x480) are cativa KB; o piesa desenata are mult peste
const MIN_PNG_DATA_URL_LENGTH = 8000;

export default function Snapshot3dRenderer({
  piece,
  config,
  onDone,
}: {
  piece: Piece3dKind;
  config: PieceConfig3d;
  onDone: (dataUrl: string | null) => void;
}) {
  const snapshot = useRef<SnapshotFn | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = () => {
      attempts += 1;
      const dataUrl = snapshot.current?.() ?? null;
      if (dataUrl && dataUrl.length >= MIN_PNG_DATA_URL_LENGTH) {
        onDoneRef.current(dataUrl);
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        onDoneRef.current(null);
        return;
      }
      timer = setTimeout(attempt, RETRY_MS);
    };
    timer = setTimeout(attempt, RENDER_SETTLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // inert: butoanele scenei (deschide / inchide) nu primesc focus (setat prin ref: atributul
  // nu e in tipurile React 18). m3: la demontare contextul WebGL al scenei se elibereaza pe loc,
  // nu cand trece colectorul (browserul tine putine contexte deodata)
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = box.current;
    node?.setAttribute('inert', '');
    return () => {
      const canvas = node?.querySelector('canvas');
      try {
        const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
        gl?.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // contextul e deja pierdut
      }
    };
  }, []);

  return (
    <div ref={box} aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 h-[480px] w-[640px] overflow-hidden">
      <PieceCanvas
        kind={piece}
        config={config}
        onSnapshotReady={(fn) => {
          snapshot.current = fn;
        }}
        className="h-full w-full"
      />
    </div>
  );
}
