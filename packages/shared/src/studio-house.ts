import { z } from 'zod';
import type { StudioScene, StudioRotation, StudioWall, StudioOpening } from './studio.schemas';

export const HOUSE_WALL_THICKNESS = 0.09;
export const HOUSE_MAX_CONNECTIONS = 24;
const key = z.string().min(1).max(40);
const rotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
export const houseTransformSchema = z.object({
  floorId: key, x: z.number().finite().min(-100).max(100), z: z.number().finite().min(-100).max(100), rotation,
}).strict();
export const houseConnectionSchema = z.object({ id: key, sceneA: key, openingA: key, sceneB: key, openingB: key }).strict();
export const studioHouseSchema = z.object({
  version: z.literal(1),
  floors: z.array(z.object({ id: key, name: z.string().min(1).max(60) }).strict()).length(1),
  roomTransforms: z.record(houseTransformSchema),
  connections: z.array(houseConnectionSchema).max(HOUSE_MAX_CONNECTIONS),
}).strict();
export type StudioHouse = z.infer<typeof studioHouseSchema>;
export type HouseTransform = z.infer<typeof houseTransformSchema>;
export type HouseConnection = z.infer<typeof houseConnectionSchema>;

const round = (v: number) => Math.round(v * 1000) / 1000;
export function rotateHousePoint(x: number, z: number, angle: StudioRotation): { x: number; z: number } {
  if (angle === 90) return { x: z, z: -x };
  if (angle === 180) return { x: -x, z: -z };
  if (angle === 270) return { x: -z, z: x };
  return { x, z };
}
export function houseWorldPoint(transform: HouseTransform, x: number, z: number) {
  const p = rotateHousePoint(x, z, transform.rotation);
  return { x: round(p.x + transform.x), z: round(p.z + transform.z) };
}
export function houseRoomBounds(scene: StudioScene, transform: HouseTransform) {
  const swap = transform.rotation === 90 || transform.rotation === 270;
  const w = swap ? scene.room.depthM : scene.room.widthM;
  const d = swap ? scene.room.widthM : scene.room.depthM;
  return { x: transform.x, z: transform.z, w, d, left: transform.x - w / 2, right: transform.x + w / 2, top: transform.z - d / 2, bottom: transform.z + d / 2 };
}
export function houseRoomsOverlap(a: StudioScene, ta: HouseTransform, b: StudioScene, tb: HouseTransform): boolean {
  if (ta.floorId !== tb.floorId) return false;
  const first = houseRoomBounds(a, ta), second = houseRoomBounds(b, tb);
  // Aceeasi toleranta de 6mm ca validarea istorica si alinierea usilor comune.
  return Math.min(first.right, second.right) - Math.max(first.left, second.left) > -HOUSE_WALL_THICKNESS + 0.006 &&
    Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > -HOUSE_WALL_THICKNESS + 0.006;
}
export function defaultStudioHouse(scenes: StudioScene[]): StudioHouse {
  let edge = 0;
  const roomTransforms: StudioHouse['roomTransforms'] = {};
  for (const scene of scenes) {
    const x = edge + scene.room.widthM / 2;
    roomTransforms[scene.id] = { floorId: 'ground', x, z: 0, rotation: 0 };
    edge += scene.room.widthM + 1;
  }
  return { version: 1, floors: [{ id: 'ground', name: '1' }], roomTransforms, connections: [] };
}
export function syncHouseRooms(house: StudioHouse, scenes: StudioScene[]): StudioHouse {
  const next = { ...house, roomTransforms: { ...house.roomTransforms } };
  const ids = new Set(scenes.map((s) => s.id));
  for (const id of Object.keys(next.roomTransforms)) if (!ids.has(id)) delete next.roomTransforms[id];
  let right = Math.max(0, ...scenes.flatMap((s) => next.roomTransforms[s.id] ? [houseRoomBounds(s, next.roomTransforms[s.id]).right] : []));
  for (const scene of scenes) if (!next.roomTransforms[scene.id]) {
    next.roomTransforms[scene.id] = { floorId: house.floors[0].id, x: round(right + 1 + scene.room.widthM / 2), z: 0, rotation: 0 };
    right += scene.room.widthM + 1;
  }
  next.connections = house.connections.filter((c) => ids.has(c.sceneA) && ids.has(c.sceneB));
  return next;
}
const normals: Record<StudioWall, { x: number; z: number }> = { N: { x: 0, z: -1 }, S: { x: 0, z: 1 }, W: { x: -1, z: 0 }, E: { x: 1, z: 0 } };
export function houseWallPoint(scene: StudioScene, transform: HouseTransform, wall: StudioWall, offset = 0) {
  const n = normals[wall];
  const normal = rotateHousePoint(n.x, n.z, transform.rotation);
  const point = houseWorldPoint(transform,
    n.x ? n.x * (scene.room.widthM / 2 + HOUSE_WALL_THICKNESS / 2) : offset,
    n.z ? n.z * (scene.room.depthM / 2 + HOUSE_WALL_THICKNESS / 2) : offset);
  return { ...point, nx: normal.x, nz: normal.z };
}
const openingDimensions = (o: StudioOpening) => ({ w: o.w ?? (o.kind === 'DOOR_DOUBLE' ? 1.5 : 0.9), h: o.h ?? 2.05 });
export function houseConnectionValid(c: HouseConnection, house: StudioHouse, scenes: StudioScene[]): boolean {
  if (c.sceneA === c.sceneB) return false;
  const a = scenes.find((s) => s.id === c.sceneA), b = scenes.find((s) => s.id === c.sceneB);
  const ta = house.roomTransforms[c.sceneA], tb = house.roomTransforms[c.sceneB];
  const oa = a?.openings.find((o) => o.id === c.openingA), ob = b?.openings.find((o) => o.id === c.openingB);
  if (!a || !b || !ta || !tb || !oa || !ob || ta.floorId !== tb.floorId) return false;
  if (!['DOOR', 'DOOR_DOUBLE'].includes(oa.kind) || !['DOOR', 'DOOR_DOUBLE'].includes(ob.kind)) return false;
  const pa = houseWallPoint(a, ta, oa.wall, oa.offset), pb = houseWallPoint(b, tb, ob.wall, ob.offset);
  const da = openingDimensions(oa), db = openingDimensions(ob);
  return Math.abs(pa.x - pb.x) < 0.006 && Math.abs(pa.z - pb.z) < 0.006 && pa.nx === -pb.nx && pa.nz === -pb.nz && Math.abs(da.w - db.w) < 0.006 && Math.abs(da.h - db.h) < 0.006;
}
export function houseLayoutErrors(house: StudioHouse, scenes: StudioScene[]): string[] {
  const errors: string[] = [];
  const ids = new Set(scenes.map((s) => s.id));
  if (Object.keys(house.roomTransforms).length !== ids.size) errors.push('ROOM_REFERENCES');
  for (const id of Object.keys(house.roomTransforms)) if (!ids.has(id)) errors.push('ROOM_REFERENCES');
  for (let i = 0; i < scenes.length; i++) {
    const t = house.roomTransforms[scenes[i].id];
    if (!t || t.floorId !== house.floors[0]?.id) { errors.push('ROOM_REFERENCES'); continue; }
    for (let j = i + 1; j < scenes.length; j++) {
      const u = house.roomTransforms[scenes[j].id]; if (!u) continue;
      if (houseRoomsOverlap(scenes[i], t, scenes[j], u)) errors.push('ROOM_OVERLAP');
    }
  }
  const used = new Set<string>();
  const connectionIds = new Set<string>();
  for (const c of house.connections) {
    if (!houseConnectionValid(c, house, scenes)) errors.push('DOOR_CONNECTION');
    if (connectionIds.has(c.id)) errors.push('DUPLICATE_CONNECTION');
    connectionIds.add(c.id);
    for (const endpoint of [`${c.sceneA}:${c.openingA}`, `${c.sceneB}:${c.openingB}`]) {
      if (used.has(endpoint)) errors.push('DUPLICATE_CONNECTION');
      used.add(endpoint);
    }
  }
  return [...new Set(errors)];
}

// Aliniaza doua goluri centrale; camera tinta isi pastreaza rotatia, piesele raman locale.
export function connectHouseRooms(house: StudioHouse, scenes: StudioScene[], sceneA: string, sceneB: string, wallA: StudioWall, id: string): { house: StudioHouse; scenes: StudioScene[] } | null {
  if (sceneA === sceneB || house.connections.length >= HOUSE_MAX_CONNECTIONS) return null;
  const a = scenes.find((s) => s.id === sceneA), b = scenes.find((s) => s.id === sceneB);
  const ta = house.roomTransforms[sceneA], tb = house.roomTransforms[sceneB];
  if (!a || !b || !ta || !tb) return null;
  const pa = houseWallPoint(a, ta, wallA);
  const wallB = (Object.keys(normals) as StudioWall[]).find((wall) => {
    const p = houseWallPoint(b, tb, wall); return p.nx === -pa.nx && p.nz === -pa.nz;
  })!;
  const pb = houseWallPoint(b, tb, wallB);
  const oa: StudioOpening = { id: `ha_${id}`, kind: 'DOOR', wall: wallA, offset: 0 };
  const ob: StudioOpening = { id: `hb_${id}`, kind: 'DOOR', wall: wallB, offset: 0 };
  // Nu sterge ferestre/usi existente pentru a insera conexiunea.
  if ([a, b].some((s, i) => s.openings.length >= 24 || s.openings.some((o) => o.wall === (i ? wallB : wallA) && o.kind !== 'OUTLET' && Math.abs(o.offset) < ((o.w ?? (o.kind === 'DOOR' ? 0.9 : o.kind === 'DOOR_DOUBLE' ? 1.5 : 2)) + 0.9) / 2 + 0.05))) return null;
  const nextScenes = scenes.map((s) => s.id === sceneA ? { ...s, openings: [...s.openings, oa] } : s.id === sceneB ? { ...s, openings: [...s.openings, ob] } : s);
  const next: StudioHouse = {
    ...house,
    roomTransforms: { ...house.roomTransforms, [sceneB]: { ...tb, x: round(tb.x + pa.x - pb.x), z: round(tb.z + pa.z - pb.z) } },
    connections: [...house.connections, { id, sceneA, sceneB, openingA: oa.id, openingB: ob.id }],
  };
  if (houseLayoutErrors(next, nextScenes).length) return null;
  return { house: next, scenes: nextScenes };
}

export function snapHouseTransform(scene: StudioScene, transform: HouseTransform, house: StudioHouse, scenes: StudioScene[]): HouseTransform {
  let next = { ...transform, x: Math.round(transform.x * 100) / 100, z: Math.round(transform.z * 100) / 100 };
  const a = houseRoomBounds(scene, next);
  for (const other of scenes) {
    const ot = house.roomTransforms[other.id]; if (other.id === scene.id || !ot) continue;
    const b = houseRoomBounds(other, ot);
    const xs = [b.left - HOUSE_WALL_THICKNESS - a.w / 2, b.right + HOUSE_WALL_THICKNESS + a.w / 2, b.x];
    const zs = [b.top - HOUSE_WALL_THICKNESS - a.d / 2, b.bottom + HOUSE_WALL_THICKNESS + a.d / 2, b.z];
    for (const x of xs) if (Math.abs(x - next.x) < 0.12) next = { ...next, x: round(x) };
    for (const z of zs) if (Math.abs(z - next.z) < 0.12) next = { ...next, z: round(z) };
  }
  return next;
}

export function updateHouseDoor(house: StudioHouse, scenes: StudioScene[], connectionId: string, sourceOpeningId: string, patch: { w?: number; h?: number; offset?: number }): StudioScene[] | null {
  const connection = house.connections.find((c) => c.id === connectionId); if (!connection) return null;
  const sourceA = connection.openingA === sourceOpeningId;
  const a = scenes.find((s) => s.id === (sourceA ? connection.sceneA : connection.sceneB));
  const b = scenes.find((s) => s.id === (sourceA ? connection.sceneB : connection.sceneA));
  const oa = a?.openings.find((o) => o.id === sourceOpeningId), ob = b?.openings.find((o) => o.id === (sourceA ? connection.openingB : connection.openingA));
  if (!a || !b || !oa || !ob) return null;
  const nextA = { ...oa, ...patch };
  if (![nextA.w ?? 0.9, nextA.h ?? 2.05, nextA.offset].every(Number.isFinite) || (nextA.w ?? 0.9) < 0.6 || (nextA.w ?? 0.9) > 1.2 || (nextA.h ?? 2.05) < 1.9 || (nextA.h ?? 2.05) > 2.4) return null;
  const ta = house.roomTransforms[a.id], tb = house.roomTransforms[b.id];
  const pa = houseWallPoint(a, ta, oa.wall, nextA.offset), pb = houseWallPoint(b, tb, ob.wall, 0);
  const tangentB = rotateHousePoint(ob.wall === 'N' || ob.wall === 'S' ? 1 : 0, ob.wall === 'N' || ob.wall === 'S' ? 0 : 1, tb.rotation);
  const nextB = { ...ob, w: nextA.w, h: nextA.h, offset: round((pa.x - pb.x) * tangentB.x + (pa.z - pb.z) * tangentB.z) };
  for (const [scene, opening] of [[a, nextA], [b, nextB]] as const) {
    const len = opening.wall === 'N' || opening.wall === 'S' ? scene.room.widthM : scene.room.depthM;
    if (Math.abs(opening.offset) + (opening.w ?? 0.9) / 2 > len / 2 - 0.05 || (opening.h ?? 2.05) > scene.room.wallHeightM - 0.05) return null;
    if (scene.openings.some((o) => o.id !== opening.id && o.wall === opening.wall && o.kind !== 'OUTLET' && Math.abs(o.offset - opening.offset) < ((o.w ?? 1.5) + (opening.w ?? 0.9)) / 2 + 0.05)) return null;
  }
  const next = scenes.map((s) => ({ ...s, openings: s.openings.map((o) => o.id === nextA.id ? nextA : o.id === nextB.id ? nextB : o) }));
  return houseConnectionValid(connection, house, next) ? next : null;
}
