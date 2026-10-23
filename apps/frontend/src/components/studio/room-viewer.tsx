'use client';

import { readRequestStudioSceneData, type RequestStudioSceneDto, type StudioPiece, type StudioPlacement } from '@marketplace/shared';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Eye, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useDialogFocus } from '@/hooks/use-dialog-focus';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { FilterChips } from '@/components/ui/filter-chips';
import { PieceViewer3dDialog } from '@/components/configurator/piece3d/dynamic';
import { floorColorOf, wallColorOf } from './palette';
import { ShowroomEnvironment } from '../configurator/piece3d/showroom-environment';
import { RoomCameraRig } from '../configurator/piece3d/stable-orbit-camera';
import { FloorGrid, FLOOR_T, PieceMeshes, WALL_T, Walls } from './room-canvas';
const HouseCanvas = dynamic(() => import('./house-canvas'), { ssr: false });

// Viewerul READ-ONLY al camerei 3D atasate cererii (feedback PO r3): firma
// (marketplace + fisa de lucru) si clientul vad amplasarea exact cum a
// construit-o clientul in Studio — orbita libera, ZERO editare. Click pe o
// piesa deschide viewerul de configuratie existent (U4), cu dimensiunile ei.

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
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

export default function RoomViewer3dDialog(props: { scenes: RequestStudioSceneDto[]; onClose: () => void }) {
  const t = useTranslations('Configurator');
  const studio = useTranslations('Studio');
  const normalized = useMemo(() => {
    try { return props.scenes.map((scene) => ({ ...scene, data: readRequestStudioSceneData(scene.data) })); }
    catch { return null; }
  }, [props.scenes]);
  if (!normalized) return <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}><DialogContent>
    <DialogTitle>{studio('roomViewer.title')}</DialogTitle><DialogDescription>{t('config3d.furniture.invalidSavedConfig')}</DialogDescription>
  </DialogContent></Dialog>;
  return <ValidatedRoomViewer scenes={normalized} onClose={props.onClose} />;
}

function ValidatedRoomViewer({
  scenes,
  onClose,
}: {
  scenes: RequestStudioSceneDto[];
  onClose: () => void;
}) {
  const t = useTranslations('Studio');
  const dialogRef = useDialogFocus(onClose);
  const [webgl] = useState(() => hasWebGl());
  const [index, setIndex] = useState(0);
  const [openPiece, setOpenPiece] = useState<StudioPiece | null>(null);
  const [wholeHouse, setWholeHouse] = useState(() => scenes.some((s) => s.data.house));

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
  const house = scenes.find((s) => s.data.house)?.data.house;
  const allPieces = Object.assign({}, ...scenes.map((s) => s.data.pieces)) as Record<string, StudioPiece>;

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
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
          {house && <button type="button" className="mb-3 min-h-11 rounded-full border border-border-2 px-4 text-sm" aria-pressed={wholeHouse} onClick={() => setWholeHouse((v) => !v)}>{t('house.3d')}</button>}
          {scenes.length > 1 && (
            <FilterChips
              size="sm"
              className="mb-3 items-center gap-1.5"
              label={t('sceneChipsLabel')}
              value={scenes[index]?.id ?? null}
              onChange={(id) => {
                const i = scenes.findIndex((sc) => sc.id === id);
                if (i < 0) return;
                setIndex(i);
                setWholeHouse(false);
              }}
              options={scenes.map((s) => ({ value: s.id, label: <ContactSafeText text={s.name} /> }))}
            />
          )}

          {webgl && wholeHouse && house ? <HouseCanvas house={house} scenes={scenes.map((s) => s.data.scene)} pieces={allPieces} onPiece={setOpenPiece} /> : webgl ? (
            <div className="h-[320px] w-full overflow-hidden rounded-xl border border-border-2 sm:h-[460px]">
              <Canvas
                shadows
                dpr={[1, 1.75]}
                frameloop="demand"
                camera={{ fov: 36, near: 0.05, far: 200 }}
                gl={{ antialias: true }}
              >
                <color attach="background" args={['#f7f3ec']} />
                <ambientLight intensity={0.7} />
                <hemisphereLight args={['#fffaf4', '#b9af9e', 0.5]} />
                <directionalLight
                  position={[6, 9, 5]}
                  intensity={1.8}
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
                <ShowroomEnvironment overview><Walls
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
                })}</ShowroomEnvironment>
                <OrbitControls
                  makeDefault
                  enableDamping={false}
                  enablePan
                  minPolarAngle={0.1}
                  maxPolarAngle={Math.PI / 2 - 0.08}
                />
                <RoomCameraRig w={scene.room.widthM} d={scene.room.depthM} sceneId={scene.id} />
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
