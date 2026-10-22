'use client';

import {
  buildPanels,
  buildInteriorDetails,
  buildDrawerAssembly,
  buildTiltTray,
  buildZoneBoxes,
  type Piece3dHandleStyle,
  type Piece3dKind,
  type PieceConfig3d,
  type Panel3d,
  type ZoneBox3d,
} from '@marketplace/shared';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BoxGeometry, EdgesGeometry, type Group } from 'three';
import { finishSpecForConfig, HIGHLIGHT_COLOR, DRAWER_INTERIOR_SPEC, type FinishSpec } from './finishes';
import { furnitureMotionBounds } from './furniture-motion-bounds';
import { ShowroomGeometry, ShowroomMaterial } from './showroom-panel';
import { boardGrainOffset } from './showroom-grain';
import { ShowroomEnvironment } from './showroom-environment';
import { ShowroomContactShadow } from './showroom-contact-shadow';
import { PieceCameraRig } from './stable-orbit-camera';
import { OPEN_DURATION_MS } from './open-tween';
import { useOpenTween } from './use-open-tween';
import { FurnitureMotion } from './furniture-motion';
import { FrontDetails } from './front-details';
import { HardwareBatches, HardwareInstances } from './hardware-instances';
import { ShowroomBatches } from './showroom-batches';
import { useTranslations } from 'next-intl';

// Scena 3D a piesei (R1 + fidelizare Tylko): carcasa parametrica generata din
// config, lumini soft, orbita limitata, dpr limitat si frameloop="demand".
// Usile si sertarele sunt GRUPURI ANIMATE: click pe zona le deschide/inchide
// (rotatie pe balama / culisare), ca sa se vada interiorul — inclusiv politele
// din spatele usilor. T1: usile glisante culiseaza lateral peste coloana
// vecina, manerele (frontStyle HANDLE) sunt bare de alama pe fronturi.
// Geometria vine exclusiv din shared.

export type ZoneRef = { col: number; zone: number };

export const zoneKey = (col: number, zone: number) => `${col}:${zone}`;
// cheia de "deschis" a unei usi glisante — per coloana, nu per zona
export const slideKey = (col: number) => `slide:${col}`;

// functie de snapshot expusa parintelui (R4): randeaza un cadru si intoarce PNG
export type SnapshotFn = () => string | null;

interface PieceCanvasProps {
  kind: Piece3dKind;
  config: PieceConfig3d;
  activeZone?: ZoneRef | null;
  // zonele cu fronturi deschise ("col:zone") — usa rotita / sertarul tras
  openZones?: ReadonlySet<string>;
  onZoneClick?: (zone: ZoneRef) => void;
  onFrontSettled?: (key: string, open: boolean) => void;
  onSnapshotReady?: (fn: SnapshotFn) => void;
  className?: string;
}

// culoarea cutiei sertarului (interior mesteacan deschis, ca la Tylko)

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

// unghiul maxim al usii (~105°) si al frontului rabatabil (~38°)
const DOOR_OPEN_RAD = 1.85;
const TILT_OPEN_RAD = 0.66;

// Aplica starea de deschidere pe grupul-pivot al unui front.
function applyFrontTransform(group: Group | null, front: Panel3d, p: number, drawerTravel: number) {
  if (!group) return;
  group.userData.openProgress = p;
  // rotatia se reseteaza mereu: daca grupul e refolosit dupa o schimbare de rol
  // (usa deschisa -> sertar), unghiul de usa ar ramane aplicat pe noul front
  group.rotation.set(0, 0, 0);
  if (front.role === 'DOOR_FRONT') {
    // balamaua pe muchia exterioara: L → unghi negativ, R → pozitiv
    const sign = front.hinge === 'R' ? 1 : -1;
    group.rotation.y = sign * p * DOOR_OPEN_RAD;
  } else if (front.role === 'TILT_FRONT') {
    // pivot pe muchia de jos, partea de sus cade spre privitor
    group.rotation.x = p * TILT_OPEN_RAD;
  } else if (front.role === 'SLIDING_FRONT') {
    // usa glisanta: culiseaza lateral peste coloana vecina (T1)
    group.position.x = front.x + p * (front.slideDx ?? 0);
  } else {
    // sertar: culiseaza spre privitor
    group.position.z = front.z + p * drawerTravel;
  }
}

// Durata mecanismului ramane aceeasi inclusiv dupa pauze intre cadre.
function AnimatedFronts({
  fronts,
  open,
  depthM,
  spec,
  withHandles,
  handleStyle,
  onClick,
  onComplete,
  attachments = [],
  recessedHandles = false,
}: {
  fronts: Panel3d[];
  open: boolean;
  depthM: number;
  spec: FinishSpec;
  withHandles: boolean;
  handleStyle: Piece3dHandleStyle;
  onClick?: () => void;
  onComplete?: (open: boolean) => void;
  attachments?: Panel3d[];
  recessedHandles?: boolean;
}) {
  const groups = useRef<(Group | null)[]>([]);
  const drawers = useMemo(() => fronts.map((front) => front.role === 'DRAWER_FRONT' ? buildDrawerAssembly(front, depthM) : null), [fronts, depthM]);
  const tiltTrays = useMemo(() => fronts.map((front) => front.role === 'TILT_FRONT' ? buildTiltTray(front, depthM) : []), [fronts, depthM]);
  const guides = useMemo(() => fronts.map(f => attachments.map(panel => ({ ...panel, x: panel.x - f.x, y: panel.y - f.y, z: panel.z - f.z }))), [fronts, attachments]);
  const drawerSpec = DRAWER_INTERIOR_SPEC;
  const role = fronts[0]?.role;
  const duration = role === 'SLIDING_FRONT' ? OPEN_DURATION_MS.sliding
    : role === 'DOOR_FRONT' ? OPEN_DURATION_MS.door
      : role === 'TILT_FRONT' ? OPEN_DURATION_MS.tilt : OPEN_DURATION_MS.drawer;
  useOpenTween(open, duration, (progress) => {
    fronts.forEach((f, i) => applyFrontTransform(groups.current[i], f, progress, drawers[i]?.travel ?? 0));
  }, onComplete);

  return (
    <group onClick={onClick ? (event) => { event.stopPropagation(); if (event.delta <= 3) onClick(); } : undefined}>
      {fronts.map((f, i) => {
        const material = <ShowroomMaterial spec={spec} front grainOffset={boardGrainOffset(f)} grainAxis={f.grainAxis ?? (f.w > f.h ? 'X' : 'Y')} />;
        if (f.role === 'DOOR_FRONT') {
          const sign = f.hinge === 'R' ? 1 : -1;
          return (
            <group
              key={`${f.role}-${i}`}
              name={`front:${f.role}:${f.col}:${f.zone}:${i}`}
              ref={(el) => {
                groups.current[i] = el;
              }}
              position={[f.x + (sign * f.w) / 2, f.y, f.z + f.d / 2]}
            >
              <mesh position={[(-sign * f.w) / 2, 0, -f.d / 2]} castShadow receiveShadow>
                <ShowroomGeometry w={f.w} h={f.h} d={f.d} radius={f.radius} />
                {material}
              </mesh>
              <FrontDetails front={f} spec={spec} withHandles={withHandles} handleStyle={handleStyle} offset={[-sign * f.w / 2, 0, -f.d / 2]} />
            </group>
          );
        }
        if (f.role === 'TILT_FRONT') {
          return (
            <group
              key={`${f.role}-${i}`}
              name={`front:${f.role}:${f.col}:${f.zone}:${i}`}
              ref={(el) => {
                groups.current[i] = el;
              }}
              position={[f.x, f.y - f.h / 2, f.z + f.d / 2]}
            >
              <mesh position={[0, f.h / 2, -f.d / 2]} castShadow receiveShadow>
                <ShowroomGeometry w={f.w} h={f.h} d={f.d} radius={f.radius} />
                {material}
              </mesh>
              <group position={[0, f.h / 2, -f.d / 2]}>
                <ShowroomBatches panels={tiltTrays[i]} spec={drawerSpec} />
              </group>
              <FrontDetails front={f} spec={spec} withHandles={withHandles} handleStyle={handleStyle} offset={[0, f.h / 2, -f.d / 2]} />
            </group>
          );
        }
        if (f.role === 'SLIDING_FRONT') {
          // usa glisanta: fara DrawerBox; manerul sta pe muchia opusa glisarii
          return (
            <group
              key={`${f.role}-${i}`}
              name={`front:${f.role}:${f.col}:${i}`}
              ref={(el) => {
                groups.current[i] = el;
              }}
              position={[f.x, f.y, f.z]}
            >
              <mesh castShadow>
                <ShowroomGeometry w={f.w} h={f.h} d={f.d} radius={f.radius} />
                {material}
              </mesh>
              <ShowroomBatches panels={guides[i]} spec={spec} />
              <FrontDetails front={f} spec={spec} withHandles={withHandles} handleStyle={handleStyle} />
            </group>
          );
        }
        return (
          <group key={`${f.role}-${i}`}>
          <group position={[f.x, f.y, f.z]}>
            {drawers[i] && <ShowroomBatches panels={drawers[i]!.fixed} spec={drawerSpec} />}
          </group>
          <group
            name={`front:${f.role}:${f.col}:${f.zone}:${i}`}
            ref={(el) => {
              groups.current[i] = el;
            }}
            position={[f.x, f.y, f.z]}
          >
            <mesh castShadow>
              <ShowroomGeometry w={f.w} h={f.h} d={f.d} radius={f.radius} />
              {material}
            </mesh>
            <FrontDetails front={f} spec={spec} withHandles={withHandles} handleStyle={handleStyle} recessed={recessedHandles} />
            {drawers[i] && <ShowroomBatches panels={drawers[i]!.moving} spec={drawerSpec} />}
          </group>
          </group>
        );
      })}
    </group>
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
          if (e.delta <= 3) onClick?.({ col: box.col, zone: box.zone });
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

const FRONT_ROLES = new Set(['DRAWER_FRONT', 'DOOR_FRONT', 'TILT_FRONT', 'SLIDING_FRONT']);

function PieceScene({ kind, config, activeZone, openZones, onZoneClick, onFrontSettled, furnitureOpen, onFurnitureToggle }: PieceCanvasProps & {
  furnitureOpen: ReadonlySet<string>; onFurnitureToggle: (key: string) => void;
}) {
  const { statics, frontZones, motionGroups } = useMemo(() => {
    const all = buildPanels(config, kind);
    const staticPanels: Panel3d[] = [];
    const byZone = new Map<string, Panel3d[]>();
    const byMotion = new Map<string, Panel3d[]>();
    for (const p of all) {
      if (p.motion) {
        const assembly = byMotion.get(p.motion.key) ?? [];
        assembly.push(p);
        byMotion.set(p.motion.key, assembly);
        continue;
      }
      // usile glisante apartin coloanei (nu unei zone); fronturile per zona
      // se grupeaza ca pana acum, dupa "col:zone"
      const key =
        p.role === 'SLIDING_FRONT' && p.col !== undefined
          ? slideKey(p.col)
          : FRONT_ROLES.has(p.role) && p.col !== undefined && p.zone !== undefined
            ? zoneKey(p.col, p.zone)
            : null;
      if (key !== null) {
        const list = byZone.get(key);
        if (list) list.push(p);
        else byZone.set(key, [p]);
      } else {
        staticPanels.push(p);
      }
    }
    return { statics: [...staticPanels, ...buildInteriorDetails(all)], frontZones: [...byZone.entries()], motionGroups: [...byMotion.entries()] };
  }, [config, kind]);
  const zones = useMemo(() => buildZoneBoxes(config, kind), [config, kind]);
  const spec = useMemo(
    () => finishSpecForConfig(config),
    [config],
  );
  const withHandles = config.frontStyle === 'HANDLE';
  const handleStyle = config.handleStyle ?? 'BAR';

  return (
    <group>
      <HardwareInstances spec={spec}>
      <HardwareBatches panels={statics} spec={spec} />
      {frontZones.map(([key, fronts]) => (
        <AnimatedFronts
          key={key}
          fronts={fronts}
          open={openZones?.has(key) ?? false}
          depthM={config.depthM}
          spec={spec}
          withHandles={withHandles}
          handleStyle={handleStyle}
          recessedHandles={config.doorMode === 'SLIDING'}
          onClick={onZoneClick ? () => onZoneClick({ col: fronts[0].col ?? 0, zone: fronts[0].zone ?? 0 }) : undefined}
          onComplete={onFrontSettled ? (open) => onFrontSettled(key, open) : undefined}
          attachments={motionGroups.find(([motionKey]) => motionKey === key)?.[1]}
        />
      ))}
      {motionGroups.filter(([key]) => !key.startsWith('slide:')).map(([key, panels]) => <FurnitureMotion key={key} panels={panels} spec={spec}
        open={furnitureOpen.has(key)} onToggle={() => onFurnitureToggle(key)} />)}
      {onZoneClick &&
        zones.map((b) => (
          <ZoneHotspot
            key={zoneKey(b.col, b.zone)}
            box={b}
            active={activeZone?.col === b.col && activeZone?.zone === b.zone}
            onClick={onZoneClick}
          />
        ))}
      </HardwareInstances>
    </group>
  );
}

export function PieceCanvas(props: PieceCanvasProps) {
  const { config, className, onSnapshotReady } = props;
  const t = useTranslations('Configurator.config3d.furniture');
  const [furnitureOpen, setFurnitureOpen] = useState<Set<string>>(new Set());
  const motionKeys = useMemo(() => [...new Set(buildPanels(config, props.kind).flatMap(p => p.motion && !p.motion.key.startsWith('slide:') ? [p.motion.key] : []))], [config, props.kind]);
  useEffect(() => setFurnitureOpen(previous => {
    const next = new Set([...previous].filter(key => motionKeys.includes(key)));
    return next.size === previous.size ? previous : next;
  }), [motionKeys]);
  const bedDrawers = props.kind === 'BED' && config.bed?.storage === 'DRAWERS';
  const viewBounds = useMemo(() => furnitureMotionBounds(config, buildPanels(config, props.kind)), [config, props.kind]);
  const toggleFurniture = (key: string) => setFurnitureOpen((previous) => {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  // distanta de orbita limitata la gabaritul piesei
  const maxDim = Math.max(viewBounds.width, viewBounds.height, viewBounds.depth);
  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        frameloop="demand"
        camera={{ fov: 32, near: 0.05, far: 60 }}
        gl={{ antialias: true }}
      >
        {/* fundal hartie calda — intra si in snapshotul PNG */}
        <color attach="background" args={['#f7f3ec']} />
        <ambientLight intensity={0.25} />
        <hemisphereLight args={['#fffaf4', '#b9af9e', 0.45]} />
        <directionalLight
          position={[-3.5, 6, 4.5]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0002}
          shadow-normalBias={0.002}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={5}
          shadow-camera-bottom={-2}
        />
        <directionalLight position={[4, 3, -2]} intensity={0.65} />
        <ShowroomEnvironment intensity={0.45}><PieceScene {...props} furnitureOpen={furnitureOpen} onFurnitureToggle={toggleFurniture} /></ShowroomEnvironment>
        <ShowroomContactShadow dirtyKey={JSON.stringify(config)} animationKey={[...(props.openZones ?? []), ...furnitureOpen].sort().join('|')}
          animationWindowMs={OPEN_DURATION_MS.lift + 50}
          scale={maxDim * 3 + 1} far={Math.min(2.5, viewBounds.height + 0.2)} />
        <OrbitControls
          makeDefault
          enableDamping={false}
          enablePan={false}
          minPolarAngle={0.12}
          maxPolarAngle={Math.PI / 2 - 0.05}
        />
        <PieceCameraRig width={viewBounds.width} height={viewBounds.height} depth={viewBounds.depth} />
        <SnapshotBridge onReady={onSnapshotReady} />
      </Canvas>
      {motionKeys.length > 0 && <button type="button" aria-pressed={furnitureOpen.size > 0}
        className="absolute bottom-3 left-3 min-h-11 rounded-full border border-border-2 bg-surface px-4 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-walnut"
        onClick={() => setFurnitureOpen(furnitureOpen.size ? new Set() : new Set(motionKeys))}>
        {t(bedDrawers ? (furnitureOpen.size ? 'closeDrawers' : 'openDrawers') : (furnitureOpen.size ? 'closeStorage' : 'openStorage'))}
      </button>}
    </div>
  );
}
