'use client';

import type { RequestStudioSceneDto, StudioPiece, StudioPlacement } from '@marketplace/shared';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Eye, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PieceViewer3dDialog } from '@/components/configurator/piece3d/dynamic';
import { floorColorOf, wallColorOf } from './palette';
import { FloorGrid, FLOOR_T, PieceMeshes, WALL_T, Walls } from './room-canvas';

// Viewerul READ-ONLY al camerei 3D atasate cererii (feedback PO r3): firma
// (marketplace + fisa de lucru) si clientul vad amplasarea exact cum a
// construit-o clientul in Studio — orbita libera, ZERO editare. Click pe o
// piesa deschide viewerul de configuratie existent (U4), cu dimensiunile ei.

type ControlsLike = {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
} | null;

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function CameraRig({ w, d, sceneId }: { w: number; d: number; sceneId: string }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const dist = Math.max(w, d) * 1.05 + 1.4;
    camera.position.set(dist * 0.8, dist * 0.75, dist);
    camera.lookAt(0, 0.5, 0);
    if (controls) {
      controls.target.set(0, 0.5, 0);
      controls.update();
    }
    invalidate();
  }, [camera, controls, invalidate, w, d, sceneId]);
  return null;
}

// Piesa din camera, clicabila: click scurt → configuratia ei (viewerul U4).
function ViewerPiece({
  placement,
  piece,
  onOpen,
}: {
  placement: StudioPlacement;
  piece: StudioPiece;
  onOpen: (piece: StudioPiece) => void;
}) {
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);
  return (
    <group
      position={[placement.x, 0, placement.z]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta <= 5) onOpen(piece);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <group rotation={[0, (placement.rotation * Math.PI) / 180, 0]}>
        <PieceMeshes piece={piece} />
      </group>
    </group>
  );
}

export default function RoomViewer3dDialog({
  scenes,
  onClose,
}: {
  scenes: RequestStudioSceneDto[];
  onClose: () => void;
}) {
  const t = useTranslations('Studio');
  const [webgl] = useState(() => hasWebGl());
  const [index, setIndex] = useState(0);
  const [openPiece, setOpenPiece] = useState<StudioPiece | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const entry = scenes[Math.min(index, scenes.length - 1)];
  if (!entry) return null;
  const { scene, pieces } = entry.data;
  const maxDim = Math.max(scene.room.widthM, scene.room.depthM);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('roomViewer.title')}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate font-serif text-lg leading-tight">{t('roomViewer.title')}</h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              {t('roomViewer.readOnly')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-walnut-soft hover:text-walnut"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          {scenes.length > 1 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {scenes.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={
                    i === index
                      ? 'rounded-full bg-walnut px-3 py-1 text-xs font-medium text-primary-foreground'
                      : 'rounded-full border border-border-2 bg-surface px-3 py-1 text-xs text-muted-foreground hover:text-foreground'
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {webgl ? (
            <div className="h-[320px] w-full overflow-hidden rounded-xl border border-border-2 sm:h-[460px]">
              <Canvas
                shadows
                dpr={[1, 1.75]}
                frameloop="demand"
                camera={{ fov: 36, near: 0.05, far: 200 }}
                gl={{ antialias: true }}
              >
                <color attach="background" args={['#f7f3ec']} />
                <ambientLight intensity={0.8} />
                <directionalLight
                  position={[6, 9, 5]}
                  intensity={1.2}
                  castShadow
                  shadow-mapSize={[1024, 1024]}
                  shadow-bias={-0.0003}
                  shadow-camera-left={-7}
                  shadow-camera-right={7}
                  shadow-camera-top={8}
                  shadow-camera-bottom={-7}
                />
                <directionalLight position={[-5, 5, -4]} intensity={0.35} />
                <mesh position={[0, -FLOOR_T / 2, 0]} receiveShadow>
                  <boxGeometry
                    args={[scene.room.widthM + 2 * WALL_T, FLOOR_T, scene.room.depthM + 2 * WALL_T]}
                  />
                  <meshStandardMaterial color={floorColorOf(scene.room.floorColor)} roughness={0.85} />
                </mesh>
                <FloorGrid w={scene.room.widthM} d={scene.room.depthM} />
                <Walls
                  room={scene.room}
                  openings={scene.openings}
                  color={wallColorOf(scene.room.wallColor)}
                />
                {scene.placements.map((p) => {
                  const piece = pieces[p.pieceId];
                  if (!piece) return null;
                  return (
                    <ViewerPiece key={p.id} placement={p} piece={piece} onOpen={setOpenPiece} />
                  );
                })}
                <OrbitControls
                  makeDefault
                  enablePan
                  minDistance={1.6}
                  maxDistance={maxDim * 3 + 6}
                  minPolarAngle={0.1}
                  maxPolarAngle={Math.PI / 2 - 0.08}
                />
                <CameraRig w={scene.room.widthM} d={scene.room.depthM} sceneId={scene.id} />
              </Canvas>
            </div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">{t('roomViewer.webglMissing')}</p>
          )}

          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {t('roomViewer.hint')}
          </p>
        </div>
      </div>

      {/* click pe piesa → viewerul de configuratie existent, peste camera */}
      {openPiece && (
        <PieceViewer3dDialog
          piece={openPiece.kind}
          config={openPiece.config}
          onClose={() => setOpenPiece(null)}
        />
      )}
    </div>,
    document.body,
  );
}
