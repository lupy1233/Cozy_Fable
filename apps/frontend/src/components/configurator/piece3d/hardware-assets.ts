'use client';

import { useSyncExternalStore } from 'react';
import type { BufferGeometry, Mesh } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Prototip 2026-10-22: modelele GLB ale feroneriei (generate din Blender, vezi
// shared/showroom-details.ts pentru noduri) se incarca o singura data per
// pagina. Pana atunci, sau daca fisierul lipseste, scena deseneaza
// primitivele de rezerva din shared. Decoderul Draco e servit local din
// public/draco (copiat din three/examples/jsm/libs/draco/gltf).
export const HARDWARE_ASSET_URL = '/3d/hardware.glb';
export const DRACO_DECODER_PATH = '/draco/';

export type HardwareAssetGeometries = ReadonlyMap<string, BufferGeometry>;
export type HardwareAssetStatus = 'idle' | 'loading' | 'ready' | 'error';

let status: HardwareAssetStatus = 'idle';
let geometries: HardwareAssetGeometries | null = null;
const listeners = new Set<() => void>();

function publish() {
  if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
    // QA programatic pe /dev/piece-3d (canvasul nu se vede in preview pane)
    (window as unknown as Record<string, unknown>).__hardwareAssets = {
      status, nodes: geometries ? [...geometries.keys()] : [],
    };
  }
  listeners.forEach((listener) => listener());
}

function load() {
  if (status !== 'idle') return;
  status = 'loading';
  publish();
  const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  loader.load(HARDWARE_ASSET_URL, (gltf) => {
    const map = new Map<string, BufferGeometry>();
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name || mesh.parent?.name;
      if (name && !map.has(name)) map.set(name, mesh.geometry);
    });
    geometries = map;
    status = 'ready';
    draco.dispose();
    publish();
  }, undefined, (error) => {
    status = 'error';
    draco.dispose();
    console.warn('[piece3d] hardware.glb indisponibil, raman primitivele de rezerva', error);
    publish();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => geometries;
const getServerSnapshot = () => null;

// null = inca neincarcat sau indisponibil → primitivele de rezerva
export function useHardwareAssets(): HardwareAssetGeometries | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function hardwareAssetStatus(): HardwareAssetStatus {
  return status;
}
