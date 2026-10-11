'use client';

import { HOUSE_WALL_THICKNESS, houseRoomBounds, houseLayoutErrors, houseWallPoint, openingSize, syncHouseRooms, resolveHouseRoomPlacement, type HouseTransform, type StudioWall } from '@marketplace/shared';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudioStore } from '@/stores/studio-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ChevronDown, ChevronUp, House } from 'lucide-react';
import { cn } from '@/lib/utils';
const HouseCanvas = dynamic(() => import('./house-canvas'), { ssr: false });
type RoomDrag = { id: string; transform: HouseTransform; snapped: boolean; blocked: boolean };

function MeterInput({ label, value, change }: { label: string; value: number; change: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className="grid gap-1 text-xs font-medium">{label}<Input type="number" step="0.01" value={draft ?? value}
    onChange={(e) => setDraft(e.target.value)} onBlur={() => { if (draft?.trim() && Number.isFinite(Number(draft))) change(Number(draft)); setDraft(null); }}
    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(null); }} /></label>;
}

export function HouseEditor({ toolsHidden = false, cutaway = false }: { toolsHidden?: boolean; cutaway?: boolean }) {
  const t = useTranslations('Studio');
  const scenes = useStudioStore((s) => s.scenes), pieces = useStudioStore((s) => s.pieces), rawHouse = useStudioStore((s) => s.house);
  const activeId = useStudioStore((s) => s.activeSceneId);
  const house = useMemo(() => rawHouse ? syncHouseRooms(rawHouse, scenes) : undefined, [rawHouse, scenes]);
  const [view, setView] = useState<'plan' | '3d'>('plan');
  const [hasViewed3d, setHasViewed3d] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [target, setTarget] = useState(''), [wall, setWall] = useState<StudioWall>('E'), [error, setError] = useState(false);
  const [drag, setDrag] = useState<RoomDrag | null>(null);
  const dragRef = useRef<RoomDrag | null>(null);
  const start = useRef<{ id: string; pointerId: number; clientX: number; clientY: number; x: number; z: number; transform: HouseTransform } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [webgl, setWebgl] = useState(false);
  useEffect(() => { try { const c = document.createElement('canvas'); const context = c.getContext('webgl2'); setWebgl(Boolean(context)); context?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { setWebgl(false); } }, []);
  const preview = house && drag ? { ...house, roomTransforms: { ...house.roomTransforms, [drag.id]: drag.transform } } : house;
  const active = scenes.find((s) => s.id === activeId)!, transform = house?.roomTransforms[activeId];
  const bounds = house ? scenes.map((s) => houseRoomBounds(s, house.roomTransforms[s.id])) : [];
  const left = Math.min(0, ...bounds.map((b) => b.left)) - 1, right = Math.max(4, ...bounds.map((b) => b.right)) + 1;
  const top = Math.min(-3, ...bounds.map((b) => b.top)) - 1, bottom = Math.max(3, ...bounds.map((b) => b.bottom)) + 1;
  const move = (patch: Partial<HouseTransform>) => { const s = useStudioStore.getState(); s.recordHistory(); s.moveHouseRoom(activeId, patch); };
  const point = (x: number, y: number) => { const matrix = svg.current?.getScreenCTM(); if (!matrix) return { x: 0, z: 0 }; const p = new DOMPoint(x, y).matrixTransform(matrix.inverse()); return { x: p.x, z: p.y }; };
  const cancelDrag = () => { dragRef.current = null; start.current = null; setDrag(null); };
  useEffect(() => { dragRef.current = null; start.current = null; setDrag(null); }, [rawHouse, scenes, view]);
  const pairedOpenings = new Set(house?.connections.map((connection) => `${connection.sceneB}:${connection.openingB}`));
  return <section className="relative h-full w-full overflow-hidden bg-surface-2" aria-label={t('house.title')}>
    {!house && <div className="absolute inset-0 grid place-items-center p-6">
      <div className="max-w-sm space-y-3 rounded-2xl border border-border-2 bg-surface/95 p-5 text-center shadow-lg">
        <House aria-hidden="true" className="mx-auto h-7 w-7 text-walnut" />
        <h2 className="font-serif text-xl">{t('house.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('house.subtitle')}</p>
        <Button className="min-h-11" onClick={() => useStudioStore.getState().enableHouse()}>{t('house.enable')}</Button>
      </div>
    </div>}
    {house && preview && transform && <>
      {hasViewed3d && webgl && <div className={cn('absolute inset-0', view !== '3d' && 'invisible pointer-events-none')} aria-hidden={view !== '3d'} inert={view !== '3d'}>
        <HouseCanvas house={house} scenes={scenes} pieces={pieces} cutaway={cutaway} className="h-full rounded-none border-0 sm:h-full" />
      </div>}
      <svg ref={svg} role="group" aria-label={t('house.plan')}
        viewBox={`${left} ${top} ${right - left} ${bottom - top}`} className={cn('absolute inset-0 h-full w-full touch-none select-none bg-surface-2', view !== 'plan' && 'hidden')}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s || s.pointerId !== e.pointerId || (!dragRef.current && Math.hypot(e.clientX - s.clientX, e.clientY - s.clientY) < 3)) return;
          const scene = scenes.find((room) => room.id === s.id);
          if (!scene) return;
          const p = point(e.clientX, e.clientY);
          const result = resolveHouseRoomPlacement(scene, { ...s.transform, x: s.transform.x + p.x - s.x, z: s.transform.z + p.z - s.z }, house, scenes);
          const next = { id: s.id, transform: result.transform ?? dragRef.current?.transform ?? s.transform, snapped: Boolean(result.transform && result.snapped), blocked: !result.transform };
          dragRef.current = next;
          setDrag(next);
        }}
        onPointerUp={(e) => {
          if (start.current?.pointerId !== e.pointerId) return;
          const final = dragRef.current;
          if (final) { const s = useStudioStore.getState(); s.recordHistory(); s.moveHouseRoom(final.id, final.transform, false); }
          cancelDrag();
        }}
        onPointerCancel={(e) => { if (start.current?.pointerId === e.pointerId) cancelDrag(); }}
        onLostPointerCapture={(e) => { if (start.current?.pointerId === e.pointerId) cancelDrag(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') cancelDrag(); }}>
        {scenes.map((scene) => { const b = houseRoomBounds(scene, preview.roomTransforms[scene.id]); return <g key={scene.id} role="button" tabIndex={0} aria-label={scene.name} aria-pressed={scene.id === activeId} className="group/house-room focus:outline-none focus-visible:outline-none"
          onPointerDown={(e) => { if (e.button !== 0 || !e.isPrimary || start.current) return; e.preventDefault(); e.currentTarget.focus({ preventScroll: true }); e.currentTarget.setPointerCapture(e.pointerId); useStudioStore.getState().setActiveScene(scene.id); const p = point(e.clientX, e.clientY); dragRef.current = null; start.current = { id: scene.id, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, ...p, transform: house.roomTransforms[scene.id] }; }}
          onKeyDown={(e) => { const s = useStudioStore.getState(); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.setActiveScene(scene.id); return; } const delta = e.shiftKey ? 0.5 : 0.1;
            const d = e.key === 'ArrowLeft' ? { x: -delta, z: 0 } : e.key === 'ArrowRight' ? { x: delta, z: 0 } : e.key === 'ArrowUp' ? { x: 0, z: -delta } : e.key === 'ArrowDown' ? { x: 0, z: delta } : null;
            if (d) { e.preventDefault(); s.recordHistory(); const tr = house.roomTransforms[scene.id]; s.moveHouseRoom(scene.id, { x: tr.x + d.x, z: tr.z + d.z }, false); } }}>
          <rect data-house-room={scene.id} data-drag-blocked={drag?.id === scene.id && drag.blocked ? 'true' : undefined} x={b.left} y={b.top} width={b.w} height={b.d} fill={drag?.id === scene.id && drag.blocked ? '#efd6d1' : scene.id === activeId ? '#e0d0b8' : '#eee6da'} />
          <text x={b.x} y={b.z} textAnchor="middle" fontSize={Math.min(0.3, b.w / 10)} fill="#433a31">{scene.name}</text>
          <text x={b.x} y={b.z + 0.35} textAnchor="middle" fontSize={0.22} fill="#75695a">{scene.room.widthM} × {scene.room.depthM} m</text>
          <rect x={b.left + 0.04} y={b.top + 0.04} width={b.w - 0.08} height={b.d - 0.08} fill="none" stroke="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className="group-focus-visible/house-room:stroke-walnut" pointerEvents="none" />
        </g>; })}
        {scenes.map((scene) => { const b = houseRoomBounds(scene, preview.roomTransforms[scene.id]); return <rect key={`wall-${scene.id}`} x={b.left - HOUSE_WALL_THICKNESS / 2} y={b.top - HOUSE_WALL_THICKNESS / 2} width={b.w + HOUSE_WALL_THICKNESS} height={b.d + HOUSE_WALL_THICKNESS} fill="none" stroke="#76573d" strokeWidth={HOUSE_WALL_THICKNESS} pointerEvents="none" />; })}
        {drag?.snapped && (() => {
          const scene = scenes.find((room) => room.id === drag.id)!;
          const b = houseRoomBounds(scene, drag.transform), halfWall = HOUSE_WALL_THICKNESS / 2;
          return <g pointerEvents="none" aria-label={t('house.snapped')}>
            <rect x={b.left - halfWall} y={b.top - halfWall} width={b.w + HOUSE_WALL_THICKNESS} height={b.d + HOUSE_WALL_THICKNESS} fill="none" stroke="#3e7660" strokeWidth={0.045} />
            {[b.left - halfWall, b.right + halfWall].flatMap((x) => [b.top - halfWall, b.bottom + halfWall].map((z) => <circle key={`${x}:${z}`} data-house-snap-point cx={x} cy={z} r={0.075} fill="#f7f3ec" stroke="#3e7660" strokeWidth={0.035} />))}
          </g>;
        })()}
        {scenes.flatMap((scene) => scene.openings.filter((opening) => !pairedOpenings.has(`${scene.id}:${opening.id}`)).map((opening) => {
          const size = openingSize(opening);
          const p = houseWallPoint(scene, preview.roomTransforms[scene.id], opening.wall, opening.offset);
          const end = houseWallPoint(scene, preview.roomTransforms[scene.id], opening.wall, opening.offset + size.w / 2);
          const angle = Math.atan2(end.z - p.z, end.x - p.x) * 180 / Math.PI;
          const isWindow = opening.kind === 'WINDOW' || opening.kind === 'WINDOW_WIDE';
          return <g key={`${scene.id}:${opening.id}`} role="img" aria-label={`${scene.name}: ${t(`openings.${opening.kind}`)}`} data-testid="house-plan-opening" data-opening-id={opening.id} transform={`translate(${p.x} ${p.z}) rotate(${angle})`} pointerEvents="none">
            <title>{scene.name}: {t(`openings.${opening.kind}`)} · {size.w} m</title>
            {size.cutout ? <>
              <rect x={-size.w / 2} y={-HOUSE_WALL_THICKNESS / 2 - 0.012} width={size.w} height={HOUSE_WALL_THICKNESS + 0.024} fill="#f7f3ec" />
              <path d={`M ${-size.w / 2} ${-HOUSE_WALL_THICKNESS / 2} v ${HOUSE_WALL_THICKNESS} M ${size.w / 2} ${-HOUSE_WALL_THICKNESS / 2} v ${HOUSE_WALL_THICKNESS}`} stroke="#76573d" strokeWidth={0.035} />
              {isWindow ? <path d={`M ${-size.w / 2} -0.024 H ${size.w / 2} M ${-size.w / 2} 0.024 H ${size.w / 2}`} stroke="#54859a" strokeWidth={0.022} /> : <line x1={-size.w / 2} x2={size.w / 2} stroke="#ad845c" strokeWidth={0.035} />}
            </> : <rect x={-size.w / 2} y={-0.06} width={size.w} height={0.12} rx={0.015} fill="#faf7ef" stroke="#76573d" strokeWidth={0.022} />}
          </g>;
        }))}
      </svg>
      <p role="status" aria-live="polite" className={cn('pointer-events-none absolute bottom-24 left-1/2 z-10 max-w-[80%] -translate-x-1/2 rounded-lg bg-surface/95 px-3 py-2 text-center text-sm shadow-sm md:bottom-auto md:top-16', !drag?.blocked && !drag?.snapped && 'sr-only')}>
        {drag?.blocked ? t('house.moveBlocked') : drag?.snapped ? t('house.snapped') : ''}
      </p>
      <div className={cn('absolute left-3 top-20 z-10 flex max-w-[calc(100%-1.5rem)] gap-1 rounded-xl border border-border-2 bg-surface/95 p-1 shadow-md backdrop-blur sm:left-4', toolsHidden && 'hidden')}>
        {(['plan', '3d'] as const).map((v) => <button type="button" key={v} disabled={v === '3d' && !webgl} aria-pressed={view === v}
          onClick={() => { setView(v); if (v === '3d') setHasViewed3d(true); }} className="min-h-10 rounded-lg px-3 text-xs font-medium transition-colors hover:bg-secondary aria-pressed:bg-walnut aria-pressed:text-white disabled:opacity-50 sm:text-sm">{t(`house.${v}`)}</button>)}
      </div>
      <aside aria-label={t('workspace.houseSettings')} className={cn('absolute right-3 top-36 z-10 flex max-h-[calc(100%-14rem)] w-[320px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border-2 bg-surface/95 shadow-lg backdrop-blur sm:right-4 md:top-20 md:max-h-[calc(100%-10rem)]', toolsHidden && 'hidden')}>
        <h2 aria-label={t('house.title')} className="shrink-0"><button type="button" aria-label={t(toolsOpen ? 'workspace.minimizeHouseTools' : 'workspace.expandHouseTools')} aria-expanded={toolsOpen} aria-controls="studio-house-tools" onClick={() => setToolsOpen((open) => !open)} className="flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-secondary/70">
          <House aria-hidden="true" className="h-4 w-4 shrink-0 text-walnut" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t('house.title')}</span>
          {toolsOpen ? <ChevronUp aria-hidden="true" className="h-4 w-4" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
        </button></h2>
        <div id="studio-house-tools" className={cn('space-y-4 overflow-y-auto overscroll-contain border-t border-border-2 p-4', !toolsOpen && 'hidden')}>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('house.moveHint')}</p>
      <div key={activeId} className="grid grid-cols-2 gap-3">
        <MeterInput label={t('house.positionX')} value={transform.x} change={(x) => move({ x })} />
        <MeterInput label={t('house.positionZ')} value={transform.z} change={(z) => move({ z })} />
        <MeterInput label={t('house.roomWidth')} value={active.room.widthM} change={(widthM) => { const s = useStudioStore.getState(); s.recordHistory(); s.setRoom({ widthM }); }} />
        <MeterInput label={t('house.roomDepth')} value={active.room.depthM} change={(depthM) => { const s = useStudioStore.getState(); s.recordHistory(); s.setRoom({ depthM }); }} />
        <Button variant="outline" className="col-span-2 min-h-11" onClick={() => move({ rotation: ((transform.rotation + 90) % 360) as HouseTransform['rotation'] })}>{t('house.rotate')}</Button>
      </div>
      <div className="grid items-end gap-3">
        <label className="grid gap-1 text-xs">{t('house.connectTarget')}<Select className="min-h-11" value={target === activeId ? '' : target} onChange={(e) => setTarget(e.target.value)}><option value="">{t('house.chooseRoom')}</option>{scenes.filter((s) => s.id !== activeId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></label>
        <label className="grid gap-1 text-xs">{t('house.connectWall')}<Select className="min-h-11" value={wall} onChange={(e) => setWall(e.target.value as StudioWall)}>{(['N', 'E', 'S', 'W'] as const).map((v) => <option key={v} value={v}>{t(`house.walls.${v}`)}</option>)}</Select></label>
        <Button className="min-h-11" disabled={!target || target === activeId} onClick={() => setError(!useStudioStore.getState().connectRooms(activeId, target, wall))}>{t('house.connect')}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('house.connectHint')}</p>
      {error && <p role="alert" className="text-sm text-crimson">{t('house.connectError')}</p>}
      {houseLayoutErrors(house, scenes).length > 0 && <p role="alert" className="text-sm text-crimson">{t('house.invalidLayout')}</p>}
      {house.connections.length > 0 && <ul className="space-y-3">{house.connections.map((c) => <li key={c.id} className="grid grid-cols-2 items-end gap-3 rounded-xl border border-border-2 p-3 text-sm">
        <span className="col-span-2 break-words font-medium">{scenes.find((s) => s.id === c.sceneA)?.name} ↔ {scenes.find((s) => s.id === c.sceneB)?.name}</span>
        <MeterInput label={t('house.doorWidth')} value={scenes.find((s) => s.id === c.sceneA)?.openings.find((o) => o.id === c.openingA)?.w ?? 0.9}
          change={(w) => { const s = useStudioStore.getState(); s.recordHistory(); setError(!s.resizeOpening(c.openingA, { w })); }} />
        <MeterInput label={t('house.doorOffset')} value={scenes.find((s) => s.id === c.sceneA)?.openings.find((o) => o.id === c.openingA)?.offset ?? 0}
          change={(offset) => { const s = useStudioStore.getState(); s.recordHistory(); s.moveOpening(c.openingA, offset); }} />
        <Button className="col-span-2 min-h-11" variant="outline" onClick={() => useStudioStore.getState().disconnectRooms(c.id)}>{t('house.disconnect')}</Button>
      </li>)}</ul>}
      <p className="text-xs text-muted-foreground">{t('house.capacity', { rooms: scenes.length, pieces: scenes.reduce((n, s) => n + s.placements.length, 0) })}</p>
        </div>
      </aside>
    </>}
  </section>;
}
