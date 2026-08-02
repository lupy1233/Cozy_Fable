'use client';

import { buildPanels, type Panel3d } from '@marketplace/shared';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BufferGeometry, Float32BufferAttribute, Vector3, type Group } from 'three';
import type { Camera } from 'three';
import {
  finishSpecFor,
  HIGHLIGHT_COLOR,
  ROD_COLOR,
  type FinishSpec,
} from '../configurator/piece3d/finishes';
import { floorColorOf, wallColorOf } from './palette';
import {
  openingSize,
  overlappingPlacements,
  placementHalfExtents,
  useActiveScene,
  useStudioStore,
  type StudioOpening,
  type StudioPiece,
  type StudioPlacement,
  type StudioRoom,
  type StudioWall,
} from '@/stores/studio-store';

// Scena camerei din Studio 3D (stil Sims building): podea cu grila, pereti
// care se ascund cand ajung intre camera si privitor, usi si ferestre taiate
// in pereti (segmente + toc + foaie/geam), piesele generate din acelasi model
// parametric ca in configurator (buildPanels). Interactiune: click = selectie,
// drag = mutare (piesele pe podea, golurile de-a lungul peretelui lor), totul
// cu snap de 1cm. Randare frameloop="demand", ca in PieceCanvas.

// exportate si pentru viewerul read-only al cererii (room-viewer.tsx)
export const WALL_T = 0.09;
export const FLOOR_T = 0.12;
const BACKDROP_COLOR = '#262019';
const OVERLAP_COLOR = '#c2452d';
const DOOR_LEAF_COLOR = '#8a6544';
const GLASS_COLOR = '#bcd3dc';
const FRAME_COLOR = '#efe9df';

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

// Manerul de alama al unui front — aceleasi pozitii ca FrontHandle din
// piece-canvas (acolo relative la grupul animat, aici absolute: fronturile
// din camera sunt statice). Fara el, piesa cu "fronturi cu maner" arata
// diferit in camera fata de editor (bug raportat de PO).
function StaticHandle({ panel }: { panel: Panel3d }) {
  let x = panel.x;
  let y = panel.y;
  let vertical = false;
  let length = Math.min(0.28, panel.w * 0.45);
  if (panel.role === 'DOOR_FRONT') {
    const sign = panel.hinge === 'R' ? 1 : -1;
    x = panel.x - sign * (panel.w / 2 - 0.05);
    vertical = true;
    length = Math.min(0.32, panel.h * 0.45);
  } else if (panel.role === 'TILT_FRONT') {
    y = panel.y + panel.h / 2 - 0.05;
    length = Math.min(0.26, panel.w * 0.4);
  } else if (panel.role === 'SLIDING_FRONT') {
    const sign = (panel.slideDx ?? 0) >= 0 ? 1 : -1;
    x = panel.x - sign * (panel.w / 2 - 0.06);
    vertical = true;
    length = Math.min(0.5, panel.h * 0.35);
  } else {
    // sertar: bara orizontala sub muchia de sus a frontului
    y = panel.y + Math.max(0, panel.h / 2 - 0.045);
  }
  return (
    <mesh
      position={[x, y, panel.z + panel.d / 2 + 0.012]}
      rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}
    >
      <cylinderGeometry args={[0.008, 0.008, length, 10]} />
      <meshStandardMaterial color={ROD_COLOR} roughness={0.35} metalness={0.7} />
    </mesh>
  );
}

const HANDLE_ROLES = new Set(['DRAWER_FRONT', 'DOOR_FRONT', 'TILT_FRONT', 'SLIDING_FRONT']);

export function PieceMeshes({ piece }: { piece: StudioPiece }) {
  const panels = useMemo(() => buildPanels(piece.config, piece.kind), [piece.config, piece.kind]);
  const spec = useMemo(
    () => finishSpecFor(piece.config.finish, piece.config.customColor),
    [piece.config.finish, piece.config.customColor],
  );
  const withHandles = piece.config.frontStyle === 'HANDLE';
  return (
    <group>
      {panels.map((p, i) => (
        <StaticPanel key={i} panel={p} spec={spec} />
      ))}
      {withHandles &&
        panels
          .filter((p) => HANDLE_ROLES.has(p.role))
          .map((p, i) => <StaticHandle key={`h${i}`} panel={p} />)}
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

// Cotele live in timpul mutarii unei piese (stil Sims): linii pe podea de la
// muchiile piesei pana la pereti, cu distanta in cm pe fiecare — precizia de
// 1cm devine vizibila, nu doar simtita (feedback PO r2, itemul 1).
function DragDimensions({
  placement,
  piece,
  room,
}: {
  placement: StudioPlacement;
  piece: StudioPiece;
  room: StudioRoom;
}) {
  const { hx, hz } = placementHalfExtents(piece.config, placement.rotation);
  const y = 0.02;
  const cm = (v: number) => `${Math.round(v * 100)} cm`;
  const rails: { from: [number, number, number]; to: [number, number, number]; dist: number }[] = [
    {
      from: [-room.widthM / 2, y, placement.z],
      to: [placement.x - hx, y, placement.z],
      dist: placement.x - hx + room.widthM / 2,
    },
    {
      from: [placement.x + hx, y, placement.z],
      to: [room.widthM / 2, y, placement.z],
      dist: room.widthM / 2 - (placement.x + hx),
    },
    {
      from: [placement.x, y, -room.depthM / 2],
      to: [placement.x, y, placement.z - hz],
      dist: placement.z - hz + room.depthM / 2,
    },
    {
      from: [placement.x, y, placement.z + hz],
      to: [placement.x, y, room.depthM / 2],
      dist: room.depthM / 2 - (placement.z + hz),
    },
  ];
  return (
    <group>
      {rails
        .filter((r) => r.dist > 0.015)
        .map((r, i) => (
          <group key={i}>
            <Line points={[r.from, r.to]} color="#7a5638" lineWidth={1.5} dashed dashSize={0.06} gapSize={0.04} />
            <Html
              center
              position={[(r.from[0] + r.to[0]) / 2, 0.05, (r.from[2] + r.to[2]) / 2]}
              style={{ pointerEvents: 'none' }}
            >
              <span
                style={{
                  background: 'rgba(247,243,236,0.92)',
                  border: '1px solid rgba(122,86,56,0.35)',
                  borderRadius: '999px',
                  padding: '1px 7px',
                  fontSize: '11px',
                  fontVariantNumeric: 'tabular-nums',
                  color: '#5b4632',
                  whiteSpace: 'nowrap',
                }}
              >
                {cm(r.dist)}
              </span>
            </Html>
          </group>
        ))}
    </group>
  );
}

// Grila podelei: linii la 0.5m — reper vizual; snap-ul real e la 1cm.
export function FloorGrid({ w, d }: { w: number; d: number }) {
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

// Geometria unui perete in coordonate LOCALE: peretele sta de-a lungul axei X,
// fata interioara spre +z. `sign` converteste offsetul din lume in local.
interface WallSpec {
  wall: StudioWall;
  pos: [number, number, number];
  rotY: number;
  // lungimea randata (N/S acopera si colturile), lungimea utila si semnul
  renderLen: number;
  sign: 1 | -1;
  nx: number;
  nz: number;
}

function wallSpecs(room: StudioRoom): WallSpec[] {
  const { widthM: w, depthM: d } = room;
  return [
    { wall: 'N', pos: [0, 0, -d / 2 - WALL_T / 2], rotY: 0, renderLen: w + 2 * WALL_T, sign: 1, nx: 0, nz: -1 },
    { wall: 'S', pos: [0, 0, d / 2 + WALL_T / 2], rotY: Math.PI, renderLen: w + 2 * WALL_T, sign: -1, nx: 0, nz: 1 },
    { wall: 'E', pos: [w / 2 + WALL_T / 2, 0, 0], rotY: -Math.PI / 2, renderLen: d, sign: 1, nx: 1, nz: 0 },
    { wall: 'W', pos: [-w / 2 - WALL_T / 2, 0, 0], rotY: Math.PI / 2, renderLen: d, sign: -1, nx: -1, nz: 0 },
  ];
}

interface OpeningHandlers {
  selectedOpeningId: string | null;
  onOpeningPointerDown: (e: ThreeEvent<PointerEvent>, opening: StudioOpening) => void;
}

const NOOP_OPENING_HANDLERS: OpeningHandlers = {
  selectedOpeningId: null,
  onOpeningPointerDown: () => undefined,
};

// Un gol in perete (coordonate locale): tocul, foaia de usa / geamul si
// hit-target-ul invizibil pentru selectie + drag de-a lungul peretelui.
function OpeningMeshes({
  opening,
  cx,
  selected,
  onPointerDown,
}: {
  opening: StudioOpening;
  cx: number;
  selected: boolean;
  onPointerDown: (e: ThreeEvent<PointerEvent>, opening: StudioOpening) => void;
}) {
  const { w, h, sill } = openingSize(opening);
  const top = sill + h;
  const isDoor = opening.kind === 'DOOR' || opening.kind === 'DOOR_DOUBLE';
  const isOutlet = opening.kind === 'OUTLET';
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = 'grab';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  const frameColor = selected ? HIGHLIGHT_COLOR : FRAME_COLOR;
  const bar = 0.06;
  const frameZ = WALL_T / 2 + 0.012;

  if (isOutlet) {
    // priza: placa alba montata PE perete + doua "ochiuri"; hit-target mai
    // mare decat placa, altfel e greu de prins cu cursorul
    return (
      <group
        position={[cx, 0, 0]}
        onPointerDown={(e) => onPointerDown(e, opening)}
        onClick={(e) => e.stopPropagation()}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <mesh position={[0, sill + h / 2, 0]}>
          <boxGeometry args={[Math.max(0.24, w), Math.max(0.2, h), WALL_T + 0.06]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[0, sill + h / 2, WALL_T / 2 + 0.013]} castShadow>
          <boxGeometry args={[w, h, 0.025]} />
          <meshStandardMaterial
            color={selected ? HIGHLIGHT_COLOR : '#f2ede4'}
            roughness={0.6}
          />
        </mesh>
        {[-0.035, 0.035].map((dx) => (
          <mesh
            key={dx}
            position={[dx, sill + h / 2, WALL_T / 2 + 0.027]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.024, 0.024, 0.008, 16]} />
            <meshStandardMaterial color="#c9c2b4" roughness={0.8} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group
      position={[cx, 0, 0]}
      onPointerDown={(e) => onPointerDown(e, opening)}
      onClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* hit-target pe tot golul (opacitate 0 — visible:false ar opri raycastul) */}
      <mesh position={[0, sill + h / 2, 0]}>
        <boxGeometry args={[w, h, WALL_T + 0.05]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* tocul: bara de sus + laterale (+ jos la ferestre), pe fata interioara */}
      <mesh position={[0, top + bar / 2, frameZ]}>
        <boxGeometry args={[w + 2 * bar, bar, 0.03]} />
        <meshStandardMaterial color={frameColor} roughness={0.7} />
      </mesh>
      <mesh position={[-(w + bar) / 2, sill + h / 2 + (isDoor ? bar / 2 : 0), frameZ]}>
        <boxGeometry args={[bar, h + (isDoor ? bar : 2 * bar), 0.03]} />
        <meshStandardMaterial color={frameColor} roughness={0.7} />
      </mesh>
      <mesh position={[(w + bar) / 2, sill + h / 2 + (isDoor ? bar / 2 : 0), frameZ]}>
        <boxGeometry args={[bar, h + (isDoor ? bar : 2 * bar), 0.03]} />
        <meshStandardMaterial color={frameColor} roughness={0.7} />
      </mesh>
      {!isDoor && (
        <mesh position={[0, sill - bar / 2, frameZ]}>
          <boxGeometry args={[w + 2 * bar, bar, 0.03]} />
          <meshStandardMaterial color={frameColor} roughness={0.7} />
        </mesh>
      )}

      {isDoor ? (
        <group>
          {/* foaia usii, usor retrasa in gol; usa dubla are doua foi */}
          {(opening.kind === 'DOOR_DOUBLE' ? [-1, 1] : [0]).map((side) => {
            const leafW = opening.kind === 'DOOR_DOUBLE' ? w / 2 - 0.02 : w - 0.03;
            const lx = opening.kind === 'DOOR_DOUBLE' ? (side * (leafW + 0.02)) / 2 : 0;
            return (
              <mesh key={side} position={[lx, h / 2 - 0.01, 0.004]} castShadow>
                <boxGeometry args={[leafW, h - 0.02, 0.04]} />
                <meshStandardMaterial color={DOOR_LEAF_COLOR} roughness={0.6} />
              </mesh>
            );
          })}
          {/* clanta de alama */}
          <mesh
            position={[opening.kind === 'DOOR_DOUBLE' ? -0.08 : w / 2 - 0.09, 1.02, WALL_T / 2 + 0.02]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.011, 0.011, 0.13, 10]} />
            <meshStandardMaterial color={ROD_COLOR} roughness={0.35} metalness={0.7} />
          </mesh>
        </group>
      ) : (
        <group>
          {/* geamul translucid + montant central la fereastra lata */}
          <mesh position={[0, sill + h / 2, 0]}>
            <boxGeometry args={[w - 0.04, h - 0.04, 0.015]} />
            <meshStandardMaterial
              color={GLASS_COLOR}
              transparent
              opacity={0.35}
              roughness={0.15}
              depthWrite={false}
            />
          </mesh>
          {opening.kind === 'WINDOW_WIDE' && (
            <mesh position={[0, sill + h / 2, 0.012]}>
              <boxGeometry args={[0.05, h - 0.02, 0.03]} />
              <meshStandardMaterial color={FRAME_COLOR} roughness={0.7} />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}

// Peretii camerei: segmente pline in jurul golurilor (fara CSG — buiandrug
// deasupra, parapet sub ferestre); cei ajunsi intre camera si privitor devin
// invizibili (normala exterioara spre camera), ca in The Sims. Segmentele nu
// au handlere — peretii ascunsi nu intercepteaza raycast-ul spre piese.
export function Walls({
  room,
  openings,
  color,
  handlers = NOOP_OPENING_HANDLERS,
}: {
  room: StudioRoom;
  openings: StudioOpening[];
  color: string;
  // lipsa = mod viewer (read-only): golurile nu se selecteaza si nu se trag
  handlers?: OpeningHandlers;
}) {
  const refs = useRef<Partial<Record<StudioWall, Group | null>>>({});
  const camPos = useRef(new Vector3());
  const specs = useMemo(() => wallSpecs(room), [room]);
  const H = room.wallHeightM;

  useFrame(({ camera }) => {
    camera.getWorldPosition(camPos.current);
    const dbg: Record<string, unknown> = { cam: camPos.current.toArray() };
    for (const spec of specs) {
      const group = refs.current[spec.wall];
      if (!group) continue;
      const toCam =
        (camPos.current.x - spec.pos[0]) * spec.nx + (camPos.current.z - spec.pos[2]) * spec.nz;
      group.visible = toCam < 0;
      dbg[spec.wall] = group.visible;
    }
    (window as unknown as Record<string, unknown>).__wallsDbg = dbg;
  });

  return (
    <group>
      {specs.map((spec) => {
        const wallOpenings = openings
          .filter((o) => o.wall === spec.wall)
          .map((o) => ({ opening: o, cx: spec.sign * o.offset, ...openingSize(o) }))
          .sort((a, b) => a.cx - b.cx);

        // segmentele pline pe verticala intreaga, intre golurile CARE TAIE
        // peretele (prizele stau pe perete, nu in el)
        const half = spec.renderLen / 2;
        const segments: { x: number; w: number }[] = [];
        let cursor = -half;
        for (const { cx, w, cutout } of wallOpenings) {
          if (!cutout) continue;
          const left = cx - w / 2;
          if (left - cursor > 0.005) {
            segments.push({ x: (cursor + left) / 2, w: left - cursor });
          }
          cursor = cx + w / 2;
        }
        if (half - cursor > 0.005) segments.push({ x: (cursor + half) / 2, w: half - cursor });

        return (
          <group
            key={spec.wall}
            position={spec.pos}
            rotation={[0, spec.rotY, 0]}
            ref={(el) => {
              refs.current[spec.wall] = el;
            }}
          >
            {segments.map((seg, i) => (
              <mesh key={i} position={[seg.x, H / 2, 0]} receiveShadow>
                <boxGeometry args={[seg.w, H, WALL_T]} />
                <meshStandardMaterial color={color} roughness={0.9} />
              </mesh>
            ))}
            {wallOpenings.map(({ opening, cx, w, h, sill, cutout }) => {
              const top = sill + h;
              return (
                <group key={opening.id}>
                  {/* buiandrug + parapet doar la golurile taiate in perete */}
                  {cutout && H - top > 0.02 && (
                    <mesh position={[cx, top + (H - top) / 2, 0]} receiveShadow>
                      <boxGeometry args={[w, H - top, WALL_T]} />
                      <meshStandardMaterial color={color} roughness={0.9} />
                    </mesh>
                  )}
                  {cutout && sill > 0.02 && (
                    <mesh position={[cx, sill / 2, 0]} receiveShadow>
                      <boxGeometry args={[w, sill, WALL_T]} />
                      <meshStandardMaterial color={color} roughness={0.9} />
                    </mesh>
                  )}
                  <OpeningMeshes
                    opening={opening}
                    cx={cx}
                    selected={handlers.selectedOpeningId === opening.id}
                    onPointerDown={handlers.onOpeningPointerDown}
                  />
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// Repozitioneaza camera cand se schimba gabaritul camerei de joc sau scena.
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

type DragState =
  | { type: 'piece'; id: string; dx: number; dz: number }
  | { type: 'opening'; id: string; wall: StudioWall; delta: number };

// valoarea de-a lungul peretelui (axa LUMII) in punctul dat
function alongWall(wall: StudioWall, x: number, z: number): number {
  return wall === 'N' || wall === 'S' ? x : z;
}

// raza din camera prin pozitia cursorului (independenta de raycastul R3F)
function pointerRay(
  camera: Camera,
  el: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { origin: Vector3; direction: Vector3 } {
  const rect = el.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
  const target = new Vector3(ndcX, ndcY, 0.5).unproject(camera);
  const origin = new Vector3();
  camera.getWorldPosition(origin);
  return { origin, direction: target.sub(origin).normalize() };
}

// intersectia razei cu planul interior al peretelui → pozitia pe axa lui
function rayToWall(
  ray: { origin: Vector3; direction: Vector3 },
  wall: StudioWall,
  room: StudioRoom,
): number | null {
  const o = ray.origin;
  const dir = ray.direction;
  if (wall === 'N' || wall === 'S') {
    const planeZ = wall === 'N' ? -room.depthM / 2 : room.depthM / 2;
    if (Math.abs(dir.z) < 1e-6) return null;
    const t = (planeZ - o.z) / dir.z;
    if (t <= 0) return null;
    return o.x + t * dir.x;
  }
  const planeX = wall === 'E' ? room.widthM / 2 : -room.widthM / 2;
  if (Math.abs(dir.x) < 1e-6) return null;
  const t = (planeX - o.x) / dir.x;
  if (t <= 0) return null;
  return o.z + t * dir.z;
}

function StudioSceneView({ onDraggingChange }: { onDraggingChange: (v: boolean) => void }) {
  const scene = useActiveScene();
  const pieces = useStudioStore((s) => s.pieces);
  const selectedId = useStudioStore((s) => s.selectedId);
  const selectedOpeningId = useStudioStore((s) => s.selectedOpeningId);
  const setSelected = useStudioStore((s) => s.setSelected);
  const setSelectedOpening = useStudioStore((s) => s.setSelectedOpening);
  const movePlacement = useStudioStore((s) => s.movePlacement);
  const moveOpening = useStudioStore((s) => s.moveOpening);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const room = scene.room;
  const [dragging, setDragging] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const overlapping = useMemo(
    () => overlappingPlacements(scene.placements, pieces),
    [scene.placements, pieces],
  );

  // orice schimbare de continut cere un cadru nou (frameloop demand)
  useEffect(() => {
    invalidate();
  }, [scene, pieces, selectedId, selectedOpeningId, dragging, invalidate]);

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(null);
    onDraggingChange(false);
    document.body.style.cursor = '';
  };

  // Dragul asculta pointermove DIRECT pe fereastra (DOM), cu raza construita
  // manual din camera: livrarea nu mai depinde de raycastul R3F, pe care un
  // stopPropagation din onPointerOver al altei piese il poate opri la mijloc
  // de gest. Pointerup pe fereastra inchide dragul oriunde ar cadea.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const ray = pointerRay(camera, gl.domElement, ev.clientX, ev.clientY);
      if (drag.type === 'piece') {
        if (Math.abs(ray.direction.y) < 1e-6) return;
        const t = -ray.origin.y / ray.direction.y;
        if (t <= 0) return;
        movePlacement(
          drag.id,
          ray.origin.x + t * ray.direction.x + drag.dx,
          ray.origin.z + t * ray.direction.z + drag.dz,
        );
      } else {
        const along = rayToWall(ray, drag.wall, room);
        if (along === null) return;
        moveOpening(drag.id, along + drag.delta);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, camera, gl, room]);

  const startDrag = (state: DragState) => {
    // o singura intrare de undo per gest — nu per pointermove
    useStudioStore.getState().recordHistory();
    dragRef.current = state;
    setDragging(state);
    onDraggingChange(true);
    document.body.style.cursor = 'grabbing';
  };

  const onPiecePointerDown = (e: ThreeEvent<PointerEvent>, placement: StudioPlacement) => {
    // doar butonul principal / atingerea trage piese (dreapta ramane orbitei)
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    setSelected(placement.id);
    startDrag({
      type: 'piece',
      id: placement.id,
      dx: placement.x - e.point.x,
      dz: placement.z - e.point.z,
    });
  };

  const onOpeningPointerDown = (e: ThreeEvent<PointerEvent>, opening: StudioOpening) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    setSelectedOpening(opening.id);
    startDrag({
      type: 'opening',
      id: opening.id,
      wall: opening.wall,
      delta: opening.offset - alongWall(opening.wall, e.point.x, e.point.z),
    });
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
          if (e.delta <= 4) {
            setSelected(null);
            setSelectedOpening(null);
          }
        }}
      >
        <boxGeometry args={[room.widthM + 2 * WALL_T, FLOOR_T, room.depthM + 2 * WALL_T]} />
        <meshStandardMaterial color={floorColorOf(room.floorColor)} roughness={0.85} />
      </mesh>
      <FloorGrid w={room.widthM} d={room.depthM} />
      <Walls
        room={room}
        openings={scene.openings}
        color={wallColorOf(room.wallColor)}
        handlers={{ selectedOpeningId, onOpeningPointerDown }}
      />

      {scene.placements.map((p) => {
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

      {/* cotele live cat timp se trage o piesa */}
      {dragging?.type === 'piece' &&
        (() => {
          const placement = scene.placements.find((p) => p.id === dragging.id);
          const piece = placement && pieces[placement.pieceId];
          if (!placement || !piece) return null;
          return <DragDimensions placement={placement} piece={piece} room={room} />;
        })()}
    </group>
  );
}

export default function RoomCanvas({ className }: { className?: string }) {
  const scene = useActiveScene();
  const maxDim = Math.max(scene.room.widthM, scene.room.depthM);
  // cat timp se trage ceva, orbita camerei sta pe loc (OrbitControls asculta
  // direct pe elementul canvas — stopPropagation din scena nu ajunge la el)
  const [dragging, setDragging] = useState(false);
  return (
    <div className={className}>
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
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0003}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={8}
          shadow-camera-bottom={-7}
        />
        <directionalLight position={[-5, 5, -4]} intensity={0.35} />
        <StudioSceneView onDraggingChange={setDragging} />
        <OrbitControls
          makeDefault
          enabled={!dragging}
          enablePan
          minDistance={1.6}
          maxDistance={maxDim * 3 + 6}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2 - 0.08}
        />
        <CameraRig w={scene.room.widthM} d={scene.room.depthM} sceneId={scene.id} />
      </Canvas>
    </div>
  );
}
