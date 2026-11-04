'use client';

import type { Panel3d } from '@marketplace/shared';
import { useEffect, useMemo } from 'react';
import { BufferGeometry, CylinderGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ROD_COLOR, type FinishSpec } from './finishes';
import { createCushionGeometry, createEllipticGeometry, createCylinderGeometry, createPedestalGeometry, createPipingGeometry } from './showroom-geometry';
import { ShowroomMaterial } from './showroom-panel';
import { useShowroomLighting } from './showroom-environment';
import { createBedClothGeometry, createBedPillowGeometry, createHeadboardPadGeometry } from './bed-geometry';
import { createHangerGeometry, createHangerHookGeometry } from './hanger-geometry';
import { createBoardGeometry } from './board-geometry';
import { createSeatCushionGeometry, createTabletopGeometry, createTaperedLegGeometry } from './furniture-profiles';
import { boardGrainOffset } from './showroom-grain';
import { createCatalogGeometry } from './catalog-geometry';

type BatchMaterial = 'SHOWROOM' | 'ROD' | 'BACKDROP';
export interface ShowroomBatch {
  key: string;
  geometry: BufferGeometry;
  panelIndices: number[];
  material: BatchMaterial;
  front: boolean;
  surface: Panel3d['surface'];
  grainAxis: 'X' | 'Y' | 'Z';
}

// Profil identic; overview reduce numai teselarea, niciodata panouri sau gabarite.
export function createShowroomPanelGeometry(panel: Panel3d, overview = false): BufferGeometry {
  const { w, h, d } = panel;
  if (panel.shape === 'ROUND_CUSHION' || panel.shape === 'BASIN' || panel.shape === 'ROUND_SHELL') return createCatalogGeometry(panel.shape, w, h, d, overview);
  if (panel.shape === 'TAPERED_LEG') return createTaperedLegGeometry(w, h, d, overview);
  if (panel.shape === 'TABLETOP') return createTabletopGeometry(w, h, d, overview);
  if (panel.shape === 'SEAT_CUSHION') return createSeatCushionGeometry(w, h, d, overview);
  if (panel.role === 'ROD') return new CylinderGeometry(0.013, 0.013, w, 12);
  if (panel.role === 'LEG') return new CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) * 0.36, h, overview ? 12 : 20);
  if (panel.shape === 'CUSHION') return createCushionGeometry(w, h, d, overview);
  if (panel.shape === 'HANGER') return createHangerGeometry(w, h, d);
  if (panel.shape === 'HANGER_HOOK') return createHangerHookGeometry(overview);
  if (panel.shape === 'BED_PILLOW') return createBedPillowGeometry(w, h, d, overview);
  if (panel.shape === 'HEADBOARD_PAD') return createHeadboardPadGeometry(w, h, d, overview);
  if (panel.shape === 'BED_DUVET' || panel.shape === 'BED_THROW') return createBedClothGeometry(w, h, d, panel.z, overview, panel.shape === 'BED_THROW');
  if (panel.shape === 'ELLIPSE') return createEllipticGeometry(w, h, d, panel.radius, overview);
  if (panel.shape === 'CYLINDER') return createCylinderGeometry(w, h, d, panel.axis, overview);
  if (panel.shape === 'PEDESTAL') return createPedestalGeometry(w, h, d, overview);
  if (panel.shape === 'PIPING') return createPipingGeometry(w, h, d, overview, panel.seamRadius);
  const radius = panel.radius ?? 0.002;
  return createBoardGeometry(w, h, d, panel.role === 'FRONT_BACKDROP' ? 0 : radius, overview);
}

function materialFor(panel: Panel3d, overview: boolean, grain: boolean) {
  const material: BatchMaterial = panel.role === 'ROD' ? 'ROD' : panel.role === 'FRONT_BACKDROP' ? 'BACKDROP' : 'SHOWROOM';
  const front = ['DRAWER_FRONT', 'DOOR_FRONT', 'TILT_FRONT', 'SLIDING_FRONT'].includes(panel.role);
  // ShowroomPanel foloseste materialul simplu Y pentru picioarele conice.
  const grainAxis = overview || !grain || panel.surface || panel.role === 'LEG' ? 'Y' : panel.grainAxis ?? (panel.h > panel.w && panel.h > panel.d ? 'Y' : panel.d > panel.w ? 'Z' : 'X');
  const surface = panel.role === 'LEG' ? undefined : panel.surface;
  return { material, front, surface, grainAxis };
}

// Un batch per material in interiorul aceleiasi piese: selectia/rotatia raman la grupul parinte.
export function createShowroomBatches(panels: readonly Panel3d[], overview = false, grain = true): ShowroomBatch[] {
  const groups = new Map<string, { batch: Omit<ShowroomBatch, 'geometry'>; geometries: BufferGeometry[] }>();
  const result: ShowroomBatch[] = [];
  try {
    panels.forEach((panel, index) => {
      const descriptor = materialFor(panel, overview, grain);
      const key = descriptor.material === 'SHOWROOM'
        ? `${descriptor.material}:${descriptor.front}:${descriptor.surface ?? ''}:${descriptor.grainAxis}`
        : descriptor.material;
      let group = groups.get(key);
      if (!group) {
        group = { batch: { key, ...descriptor, panelIndices: [] }, geometries: [] };
        groups.set(key, group);
      }
      const source = createShowroomPanelGeometry(panel, overview);
      let geometry = source;
      if (source.index) {
        geometry = source.toNonIndexed();
        source.dispose();
      }
      group.geometries.push(geometry);
      group.batch.panelIndices.push(index);
      // Textura ramane in coordonatele locale ale panoului, nu in cele ale batchului.
      const textured = !overview && descriptor.material === 'SHOWROOM'
        && ((!descriptor.surface && grain) || descriptor.surface === 'FABRIC' || descriptor.surface === 'BEDDING');
      if (textured) {
        const local = geometry.getAttribute('position').clone();
        if (!descriptor.surface && grain) {
          const [x, y, z] = boardGrainOffset(panel);
          for (let i = 0; i < local.count; i++) local.setXYZ(i, local.getX(i) + x, local.getY(i) + y, local.getZ(i) + z);
        }
        geometry.setAttribute('showroomPosition', local);
      }
      if (panel.role === 'ROD') geometry.rotateZ(Math.PI / 2);
      geometry.translate(panel.x, panel.y, panel.z);
      geometry.clearGroups();
    });
    for (const group of groups.values()) {
      const geometry = mergeGeometries(group.geometries, false);
      if (!geometry) throw new Error('Unable to merge showroom panel geometry');
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      result.push({ ...group.batch, geometry });
    }
    return result;
  } catch (error) {
    result.forEach((batch) => batch.geometry.dispose());
    throw error;
  } finally {
    groups.forEach((group) => group.geometries.forEach((geometry) => geometry.dispose()));
  }
}

export function ShowroomBatches({ panels, spec }: { panels: readonly Panel3d[]; spec: FinishSpec }) {
  const { overview } = useShowroomLighting();
  const batches = useMemo(() => createShowroomBatches(panels, overview, !!spec.grain), [panels, overview, spec.grain]);
  useEffect(() => () => batches.forEach((batch) => batch.geometry.dispose()), [batches]);
  return <>{batches.map((batch) => <mesh key={batch.key} castShadow={batch.material !== 'BACKDROP'} receiveShadow={batch.material === 'SHOWROOM'}>
    <primitive object={batch.geometry} attach="geometry" />
    {batch.material === 'ROD'
      ? <meshStandardMaterial color={ROD_COLOR} roughness={0.35} metalness={0.7} />
      : batch.material === 'BACKDROP'
        ? <meshStandardMaterial color="#302a24" roughness={1} />
        : <ShowroomMaterial spec={spec} front={batch.front} surface={batch.surface} grainAxis={batch.grainAxis} batched />}
  </mesh>)}</>;
}
