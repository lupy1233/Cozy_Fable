'use client';

import type { Panel3d } from '@marketplace/shared';
import { useEffect, useMemo } from 'react';
import { Vector3, type MeshStandardMaterial } from 'three';
import { ROD_COLOR, type FinishSpec } from './finishes';
import { createCushionGeometry, createEllipticGeometry, createCylinderGeometry, createPedestalGeometry, createPipingGeometry } from './showroom-geometry';
import { useShowroomLighting } from './showroom-environment';
import { createBedClothGeometry, createBedPillowGeometry, createHeadboardPadGeometry } from './bed-geometry';
import { createHangerGeometry, createHangerHookGeometry } from './hanger-geometry';
import { createBoardGeometry } from './board-geometry';
import { createSeatCushionGeometry, createTabletopGeometry, createTaperedLegGeometry } from './furniture-profiles';
import { boardGrainOffset } from './showroom-grain';
import { createCatalogGeometry } from './catalog-geometry';

// Aceleasi materiale si muchii in editor, camera si vizualizarea firmei.
// Textura procedurala foloseste coordonate metrice: nu descarca imagini si
// nu intinde fibra cand panoul este redimensionat.
export function ShowroomMaterial({ spec, front = false, surface, grainAxis = 'Y', batched = false, grainOffset = [0, 0, 0] }: {
  spec: FinishSpec; front?: boolean; surface?: Panel3d['surface']; grainAxis?: 'X' | 'Y' | 'Z'; batched?: boolean;
  grainOffset?: [number, number, number];
}) {
  const lighting = useShowroomLighting();
  const fabric = surface === 'FABRIC' || surface === 'BEDDING';
  const grain = !!spec.grain && !surface && !lighting.overview;
  const color = surface === 'HANGER_WOOD' ? '#b28b58' : surface === 'BEDDING' ? '#f4f1e9' : surface === 'FABRIC' ? spec.fabric ?? spec.body : surface === 'ACCENT' ? '#514b42' : front ? spec.front : spec.body;
  const [ox, oy, oz] = grainOffset;
  const fabricType = surface === 'BEDDING' ? 'WOVEN' : spec.fabricType ?? 'WOVEN';
  const compile = useMemo(() => (shader: Parameters<MeshStandardMaterial['onBeforeCompile']>[0]) => {
    if (lighting.overview || (!grain && !fabric)) return;
    shader.uniforms.showroomOffset = { value: new Vector3(ox, oy, oz) };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nuniform vec3 showroomOffset;\nvarying vec3 vShowroomPosition;\nvarying vec3 vShowroomNormal;\n${batched ? 'attribute vec3 showroomPosition;' : ''}`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\nvShowroomPosition = ${batched ? 'showroomPosition' : grain ? 'position + showroomOffset' : 'position'};\nvShowroomNormal = normal;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vShowroomPosition;
      varying vec3 vShowroomNormal;
      float showroomHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float showroomNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(showroomHash(i), showroomHash(i + vec2(1, 0)), f.x),
          mix(showroomHash(i + vec2(0, 1)), showroomHash(i + vec2(1, 1)), f.x), f.y);
      }
    `);
    const coords = grainAxis === 'X'
      ? '(abs(vShowroomNormal.x) > 0.8 ? vShowroomPosition.yz : vec2(abs(vShowroomNormal.y) > abs(vShowroomNormal.z) ? vShowroomPosition.z : vShowroomPosition.y, vShowroomPosition.x))'
      : grainAxis === 'Z'
        ? '(abs(vShowroomNormal.z) > 0.8 ? vShowroomPosition.xy : vec2(abs(vShowroomNormal.y) > abs(vShowroomNormal.x) ? vShowroomPosition.x : vShowroomPosition.y, vShowroomPosition.z))'
        : '(abs(vShowroomNormal.y) > 0.8 ? vShowroomPosition.xz : vec2(abs(vShowroomNormal.z) > abs(vShowroomNormal.x) ? vShowroomPosition.x : vShowroomPosition.z, vShowroomPosition.y))';
    // Filtrarea derivatelor elimina dungile/moire cand piesa devine mica in planul casei.
    const texture = grain ? `
      vec2 wood = ${coords};
      float broad = showroomNoise(wood * vec2(9.0, 1.8));
      float fiber = wood.x * 195.0 + broad * 8.0 + showroomNoise(wood * vec2(28.0, 3.0)) * 2.0;
      float visibility = 1.0 - smoothstep(0.45, 2.5, fwidth(fiber));
      float streak = sin(fiber) * 0.55 + sin(fiber * 2.17 + 1.3) * 0.22;
      float pore = showroomNoise(wood * vec2(340.0, 24.0));
      float poreVisibility = 1.0 - smoothstep(0.3, 1.5, length(fwidth(wood * vec2(340.0, 24.0))));
      diffuseColor.rgb *= 0.87 + broad * 0.2 + streak * 0.028 * visibility + (pore - 0.5) * 0.055 * poreVisibility;
    ` : `
      vec3 thread = vShowroomPosition * ${fabricType === 'BOUCLE' ? '650.0' : '1500.0'};
      vec3 coverage = 1.0 - smoothstep(vec3(0.4), vec3(2.5), fwidth(thread));
      float weave = dot(sin(thread) * coverage, vec3(0.333));
      float slub = showroomNoise(vShowroomPosition.xz * 180.0);
      diffuseColor.rgb *= 0.97 + weave * ${fabricType === 'VELVET' ? '0.012' : '0.045'} + slub * ${fabricType === 'BOUCLE' ? '0.095' : '0.045'};
    `;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${texture}`);
    if (grain) shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + (broad - 0.5) * 0.09, 0.25, 1.0);');
  }, [fabric, fabricType, grain, grainAxis, batched, lighting.overview, ox, oy, oz]);
  const programKey = `${grain ? `showroom-wood-v4-${grainAxis}` : fabric ? `showroom-fabric-v5-${fabricType}` : 'showroom-matte-v2'}-${batched ? 'batch' : 'panel'}-${lighting.overview ? 'overview' : 'detail'}`;
  if (surface === 'CERAMIC' || surface === 'STONE_LIGHT' || surface === 'STONE_DARK' || surface === 'MIRROR' || surface === 'LEG_FINISH')
    return <meshStandardMaterial color={surface === 'LEG_FINISH' ? spec.legColor ?? '#a77d50' : surface === 'STONE_DARK' ? '#444742' : surface === 'MIRROR' ? '#cbd5d9' : '#f1efea'}
      roughness={surface === 'MIRROR' ? 0.12 : surface === 'CERAMIC' ? 0.2 : 0.48} metalness={surface === 'MIRROR' ? 0.92 : 0}
      envMap={lighting.map} envMapIntensity={lighting.intensity} />;
  if (surface === 'METAL' || surface === 'BRASS') return <meshStandardMaterial color={surface === 'BRASS' ? ROD_COLOR : '#8e969c'} roughness={0.3} metalness={0.75}
    envMap={lighting.map} envMapIntensity={lighting.intensity} />;
  if (lighting.overview) return <meshStandardMaterial key={programKey} color={color} roughness={fabric ? 0.92 : spec.roughness}
    envMap={lighting.map} envMapIntensity={lighting.intensity} onBeforeCompile={compile} customProgramCacheKey={() => programKey} />;
  return <meshPhysicalMaterial key={`${programKey}:${grain && !batched ? `${ox}:${oy}:${oz}` : ''}`} color={color} roughness={fabric ? 0.92 : spec.roughness}
    envMap={lighting.map} envMapIntensity={lighting.intensity}
    sheen={fabric ? fabricType === 'VELVET' ? 0.75 : 0.35 : 0} sheenColor="#eee8dd" sheenRoughness={fabricType === 'VELVET' ? 0.55 : 0.85}
    clearcoat={fabric ? 0 : 0.07} clearcoatRoughness={0.55}
    onBeforeCompile={compile} customProgramCacheKey={() => programKey} />;
}

export function ShowroomGeometry({ w, h, d, radius = 0.002 }: { w: number; h: number; d: number; radius?: number }) {
  const { overview } = useShowroomLighting();
  const geometry = useMemo(() => createBoardGeometry(w, h, d, radius, overview), [w, h, d, radius, overview]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

function CushionGeometry({ w, h, d }: { w: number; h: number; d: number }) {
  const geometry = useMemo(() => createCushionGeometry(w, h, d), [w, h, d]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

function EllipticGeometry({ w, h, d, radius }: { w: number; h: number; d: number; radius?: number }) {
  const geometry = useMemo(() => createEllipticGeometry(w, h, d, radius), [w, h, d, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

function DetailGeometry({ panel }: { panel: Panel3d }) {
  const { w, h, d, shape, axis, seamRadius } = panel;
  const { overview } = useShowroomLighting();
  const geometry = useMemo(() => shape === 'TAPERED_LEG' ? createTaperedLegGeometry(w, h, d, overview)
    : shape === 'ROUND_CUSHION' || shape === 'BASIN' || shape === 'ROUND_SHELL' ? createCatalogGeometry(shape, w, h, d, overview)
    : shape === 'TABLETOP' ? createTabletopGeometry(w, h, d, overview)
    : shape === 'SEAT_CUSHION' ? createSeatCushionGeometry(w, h, d, overview)
    : shape === 'PIPING' ? createPipingGeometry(w, h, d, overview, seamRadius)
    : shape === 'HANGER' ? createHangerGeometry(w, h, d) : shape === 'HANGER_HOOK' ? createHangerHookGeometry()
      : shape === 'PEDESTAL' ? createPedestalGeometry(w, h, d, overview) : createCylinderGeometry(w, h, d, axis, overview), [w, h, d, shape, axis, seamRadius, overview]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

function BedGeometry({ panel }: { panel: Panel3d }) {
  const { w, h, d, z, shape } = panel;
  const { overview } = useShowroomLighting();
  const geometry = useMemo(() => shape === 'BED_PILLOW' ? createBedPillowGeometry(w, h, d, overview)
    : shape === 'HEADBOARD_PAD' ? createHeadboardPadGeometry(w, h, d, overview)
      : createBedClothGeometry(w, h, d, z, overview, shape === 'BED_THROW'), [w, h, d, z, shape, overview]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <primitive object={geometry} attach="geometry" />;
}

export function ShowroomPanel({ panel: p, spec }: { panel: Panel3d; spec: FinishSpec }) {
  if (p.role === 'ROD') return <mesh position={[p.x, p.y, p.z]} rotation={[0, 0, Math.PI / 2]} castShadow>
    <cylinderGeometry args={[0.013, 0.013, p.w, 12]} />
    <meshStandardMaterial color={ROD_COLOR} roughness={0.35} metalness={0.7} />
  </mesh>;
  if (p.role === 'LEG' && p.shape !== 'TAPERED_LEG') return <mesh position={[p.x, p.y, p.z]} castShadow receiveShadow>
    <cylinderGeometry args={[Math.min(p.w, p.d) / 2, Math.min(p.w, p.d) * 0.36, p.h, 20]} />
    <ShowroomMaterial spec={spec} grainOffset={boardGrainOffset(p)} />
  </mesh>;
  const front = ['DRAWER_FRONT', 'DOOR_FRONT', 'TILT_FRONT', 'SLIDING_FRONT'].includes(p.role);
  const bedShape = p.shape === 'BED_PILLOW' || p.shape === 'BED_DUVET' || p.shape === 'BED_THROW' || p.shape === 'HEADBOARD_PAD';
  return <mesh position={[p.x, p.y, p.z]} castShadow={p.role !== 'FRONT_BACKDROP'} receiveShadow={p.role !== 'FRONT_BACKDROP'}>
    {bedShape ? <BedGeometry panel={p} /> : p.shape === 'BASIN' || p.shape === 'ROUND_CUSHION' || p.shape === 'ROUND_SHELL' || p.shape === 'TAPERED_LEG' || p.shape === 'TABLETOP' || p.shape === 'SEAT_CUSHION' || p.shape === 'PIPING' || p.shape === 'PEDESTAL' || p.shape === 'CYLINDER' || p.shape === 'HANGER' || p.shape === 'HANGER_HOOK' ? <DetailGeometry panel={p} /> : p.shape === 'ELLIPSE' ? <EllipticGeometry w={p.w} h={p.h} d={p.d} radius={p.radius} /> : p.shape === 'CUSHION' ? <CushionGeometry w={p.w} h={p.h} d={p.d} /> : <ShowroomGeometry w={p.w} h={p.h} d={p.d} radius={p.radius} />}
    {p.role === 'FRONT_BACKDROP' ? <meshStandardMaterial color="#302a24" roughness={1} /> : <ShowroomMaterial spec={spec} front={front} surface={p.surface} grainOffset={boardGrainOffset(p)} grainAxis={p.grainAxis ?? (p.h > p.w && p.h > p.d ? 'Y' : p.d > p.w ? 'Z' : 'X')} />}
  </mesh>;
}
