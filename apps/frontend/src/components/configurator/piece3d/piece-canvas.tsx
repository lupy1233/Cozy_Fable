'use client';

import {
  buildPanels,
  buildZoneBoxes,
  type Piece3dKind,
  type PieceConfig3d,
  type Panel3d,
  type ZoneBox3d,
} from '@marketplace/shared';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import { FINISH_SPECS, HIGHLIGHT_COLOR, ROD_COLOR } from './finishes';

// tip minimal pentru controalele de orbita (evitam dependinta de three-stdlib,
// care e doar dependinta tranzitiva a drei si nu e expusa de pnpm)
type ControlsLike = {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
} | null;

// Scena 3D a piesei (R1): carcasa parametrica generata din config, lumini soft,
// orbita limitata (nu vezi sub podea), dpr limitat si frameloop="demand" pentru
// mobil. Componenta DOAR deseneaza panourile — geometria vine din shared.

export type ZoneRef = { col: number; zone: number };

// functie de snapshot expusa parintelui (R4): randeaza un cadru si intoarce PNG
export type SnapshotFn = () => string | null;

interface PieceCanvasProps {
  kind: Piece3dKind;
  config: PieceConfig3d;
  activeZone?: ZoneRef | null;
  onZoneClick?: (zone: ZoneRef) => void;
  onSnapshotReady?: (fn: SnapshotFn) => void;
  className?: string;
}

// Repozitioneaza camera cand se schimba gabaritul (nu si la schimbari de zone).
function CameraRig({ config }: { config: PieceConfig3d }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike;
  const invalidate = useThree((s) => s.invalidate);
  const { widthM, heightM, depthM } = config;

  useEffect(() => {
    const dist = Math.max(widthM, heightM) * 1.35 + depthM + 0.9;
    camera.position.set(dist * 0.68, heightM * 0.7 + 0.35, dist);
    camera.lookAt(0, heightM / 2, 0);
    if (controls) {
      controls.target.set(0, heightM / 2, 0);
      controls.update();
    }
    invalidate();
  }, [camera, controls, invalidate, widthM, heightM, depthM]);
  return null;
}

// Cadru randat la cerere pentru export PNG (nu depinde de preserveDrawingBuffer).
function SnapshotBridge({ onReady }: { onReady?: (fn: SnapshotFn) => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!onReady) return;
    onReady(() => {
      try {
        gl.render(scene, camera);
        return gl.domElement.toDataURL('image/png');
      } catch {
        return null;
      }
    });
  }, [gl, scene, camera, onReady]);
  return null;
}

function PanelMesh({ panel, finish }: { panel: Panel3d; finish: PieceConfig3d['finish'] }) {
  const spec = FINISH_SPECS[finish];
  if (panel.role === 'ROD') {
    return (
      <mesh position={[panel.x, panel.y, panel.z]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.013, 0.013, panel.w, 16]} />
        <meshStandardMaterial color={ROD_COLOR} roughness={0.35} metalness={0.7} />
      </mesh>
    );
  }
  const isFront =
    panel.role === 'DRAWER_FRONT' || panel.role === 'DOOR_FRONT' || panel.role === 'TILT_FRONT';
  return (
    <mesh position={[panel.x, panel.y, panel.z]} castShadow receiveShadow>
      <boxGeometry args={[panel.w, panel.h, panel.d]} />
      <meshStandardMaterial
        color={isFront ? spec.front : spec.body}
        roughness={spec.roughness}
      />
    </mesh>
  );
}

// Hit-target invizibil per zona: hover → tenta, click → schimba tipul (R2).
function ZoneHotspot({
  box,
  active,
  onClick,
}: {
  box: ZoneBox3d;
  active: boolean;
  onClick?: (zone: ZoneRef) => void;
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
    <mesh
      position={[box.x, box.y, box.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.({ col: box.col, zone: box.zone });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[box.w, box.h, box.d]} />
      <meshBasicMaterial
        color={HIGHLIGHT_COLOR}
        transparent
        opacity={active ? 0.28 : hovered ? 0.16 : 0}
        depthWrite={false}
      />
    </mesh>
  );
}

function PieceScene({ kind, config, activeZone, onZoneClick }: PieceCanvasProps) {
  const panels = useMemo(() => buildPanels(config, kind), [config, kind]);
  const zones = useMemo(() => buildZoneBoxes(config, kind), [config, kind]);
  return (
    <group>
      {panels.map((p, i) => (
        <PanelMesh key={i} panel={p} finish={config.finish} />
      ))}
      {onZoneClick &&
        zones.map((b) => (
          <ZoneHotspot
            key={`${b.col}:${b.zone}`}
            box={b}
            active={activeZone?.col === b.col && activeZone?.zone === b.zone}
            onClick={onZoneClick}
          />
        ))}
    </group>
  );
}

export function PieceCanvas(props: PieceCanvasProps) {
  const { config, className, onSnapshotReady } = props;
  // distanta de orbita limitata la gabaritul piesei
  const maxDim = Math.max(config.widthM, config.heightM);
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop="demand"
        camera={{ fov: 32, near: 0.05, far: 60 }}
        gl={{ antialias: true }}
      >
        {/* fundal hartie calda — intra si in snapshotul PNG */}
        <color attach="background" args={['#f7f3ec']} />
        <ambientLight intensity={0.85} />
        <directionalLight
          position={[3.5, 6, 4.5]}
          intensity={1.25}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0002}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={5}
          shadow-camera-bottom={-2}
        />
        <directionalLight position={[-4, 3, -2]} intensity={0.3} />
        <PieceScene {...props} />
        {/* podea discreta care primeste umbra */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial opacity={0.14} />
        </mesh>
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={Math.max(0.8, maxDim * 0.7)}
          maxDistance={maxDim * 3 + 3}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
        <CameraRig config={config} />
        <SnapshotBridge onReady={onSnapshotReady} />
      </Canvas>
    </div>
  );
}
