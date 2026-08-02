'use client';

import { buildPanels, type Panel3d } from '@marketplace/shared';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BufferGeometry, Float32BufferAttribute, Vector3, type Mesh } from 'three';
import {
  finishSpecFor,
  HIGHLIGHT_COLOR,
  ROD_COLOR,
  type FinishSpec,
} from '../configurator/piece3d/finishes';
import { floorColorOf, wallColorOf } from './palette';
import {
  overlappingPlacements,
  placementHalfExtents,
  useStudioStore,
  type StudioPiece,
  type StudioPlacement,
} from '@/stores/studio-store';

// Scena camerei din Studio 3D (stil Sims building): podea cu grila, pereti
// care se ascund cand ajung intre camera si privitor, piesele generate din
// acelasi model parametric ca in configurator (buildPanels). Interactiune:
// click = selectie, drag = mutare cu snap pe grila, piesele suprapuse se
// evidentiaza cu rosu. Randare frameloop="demand", ca in PieceCanvas.

const WALL_T = 0.09;
const FLOOR_T = 0.12;
const BACKDROP_COLOR = '#262019';
const OVERLAP_COLOR = '#c2452d';

type ControlsLike = {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
} | null;

// Panourile unei piese, randate STATIC (fara animatii/hotspot-uri — camera e
// pentru asezat piese, nu pentru deschis usi). Aceleasi conventii de material
// ca PanelMesh din piece-canvas.
function StaticPanel({ panel, spec }: { panel: Panel3d; spec: FinishSpec }) {
  if (panel.role === 'ROD') {
    return (
      <mesh position={[panel.x, panel.y, panel.z]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.013, 0.013, panel.w, 12]} />
        <meshStandardMaterial color={ROD_COLOR} roughness={0.35} metalness={0.7} />
      </mesh>
    );
  }
  if (panel.role === 'LEG') {
    return (
      <mesh position={[panel.x, panel.y, panel.z]} castShadow>
        <cylinderGeometry args={[0.014, 0.01, panel.h, 10]} />
        <meshStandardMaterial color={spec.body} roughness={spec.roughness} />
      </mesh>
    );
  }
  if (panel.role === 'FRONT_BACKDROP') {
    return (
      <mesh position={[panel.x, panel.y, panel.z]}>
        <boxGeometry args={[panel.w, panel.h, panel.d]} />
        <meshStandardMaterial color={BACKDROP_COLOR} roughness={1} />
      </mesh>
    );
  }
  const front =
    panel.role === 'DRAWER_FRONT' ||
    panel.role === 'DOOR_FRONT' ||
    panel.role === 'TILT_FRONT' ||
    panel.role === 'SLIDING_FRONT';
  return (
    <mesh position={[panel.x, panel.y, panel.z]} castShadow receiveShadow>
      <boxGeometry args={[panel.w, panel.h, panel.d]} />
      <meshStandardMaterial color={front ? spec.front : spec.body} roughness={spec.roughness} />
    </mesh>
  );
}

function PieceMeshes({ piece }: { piece: StudioPiece }) {
  const panels = useMemo(() => buildPanels(piece.config, piece.kind), [piece.config, piece.kind]);
  const spec = useMemo(
    () => finishSpecFor(piece.config.finish, piece.config.customColor),
    [piece.config.finish, piece.config.customColor],
  );
  return (
    <group>
      {panels.map((p, i) => (
        <StaticPanel key={i} panel={p} spec={spec} />
      ))}
    </group>
  );
}

interface PlacedPieceProps {
  placement: StudioPlacement;
  piece: StudioPiece;
  selected: boolean;
  overlapping: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>, placement: StudioPlacement) => void;
}

function PlacedPiece({ placement, piece, selected, overlapping, onPointerDown }: PlacedPieceProps) {
  const { hx, hz } = placementHalfExtents(piece.config, placement.rotation);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = 'grab';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);
  return (
    <group
      position={[placement.x, 0, placement.z]}
      onPointerDown={(e) => onPointerDown(e, placement)}
      // fara stopPropagation aici, click-ul ar strapunge piesa pana in podea,
      // iar podeaua ar DESELECTA imediat ce pointerdown-ul a selectat
      onClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <group rotation={[0, (placement.rotation * Math.PI) / 180, 0]}>
        <PieceMeshes piece={piece} />
      </group>
      {/* covorasul de stare de sub piesa: teracota = selectata, rosu = suprapusa */}
      {(selected || overlapping) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <planeGeometry args={[(hx + 0.045) * 2, (hz + 0.045) * 2]} />
          <meshBasicMaterial
            color={overlapping ? OVERLAP_COLOR : HIGHLIGHT_COLOR}
            transparent
            opacity={overlapping ? 0.42 : 0.3}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

// Grila podelei: linii la 0.5m, generate exact pe dimensiunile camerei.
function FloorGrid({ w, d }: { w: number; d: number }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const step = 0.5;
    for (let x = -w / 2 + step; x < w / 2 - 1e-6; x += step) {
      pts.push(x, 0, -d / 2, x, 0, d / 2);
    }
    for (let z = -d / 2 + step; z < d / 2 - 1e-6; z += step) {
      pts.push(-w / 2, 0, z, w / 2, 0, z);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
    return geo;
  }, [w, d]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry} position={[0, 0.002, 0]}>
      <lineBasicMaterial color="#000000" transparent opacity={0.08} />
    </lineSegments>
  );
}

// Peretii camerei: 4 cutii; cei ajunsi intre camera si privitor devin
// invizibili (normala exterioara indreptata spre camera), ca in The Sims.
// Fara handlere de evenimente: peretii ascunsi nu intercepteaza raycast-ul.
function Walls({ w, d, h, color }: { w: number; d: number; h: number; color: string }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const camPos = useRef(new Vector3());
  const walls = useMemo(
    () =>
      [
        { x: 0, z: -d / 2 - WALL_T / 2, nx: 0, nz: -1, len: w + 2 * WALL_T, rot: 0 },
        { x: 0, z: d / 2 + WALL_T / 2, nx: 0, nz: 1, len: w + 2 * WALL_T, rot: 0 },
        { x: -w / 2 - WALL_T / 2, z: 0, nx: -1, nz: 0, len: d, rot: Math.PI / 2 },
        { x: w / 2 + WALL_T / 2, z: 0, nx: 1, nz: 0, len: d, rot: Math.PI / 2 },
      ] as const,
    [w, d],
  );

  useFrame(({ camera }) => {
    camera.getWorldPosition(camPos.current);
    walls.forEach((wall, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const toCam = (camPos.current.x - wall.x) * wall.nx + (camPos.current.z - wall.z) * wall.nz;
      mesh.visible = toCam < 0;
    });
  });

  return (
    <group>
      {walls.map((wall, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          position={[wall.x, h / 2, wall.z]}
          rotation={[0, wall.rot, 0]}
          receiveShadow
        >
          <boxGeometry args={[wall.len, h, WALL_T]} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Repozitioneaza camera cand se schimba gabaritul camerei de joc.
function CameraRig({ w, d }: { w: number; d: number }) {
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
  }, [camera, controls, invalidate, w, d]);
  return null;
}

interface DragState {
  id: string;
  dx: number;
  dz: number;
}

function StudioScene({ onDraggingChange }: { onDraggingChange: (v: boolean) => void }) {
  const room = useStudioStore((s) => s.room);
  const pieces = useStudioStore((s) => s.pieces);
  const placements = useStudioStore((s) => s.placements);
  const selectedId = useStudioStore((s) => s.selectedId);
  const setSelected = useStudioStore((s) => s.setSelected);
  const movePlacement = useStudioStore((s) => s.movePlacement);
  const invalidate = useThree((s) => s.invalidate);

  const [dragging, setDragging] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const overlapping = useMemo(
    () => overlappingPlacements(placements, pieces),
    [placements, pieces],
  );

  // orice schimbare de continut cere un cadru nou (frameloop demand)
  useEffect(() => {
    invalidate();
  }, [room, pieces, placements, selectedId, dragging, invalidate]);

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(null);
    onDraggingChange(false);
    document.body.style.cursor = '';
  };
  // pointerup poate cadea in afara canvasului — inchidem dragul global
  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('pointerup', endDrag);
    return () => window.removeEventListener('pointerup', endDrag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const onPiecePointerDown = (e: ThreeEvent<PointerEvent>, placement: StudioPlacement) => {
    // doar butonul principal / atingerea trage piese (dreapta ramane orbitei)
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    setSelected(placement.id);
    const state: DragState = {
      id: placement.id,
      dx: placement.x - e.point.x,
      dz: placement.z - e.point.z,
    };
    dragRef.current = state;
    setDragging(state);
    onDraggingChange(true);
    document.body.style.cursor = 'grabbing';
  };

  const onDragMove = (e: ThreeEvent<PointerEvent>) => {
    const drag = dragRef.current;
    if (!drag) return;
    movePlacement(drag.id, e.point.x + drag.dx, e.point.z + drag.dz);
  };

  return (
    <group>
      {/* podeaua cu grosime (soclul camerei); click scurt = deselectare —
          e.delta filtreaza orbita camerei (gestul lung nu deselecteaza) */}
      <mesh
        position={[0, -FLOOR_T / 2, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta <= 4) setSelected(null);
        }}
      >
        <boxGeometry args={[room.widthM + 2 * WALL_T, FLOOR_T, room.depthM + 2 * WALL_T]} />
        <meshStandardMaterial color={floorColorOf(room.floorColor)} roughness={0.85} />
      </mesh>
      <FloorGrid w={room.widthM} d={room.depthM} />
      <Walls
        w={room.widthM}
        d={room.depthM}
        h={room.wallHeightM}
        color={wallColorOf(room.wallColor)}
      />

      {/* planul de drag: MEREU montat (mutarea porneste chiar din pointerdown,
          inainte ca React sa apuce sa redeseneze), dar activ doar cat exista
          un drag in curs; opacitate 0 (visible:false ar scoate mesh-ul din
          raycast) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
      >
        <planeGeometry args={[80, 80]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {placements.map((p) => {
        const piece = pieces[p.pieceId];
        if (!piece) return null;
        return (
          <PlacedPiece
            key={p.id}
            placement={p}
            piece={piece}
            selected={p.id === selectedId}
            overlapping={overlapping.has(p.id)}
            onPointerDown={onPiecePointerDown}
          />
        );
      })}
    </group>
  );
}

export default function RoomCanvas({ className }: { className?: string }) {
  const room = useStudioStore((s) => s.room);
  const maxDim = Math.max(room.widthM, room.depthM);
  // cat timp se trage o piesa, orbita camerei sta pe loc (OrbitControls
  // asculta direct pe elementul canvas — stopPropagation din scena nu ajunge)
  const [dragging, setDragging] = useState(false);
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop="demand"
        camera={{ fov: 36, near: 0.05, far: 120 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#f7f3ec']} />
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[6, 9, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0003}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={8}
          shadow-camera-bottom={-7}
        />
        <directionalLight position={[-5, 5, -4]} intensity={0.35} />
        <StudioScene onDraggingChange={setDragging} />
        <OrbitControls
          makeDefault
          enabled={!dragging}
          enablePan
          minDistance={1.6}
          maxDistance={maxDim * 3 + 6}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2 - 0.08}
        />
        <CameraRig w={room.widthM} d={room.depthM} />
      </Canvas>
    </div>
  );
}
