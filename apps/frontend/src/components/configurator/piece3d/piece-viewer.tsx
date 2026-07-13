'use client';

import {
  resolvePieceLayout,
  type Piece3dKind,
  type PieceConfig3d,
} from '@marketplace/shared';
import { Eye, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { config3dChips } from './config-chips';
import { PieceCanvas, slideKey, zoneKey, type ZoneRef } from './piece-canvas';

// Viewer 3D READ-ONLY (U4, PO r4): firma deschide piesa exact cum a configurat-o
// clientul — roteste modelul, da click pe zone ca sa deschida usile/sertarele
// si citeste dimensiunile fiecarei zone. Nicio posibilitate de editare:
// singura stare locala e selectia si fronturile deschise, configul nu se atinge.

const cm = (v: number) => Math.round(v * 100);

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function PieceViewer3dDialog({
  piece,
  config,
  onClose,
}: {
  piece: Piece3dKind;
  config: PieceConfig3d;
  onClose: () => void;
}) {
  const t = useTranslations('Configurator');
  const [webgl] = useState(() => hasWebGl());
  const [activeZone, setActiveZone] = useState<ZoneRef | null>(null);
  // fronturile deschise in scena ("col:zone" / "slide:col"), ca in configurator
  const [openZones, setOpenZones] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // pagina din spate nu deruleaza cat e viewerul deschis
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const layout = useMemo(() => resolvePieceLayout(piece, config), [piece, config]);
  const sliding = config.doorMode === 'SLIDING';

  const zone = activeZone ? config.columns[activeZone.col]?.zones[activeZone.zone] : null;
  const resolved = activeZone ? layout[activeZone.col]?.zones[activeZone.zone] : null;
  const colWidth = activeZone ? layout[activeZone.col]?.width : null;

  // aceeasi interactiune de deschidere ca in configurator (fara editare):
  // click selecteaza zona; usile/sertarele se deschid si se inchid
  const onZoneClick = (ref: ZoneRef) => {
    setActiveZone(ref);
    const clicked = config.columns[ref.col]?.zones[ref.zone];
    if (sliding) {
      setOpenZones((prev) => {
        const door = slideKey(ref.col);
        const next = new Set(prev);
        if (!next.has(door)) {
          next.add(door);
        } else if (clicked?.type === 'DRAWERS') {
          const key = zoneKey(ref.col, ref.zone);
          if (next.has(key)) next.delete(key);
          else next.add(key);
        } else {
          next.delete(door);
          for (const key of [...next]) {
            if (key.startsWith(`${ref.col}:`)) next.delete(key);
          }
        }
        return next;
      });
      return;
    }
    if (clicked && (clicked.type === 'DOOR' || clicked.type === 'DRAWERS' || clicked.type === 'TILT_OUT')) {
      setOpenZones((prev) => {
        const key = zoneKey(ref.col, ref.zone);
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }
  };

  // detaliile zonei selectate: tip + interior (cu numar) + dimensiunile rezolvate
  const zoneFacts: { label: string; value: string }[] = [];
  if (zone && resolved) {
    zoneFacts.push({
      label: t('config3d.zoneTypeLabel'),
      value: t(`config3d.zoneTypes.${zone.type}`),
    });
    if (zone.type === 'DRAWERS') {
      zoneFacts.push({ label: t('config3d.countLabel'), value: String(zone.count ?? 1) });
    } else {
      const fill = zone.fill ?? undefined;
      zoneFacts.push({
        label: t('config3d.fillLabel'),
        value: fill
          ? `${t(`config3d.fills.${fill}`)} × ${zone.count ?? 1}`
          : t('config3d.fills.NONE'),
      });
    }
    zoneFacts.push({ label: t('config3d.rowHeight'), value: `${cm(resolved.height)} cm` });
    if (colWidth != null) {
      zoneFacts.push({ label: t('config3d.columnWidth'), value: `${cm(colWidth)} cm` });
    }
    zoneFacts.push({ label: t('config3d.depth'), value: `${cm(config.depthM)} cm` });
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('config3d.viewer.title')}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate font-serif text-lg leading-tight">
              {t('config3d.viewer.title')}
            </h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              {t('config3d.viewer.readOnly')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('config3d.viewer.close')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-walnut-soft hover:text-walnut"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {webgl ? (
            <div className="grid items-start gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="overflow-hidden rounded-xl border border-border-2">
                <PieceCanvas
                  kind={piece}
                  config={config}
                  activeZone={activeZone}
                  openZones={openZones}
                  onZoneClick={onZoneClick}
                  className="h-[300px] w-full sm:h-[420px]"
                />
              </div>
              <div className="flex flex-col gap-3">
                {/* zona selectata: dimensiunile citibile, fara niciun control */}
                {zone && resolved && activeZone ? (
                  <div className="flex flex-col gap-1.5 rounded-xl border border-walnut/40 bg-walnut-soft/60 p-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-walnut">
                      {t('config3d.zoneToolbarTitle', {
                        column: activeZone.col + 1,
                        zone: activeZone.zone + 1,
                      })}
                    </span>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      {zoneFacts.map((f) => (
                        <div key={f.label} className="contents">
                          <dt className="text-xs leading-6 text-muted-foreground">{f.label}</dt>
                          <dd className="text-right font-medium tabular-nums">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border-2 bg-surface-2/50 p-3 text-xs leading-relaxed text-muted-foreground">
                    {t('config3d.viewer.hint')}
                  </div>
                )}
                <div className="flex flex-wrap content-start gap-1.5">
                  {config3dChips(t, config).map((chip, i) => (
                    <span
                      key={i}
                      className="inline-flex items-baseline rounded-full border border-border-2 bg-surface-2 px-2.5 py-1 text-xs font-medium"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">{t('config3d.viewer.webglMissing')}</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
