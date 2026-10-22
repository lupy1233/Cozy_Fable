'use client';

import type { Panel3d, Panel3dAsset } from '@marketplace/shared';
import { useFrame, useThree } from '@react-three/fiber';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Matrix4, type BufferGeometry, type Group, type InstancedMesh, type Object3D } from 'three';
import type { FinishSpec } from './finishes';
import { useHardwareAssets } from './hardware-assets';
import { ShowroomBatches } from './showroom-batches';
import { ShowroomMaterial } from './showroom-panel';

// Instantiere pentru feroneria din GLB (prototip 2026-10-22): manere, picioare,
// balamale. Fiecare piesa de feronerie e un `HardwareInstance` (Object3D gol)
// in grupul ei, static sau animat, iar `HardwareInstances` tine un singur
// InstancedMesh per nod + material si copiaza, la fiecare cadru, matricea
// mondiala a fiecarui obiect gol in matricea instantei. E mecanismul din drei
// <Instances>, dar fara sa ceara ca instantele sa fie copii React ai
// mesh-ului, asa ca pot sta in usi si sertare.

type Surface = Panel3d['surface'];
interface HardwareRegistry {
  register(node: string, surface: Surface, proxy: Object3D): () => void;
}
const HardwareRegistryContext = createContext<HardwareRegistry | null>(null);
const keyOf = (node: string, surface: Surface) => `${node}|${surface ?? ''}`;

const scratch = new Matrix4();
const parentInverse = new Matrix4();

// Pura, testabila: instanceMatrix = inversa(parintelui mesh-ului) × matricea
// mondiala a proxy-ului. Matricile se recalculeaza explicit, altfel ultimul
// cadru al unei animatii ar ramane cu feroneria un cadru in urma usii.
export function syncHardwareInstances(mesh: InstancedMesh, proxies: Iterable<Object3D>, capacity: number): number {
  const parent = mesh.parent;
  if (parent) {
    parent.updateWorldMatrix(true, false);
    parentInverse.copy(parent.matrixWorld).invert();
  } else parentInverse.identity();
  let count = 0;
  for (const proxy of proxies) {
    if (count >= capacity) break;
    proxy.updateWorldMatrix(true, false);
    scratch.copy(proxy.matrixWorld).premultiply(parentInverse);
    mesh.setMatrixAt(count++, scratch);
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  return count;
}

// Separa primitivele de desenat de ancorele care primesc un model GLB:
// primitivele de rezerva dispar doar cand nodul lor e chiar incarcat.
export function splitHardwarePanels(panels: readonly Panel3d[], replaced: (node: string) => boolean) {
  const primitives: Panel3d[] = [];
  const anchors: Panel3dAsset[] = [];
  for (const panel of panels) {
    if (panel.asset && replaced(panel.asset.node)) anchors.push(panel.asset);
    if (!panel.assetFallback || !replaced(panel.assetFallback)) primitives.push(panel);
  }
  return { primitives, anchors };
}

const capacityFor = (count: number) => Math.max(8, 2 ** Math.ceil(Math.log2(Math.max(1, count))));
const noRaycast = () => null;

function HardwareInstancedMesh({ node, surface, geometry, proxies, capacity, spec }: {
  node: string; surface: Surface; geometry: BufferGeometry; proxies: ReadonlySet<Object3D>; capacity: number; spec: FinishSpec;
}) {
  const mesh = useRef<InstancedMesh>(null);
  useFrame(() => {
    if (!mesh.current) return;
    const count = syncHardwareInstances(mesh.current, proxies, capacity);
    if (process.env.NODE_ENV !== 'production') {
      // QA programatic pe /dev/piece-3d si /studio: cate instante are fiecare nod
      const w = window as unknown as { __hardwareInstances?: Record<string, number> };
      (w.__hardwareInstances ??= {})[node] = count;
    }
  });
  useEffect(() => () => {
    if (process.env.NODE_ENV !== 'production') delete (window as unknown as { __hardwareInstances?: Record<string, number> }).__hardwareInstances?.[node];
  }, [node]);
  return (
    <instancedMesh key={capacity} ref={mesh} name={`hardware:${node}`} args={[geometry, undefined, capacity]}
      castShadow receiveShadow frustumCulled={false} raycast={noRaycast}>
      <ShowroomMaterial spec={spec} surface={surface} />
    </instancedMesh>
  );
}

interface HardwareGroup { node: string; surface: Surface; set: Set<Object3D> }

// Se monteaza o data per piesa (sub ShowroomEnvironment, pentru reflexii);
// `spec` da finisajul instantelor fara `surface` (ex. picioarele comodei).
export function HardwareInstances({ spec, children }: { spec: FinishSpec; children: ReactNode }) {
  const geometries = useHardwareAssets();
  const invalidate = useThree((state) => state.invalidate);
  const groups = useRef(new Map<string, HardwareGroup>()).current;
  const [, bump] = useState(0);
  const registry = useMemo<HardwareRegistry>(() => ({
    register(node, surface, proxy) {
      const key = keyOf(node, surface);
      let group = groups.get(key);
      if (!group) {
        group = { node, surface, set: new Set() };
        groups.set(key, group);
      }
      const members = group;
      members.set.add(proxy);
      bump((v) => v + 1);
      invalidate();
      return () => {
        members.set.delete(proxy);
        if (members.set.size === 0 && groups.get(key) === members) groups.delete(key);
        bump((v) => v + 1);
        invalidate();
      };
    },
  }), [groups, invalidate]);
  const meshes = geometries
    ? [...groups.entries()].flatMap(([key, group]) => {
      const geometry = geometries.get(group.node);
      return geometry && group.set.size ? [{ key, group, geometry }] : [];
    })
    : [];
  return (
    <HardwareRegistryContext.Provider value={registry}>
      {children}
      {meshes.map(({ key, group, geometry }) => (
        <HardwareInstancedMesh key={key} node={group.node} surface={group.surface} geometry={geometry}
          proxies={group.set} capacity={capacityFor(group.set.size)} spec={spec} />
      ))}
    </HardwareRegistryContext.Provider>
  );
}

// true cand nodul are model incarcat SI scena are registru de instante;
// altfel raman primitivele (ex. un canvas fara provider).
export function useHardwareReplacement(): (node: string) => boolean {
  const geometries = useHardwareAssets();
  const registry = useContext(HardwareRegistryContext);
  return useCallback((node: string) => !!registry && !!geometries?.has(node), [registry, geometries]);
}

// Ancora unei piese de feronerie: obiect gol pozitionat ca modelul; mesh-ul
// instantiat ii copiaza transformarea mondiala la fiecare cadru.
export function HardwareInstance({ asset }: { asset: Panel3dAsset }) {
  const registry = useContext(HardwareRegistryContext);
  const ref = useRef<Group>(null);
  const { node, surface } = asset;
  useLayoutEffect(() => {
    const proxy = ref.current;
    if (!registry || !proxy) return;
    return registry.register(node, surface, proxy);
  }, [registry, node, surface]);
  return (
    <group ref={ref} name={`hardware:${node}`} position={asset.mount}
      rotation={[0, 0, asset.rotationZ ?? 0]} scale={asset.scale ?? [1, 1, 1]} />
  );
}

// Panourile unui grup: primitivele (batch static) + ancorele inlocuite de modele GLB.
export function HardwareBatches({ panels, spec }: { panels: readonly Panel3d[]; spec: FinishSpec }) {
  const replaced = useHardwareReplacement();
  const { primitives, anchors } = useMemo(() => splitHardwarePanels(panels, replaced), [panels, replaced]);
  return (
    <>
      <ShowroomBatches panels={primitives} spec={spec} />
      {anchors.map((asset, i) => <HardwareInstance key={`${asset.node}:${i}`} asset={asset} />)}
    </>
  );
}
