'use client';

import {
  buildPanels,
  buildZoneBoxes,
  type Piece3dKind,
  type PieceConfig3d,
  type Panel3d,
  type ZoneBox3d,
} from '@marketplace/shared';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BoxGeometry, EdgesGeometry, type Group } from 'three';
import { FINISH_SPECS, HIGHLIGHT_COLOR, ROD_COLOR } from './finishes';

// Scena 3D a piesei (R1 + fidelizare Tylko): carcasa parametrica generata din
// config, lumini soft, orbita limitata, dpr limitat si frameloop="demand".
// Usile si sertarele sunt GRUPURI ANIMATE: click pe zona le deschide/inchide
// (rotatie pe balama / culisare), ca sa se vada interiorul — inclusiv politele
// din spatele usilor. Geometria vine exclusiv din shared.

// tip minimal pentru controalele de orbita (evitam dependinta de three-stdlib,
// care e doar dependinta tranzitiva a drei si nu e expusa de pnpm)
type ControlsLike = {
  target: { set: (x: number, y: number, z: number) => void };
  update: () => void;
} | null;

export type ZoneRef = { col: number; zone: number };

export const zoneKey = (col: number, zone: number) => `${col}:${zone}`;

// functie de snapshot expusa parintelui (R4): randeaza un cadru si intoarce PNG
export type SnapshotFn = () => string | null;

interface PieceCanvasProps {
  kind: Piece3dKind;
  config: PieceConfig3d;
  activeZone?: ZoneRef | null;
  // zonele cu fronturi deschise ("col:zone") — usa rotita / sertarul tras
  openZones?: ReadonlySet<string>;
  onZoneClick?: (zone: ZoneRef) => void;
  onSnapshotReady?: (fn: SnapshotFn) => void;
  className?: string;
}

// culoarea cutiei sertarului (interior mesteacan deschis, ca la Tylko)
const DRAWER_BOX_COLOR = '#d6cbb8';
const BACKDROP_COLOR = '#262019';

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
  if (panel.role === 'FRONT_BACKDROP') {
    // cavitatea din spatele fronturilor: aproape negru, mat — rosturile dintre
    // fronturi se citesc ca linii inchise (luftul cerut de PO)
    return (
      <mesh position={[panel.x, panel.y, panel.z]}>
        <boxGeometry args={[panel.w, panel.h, panel.d]} />
        <meshStandardMaterial color={BACKDROP_COLOR} roughness={1} />
      </mesh>
    );
  }
  return (
    <mesh position={[panel.x, panel.y, panel.z]} castShadow receiveShadow>
      <boxGeometry args={[panel.w, panel.h, panel.d]} />
      <meshStandardMaterial color={spec.body} roughness={spec.roughness} />
    </mesh>
  );
}

// Cutia sertarului (fund + laterale + spate), atasata frontului: se vede cand
// sertarul e tras. Dimensiuni relative la front; adancimea vine din carcasa.
function DrawerBox({ w, h, boxD, frontD }: { w: number; h: number; boxD: number; frontD: number }) {
  const t = 0.012;
  const sideH = Math.max(0.05, h * 0.6);
  const sideY = -h / 2 + sideH / 2 + 0.01;
  const zMid = -frontD / 2 - boxD / 2;
  return (
    <group>
      <mesh position={[0, -h / 2 + 0.016, zMid]}>
        <boxGeometry args={[w - 0.02, t, boxD]} />
        <meshStandardMaterial color={DRAWER_BOX_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[-w / 2 + 0.012, sideY, zMid]}>
        <boxGeometry args={[t, sideH, boxD]} />
        <meshStandardMaterial color={DRAWER_BOX_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[w / 2 - 0.012, sideY, zMid]}>
        <boxGeometry args={[t, sideH, boxD]} />
        <meshStandardMaterial color={DRAWER_BOX_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[0, sideY, -frontD / 2 - boxD + t / 2]}>
        <boxGeometry args={[w - 0.02, sideH, t]} />
        <meshStandardMaterial color={DRAWER_BOX_COLOR} roughness={0.9} />
      </mesh>
    </group>
  );
}

// unghiul maxim al usii (~105°) si al frontului rabatabil (~38°)
const DOOR_OPEN_RAD = 1.85;
const TILT_OPEN_RAD = 0.66;

// Aplica starea de deschidere pe grupul-pivot al unui front.
function applyFrontTransform(group: Group | null, front: Panel3d, p: number, depthM: number) {
  if (!group) return;
  if (front.role === 'DOOR_FRONT') {
    // balamaua pe muchia exterioara: L → unghi negativ, R → pozitiv
    const sign = front.hinge === 'R' ? 1 : -1;
    group.rotation.y = sign * p * DOOR_OPEN_RAD;
  } else if (front.role === 'TILT_FRONT') {
    // pivot pe muchia de jos, partea de sus cade spre privitor
    group.rotation.x = p * TILT_OPEN_RAD;
  } else {
    // sertar: culiseaza spre privitor
    group.position.z = front.z + p * depthM * 0.45;
  }
}

// Fronturile unei zone, cu animatie de deschidere (lerp in useFrame; in
// frameloop="demand" cerem cadre noi doar cat dureaza animatia).
function AnimatedFronts({
  fronts,
  open,
  depthM,
  finish,
}: {
  fronts: Panel3d[];
  open: boolean;
  depthM: number;
  finish: PieceConfig3d['finish'];
}) {
  const spec = FINISH_SPECS[finish];
  const progress = useRef(0);
  const groups = useRef<(Group | null)[]>([]);
  const invalidate = useThree((s) => s.invalidate);

  useFrame((_, delta) => {
    const target = open ? 1 : 0;
    const current = progress.current;
    if (Math.abs(current - target) < 0.001) return;
    const step = Math.min(Math.abs(target - current), delta * 3.4);
    progress.current = current + Math.sign(target - current) * step;
    fronts.forEach((f, i) => applyFrontTransform(groups.current[i], f, progress.current, depthM));
    invalidate();
  });

  // la remontare (config schimbat) aplica starea curenta + porneste animatia
  useEffect(() => {
    fronts.forEach((f, i) => applyFrontTransform(groups.current[i], f, progress.current, depthM));
    invalidate();
  }, [fronts, depthM, open, invalidate]);

  const boxD = Math.max(0.12, depthM - 0.06);

  return (
    <>
      {fronts.map((f, i) => {
        const material = <meshStandardMaterial color={spec.front} roughness={spec.roughness} />;
        if (f.role === 'DOOR_FRONT') {
          const sign = f.hinge === 'R' ? 1 : -1;
          return (
            <group
              key={i}
              ref={(el) => {
                groups.current[i] = el;
              }}
              position={[f.x + (sign * f.w) / 2, f.y, f.z]}
            >
              <mesh position={[(-sign * f.w) / 2, 0, 0]} castShadow>
                <boxGeometry args={[f.w, f.h, f.d]} />
                {material}
              </mesh>
            </group>
          );
        }
        if (f.role === 'TILT_FRONT') {
          return (
            <group
              key={i}
              ref={(el) => {
                groups.current[i] = el;
              }}
              position={[f.x, f.y - f.h / 2, f.z]}
            >
              <mesh position={[0, f.h / 2, 0]} castShadow>
                <boxGeometry args={[f.w, f.h, f.d]} />
                {material}
              </mesh>
            </group>
          );
        }
        return (
          <group
            key={i}
            ref={(el) => {
              groups.current[i] = el;
            }}
            position={[f.x, f.y, f.z]}
          >
            <mesh castShadow>
              <boxGeometry args={[f.w, f.h, f.d]} />
              {material}
            </mesh>
            <DrawerBox w={f.w} h={f.h} boxD={boxD} frontD={f.d} />
          </group>
        );
      })}
    </>
  );
}

// Hit-target invizibil per zona: hover → tenta, click → selecteaza/deschide.
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
  // muchiile cutiei zonei — construite manual (nu prin JSX), deci dispose manual
  const edges = useMemo(() => {
    const geo = new BoxGeometry(box.w, box.h, box.d);
    const e = new EdgesGeometry(geo);
    geo.dispose();
    return e;
  }, [box.w, box.h, box.d]);
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <group position={[box.x, box.y, box.z]}>
      <mesh
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
          opacity={active ? 0.35 : hovered ? 0.15 : 0}
          depthWrite={false}
        />
      </mesh>
      {/* contur pe muchii, vizibil si prin fronturi — selectia se citeste clar */}
      {active && (
        <lineSegments geometry={edges} scale={[1.002, 1.002, 1.002]}>
          <lineBasicMaterial color={HIGHLIGHT_COLOR} transparent depthTest={false} />
        </lineSegments>
      )}
    </group>
  );
}

const FRONT_ROLES = new Set(['DRAWER_FRONT', 'DOOR_FRONT', 'TILT_FRONT']);

function PieceScene({ kind, config, activeZone, openZones, onZoneClick }: PieceCanvasProps) {
  const { statics, frontZones } = useMemo(() => {
    const all = buildPanels(config, kind);
    const staticPanels: Panel3d[] = [];
    const byZone = new Map<string, Panel3d[]>();
    for (const p of all) {
      if (FRONT_ROLES.has(p.role) && p.col !== undefined && p.zone !== undefined) {
        const key = zoneKey(p.col, p.zone);
        const list = byZone.get(key);
        if (list) list.push(p);
        else byZone.set(key, [p]);
      } else {
        staticPanels.push(p);
      }
    }
    return { statics: staticPanels, frontZones: [...byZone.entries()] };
  }, [config, kind]);
  const zones = useMemo(() => buildZoneBoxes(config, kind), [config, kind]);

  return (
    <group>
      {statics.map((p, i) => (
        <PanelMesh key={i} panel={p} finish={config.finish} />
      ))}
      {frontZones.map(([key, fronts]) => (
        <AnimatedFronts
          key={key}
          fronts={fronts}
          open={openZones?.has(key) ?? false}
          depthM={config.depthM}
          finish={config.finish}
        />
      ))}
      {onZoneClick &&
        zones.map((b) => (
          <ZoneHotspot
            key={zoneKey(b.col, b.zone)}
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
