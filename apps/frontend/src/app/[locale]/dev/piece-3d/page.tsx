'use client';

import { PIECE3D_KINDS, type Piece3dKind, type PieceConfig3d } from '@marketplace/shared';
import { notFound } from 'next/navigation';
import { useState } from 'react';
import { Configurator3dStep, PieceViewer3dDialog } from '@/components/configurator/piece3d/dynamic';

// Pagina de lucru pentru iterat vizual pe configuratorul 3D (docs/10 R1).
// DOAR in dev — in productie intoarce 404.
export default function Piece3dDevPage() {
  const [kind, setKind] = useState<Piece3dKind>('BOOKCASE');
  const [configs, setConfigs] = useState<Partial<Record<Piece3dKind, PieceConfig3d>>>({});
  const [snapshot, setSnapshot] = useState<string | null>(null);
  // viewerul read-only (U4) pe configul curent — pentru QA vizual fara cerere reala
  const [viewer, setViewer] = useState(false);

  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
      <h1 className="font-serif text-2xl">Configurator 3D — pagina de dev</h1>
      <div className="flex flex-wrap gap-1.5">
        {PIECE3D_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              'rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors ' +
              (k === kind
                ? 'border-walnut bg-walnut-soft text-walnut'
                : 'border-border-2 text-muted-foreground hover:border-muted-2')
            }
          >
            {k}
          </button>
        ))}
      </div>
      <Configurator3dStep
        key={kind}
        piece={kind}
        value={configs[kind]}
        onChange={(config) => setConfigs((prev) => ({ ...prev, [kind]: config }))}
        onSnapshot={(dataUrl) => {
          setSnapshot(dataUrl);
          // expus pentru QA programatic (doar dev)
          (window as unknown as Record<string, unknown>).__piece3dSnapshot = dataUrl;
        }}
      />
      {configs[kind] && (
        <button
          type="button"
          onClick={() => setViewer(true)}
          className="self-start rounded-full border border-walnut/40 bg-walnut-soft/60 px-3 py-1.5 text-xs font-medium text-walnut"
        >
          Deschide viewerul read-only (U4)
        </button>
      )}
      {viewer && configs[kind] && (
        <PieceViewer3dDialog piece={kind} config={configs[kind]!} onClose={() => setViewer(false)} />
      )}
      {snapshot && (
        <figure className="flex flex-col gap-1">
          <figcaption className="text-xs text-muted-foreground">Snapshot PNG (R4):</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={snapshot} alt="snapshot" className="w-64 rounded-lg border border-border-2" />
        </figure>
      )}
      <pre className="overflow-x-auto rounded-lg border border-border-2 bg-surface-2 p-3 text-[11px] leading-relaxed">
        {JSON.stringify(configs[kind], null, 2)}
      </pre>
    </main>
  );
}
