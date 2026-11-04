'use client';

import { HOUSE_WALL_THICKNESS, buildHouseWallPanels, houseRoomBounds, houseWallPoint, type StudioHouse, type StudioScene, type StudioPiece } from '@marketplace/shared';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { OpeningMeshes, PieceMeshes } from './room-canvas';
import { wallColorOf, floorColorOf } from './palette';
import { ShowroomEnvironment } from '../configurator/piece3d/showroom-environment';
import { HouseCameraRig } from '../configurator/piece3d/stable-orbit-camera';
import { cn } from '@/lib/utils';

function StaticHouseShadows({ house, scenes, pieces, cutaway }: { house: StudioHouse; scenes: StudioScene[]; pieces: Record<string, StudioPiece>; cutaway: boolean }) {
  const gl = useThree((s) => s.gl), invalidate = useThree((s) => s.invalidate);
  // Lumina si mobilierul nu se misca la orbitare; regeneram doar la editare.
  useEffect(() => { gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true; invalidate(); }, [gl, invalidate, house, scenes, pieces, cutaway]);
  return null;
}

export default function HouseCanvas({ house, scenes, pieces, onPiece, cutaway = false, className }: {
  house: StudioHouse; scenes: StudioScene[]; pieces: Record<string, StudioPiece>; onPiece?: (piece: StudioPiece) => void; cutaway?: boolean; className?: string;
}) {
  const panels = useMemo(() => buildHouseWallPanels(house, scenes), [house, scenes]);
  const bounds = scenes.flatMap((s) => house.roomTransforms[s.id] ? [houseRoomBounds(s, house.roomTransforms[s.id])] : []);
  const left = bounds.length ? Math.min(...bounds.map((b) => b.left)) : -2, right = bounds.length ? Math.max(...bounds.map((b) => b.right)) : 2;
  const top = bounds.length ? Math.min(...bounds.map((b) => b.top)) : -2, bottom = bounds.length ? Math.max(...bounds.map((b) => b.bottom)) : 2;
  const cx = (left + right) / 2, cz = (top + bottom) / 2;
  const size = Math.max(right - left, bottom - top, 4);
  const pairedOpenings = new Set(house.connections.map((connection) => `${connection.sceneB}:${connection.openingB}`));
  return <div className={cn('h-[400px] w-full overflow-hidden rounded-xl border border-border-2 sm:h-[520px]', className)} data-wall-mode={cutaway ? 'cutaway' : 'full'}>
    <Canvas shadows dpr={[1, 1.5]} frameloop="demand"
      camera={{ fov: 42, far: 500, near: 0.1 }}>
      <StaticHouseShadows house={house} scenes={scenes} pieces={pieces} cutaway={cutaway} />
      <color attach="background" args={['#f7f3ec']} />
      <ambientLight intensity={0.7} /><hemisphereLight args={['#fffaf4', '#b9af9e', 0.5]} />
      <directionalLight position={[cx + 8, 15, cz + 5]} intensity={1.3} castShadow shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-size} shadow-camera-right={size} shadow-camera-top={size} shadow-camera-bottom={-size} />
      <ShowroomEnvironment overview>{scenes.map((scene) => {
        const transform = house.roomTransforms[scene.id]; if (!transform) return null;
        return <group key={scene.id} position={[transform.x, 0, transform.z]} rotation={[0, transform.rotation * Math.PI / 180, 0]}>
          <mesh position={[0, -0.06, 0]} receiveShadow><boxGeometry args={[scene.room.widthM, 0.12, scene.room.depthM]} /><meshStandardMaterial color={floorColorOf(scene.room.floorColor)} roughness={0.9} /></mesh>
          {scene.placements.map((p) => pieces[p.pieceId] ? <group key={p.id} position={[p.x, 0, p.z]} rotation={[0, p.rotation * Math.PI / 180, 0]}
            onClick={onPiece ? (e) => { e.stopPropagation(); if (e.delta < 5) onPiece(pieces[p.pieceId]); } : undefined}>
            <PieceMeshes piece={pieces[p.pieceId]} />
          </group> : null)}
        </group>;
      })}
      {scenes.flatMap((scene) => {
        const transform = house.roomTransforms[scene.id];
        if (!transform) return [];
        return scene.openings.filter((opening) => !pairedOpenings.has(`${scene.id}:${opening.id}`)).map((opening) => {
          const point = houseWallPoint(scene, transform, opening.wall, opening.offset);
          return <group key={`${scene.id}:${opening.id}`} position={[point.x, 0, point.z]} rotation={[0, Math.atan2(-point.nx, -point.nz), 0]} onClick={(event) => event.stopPropagation()}>
            <OpeningMeshes opening={opening} cx={0} selected={false} interactive={false} onPointerDown={() => undefined} />
          </group>;
        });
      })}</ShowroomEnvironment>
      {panels.map((p, i) => {
        const lower = p.y - p.h / 2, upper = cutaway ? Math.min(p.y + p.h / 2, 0.85) : p.y + p.h / 2;
        if (upper <= lower) return null;
        const scene = scenes.find((s) => s.id === p.sceneId)!;
        return <mesh key={i} position={[p.x, (lower + upper) / 2, p.z]} receiveShadow castShadow onClick={!cutaway ? (event) => event.stopPropagation() : undefined}>
          <boxGeometry args={[p.w, upper - lower, p.d]} /><meshStandardMaterial color={wallColorOf(scene.room.wallColor)} roughness={0.9} />
        </mesh>;
      })}
      <OrbitControls makeDefault enableDamping={false} enablePan maxPolarAngle={Math.PI / 2 - 0.08} />
      <HouseCameraRig size={size} cx={cx} cz={cz} width={right - left + 2 * HOUSE_WALL_THICKNESS} depth={bottom - top + 2 * HOUSE_WALL_THICKNESS} height={Math.max(2.6, ...scenes.map((scene) => scene.room.wallHeightM))} />
    </Canvas>
  </div>;
}
