import { CURRENT_FLOW_VERSION, MAX_REQUEST_ROOMS, MAX_STUDIO_DRAFT_BYTES, REQUEST_STUDIO_SCENES_MAX, studioDraftDataSchema, studioScenePlacementIssues, type StudioDraftData, type RequestStudioSceneData, type Piece3dKind, type RoomType } from '@marketplace/shared';
import type { RoomInstance } from './configurator-store';

const roomTypes: Record<Piece3dKind, RoomType> = { BOOKCASE: 'PIECE_BOOKCASE', WARDROBE: 'PIECE_WARDROBE', TV_UNIT: 'PIECE_TV_UNIT', SHOE_CABINET: 'PIECE_SHOE_CABINET', DRESSER: 'PIECE_DRESSER', NIGHTSTAND: 'PIECE_NIGHTSTAND', DESK: 'PIECE_DESK', BED: 'PIECE_BED', TABLE: 'PIECE_TABLE', BENCH: 'PIECE_BENCH', SIDEBOARD: 'PIECE_SIDEBOARD', WALL_CABINET: 'PIECE_WALL_CABINET', BATHROOM_VANITY: 'PIECE_BATHROOM_VANITY', ENTRYWAY: 'PIECE_ENTRYWAY', SOFA: 'PIECE_SOFA', ARMCHAIR: 'PIECE_ARMCHAIR', OTTOMAN: 'PIECE_OTTOMAN' };
export type StudioTransferResult = { ok: true; roomInstances: RoomInstance[]; studioScenes: RequestStudioSceneData[]; count: number } | { ok: false; error: 'INVALID_LAYOUT' | 'CAPACITY' | 'EMPTY' };

export function invalidStudioRequestEntries(snapshots: RequestStudioSceneData[]): Set<string> {
  return new Set(snapshots.flatMap(snapshot => !snapshot.requestEntryIds ? [] : studioScenePlacementIssues(snapshot.scene, snapshot.pieces)
    .flatMap(issue => snapshot.requestEntryIds?.[issue.placementId] ? [snapshot.requestEntryIds[issue.placementId]] : [])));
}

// Aceeasi piesa poate avea mai multe unitati; o corectie din chestionar
// modifica doar unitatea corespunzatoare.
export function synchronizeStudioSnapshots(snapshots: RequestStudioSceneData[], rooms: RoomInstance[]): RequestStudioSceneData[] {
  return snapshots.map((snapshot) => {
    if (!snapshot.requestEntryIds) return snapshot;
    const pieces: RequestStudioSceneData['pieces'] = {};
    const requestEntryIds: Record<string, string> = {};
    const placements = snapshot.scene.placements.flatMap((placement) => {
      const localId = snapshot.requestEntryIds?.[placement.id];
      const room = rooms.find((r) => r.localId === localId);
      const piece = snapshot.pieces[placement.pieceId];
      if (!room || !piece) return [];
      const config = room.answers.config3d;
      if (!config || typeof config !== 'object' || !('columns' in config)) return [];
      const id = `cfg_${room.localId.slice(0, 36)}`;
      pieces[id] = { ...piece, id, config: config as typeof piece.config };
      requestEntryIds[placement.id] = room.localId;
      return [{ ...placement, pieceId: id }];
    });
    return { ...snapshot, scene: { ...snapshot.scene, placements }, pieces, requestEntryIds };
  });
}

export function prepareStudioTransfer(data: StudioDraftData, currentRooms: RoomInstance[], currentScenes: RequestStudioSceneData[], id: () => string): StudioTransferResult {
  if (!studioDraftDataSchema.safeParse(data).success) return { ok: false, error: 'INVALID_LAYOUT' };
  const scenes = data.house ? data.scenes : data.scenes.filter((s) => s.id === data.activeSceneId);
  const sourceIds = new Set(scenes.map((s) => s.id));
  const previousHouseSceneIds = data.house ? new Set(currentScenes.filter((s) => s.house).map((s) => s.scene.id)) : new Set<string>();
  const retained = currentRooms.filter((r) => !r.sourceStudio || (!sourceIds.has(r.sourceStudio.sceneId) && !previousHouseSceneIds.has(r.sourceStudio.sceneId)));
  const count = scenes.reduce((n, s) => n + s.placements.length, 0);
  if (!count) return { ok: false, error: 'EMPTY' };
  if (retained.length + count > MAX_REQUEST_ROOMS) return { ok: false, error: 'CAPACITY' };
  if (scenes.some(scene => studioScenePlacementIssues(scene, data.pieces).length)) return { ok: false, error: 'INVALID_LAYOUT' };
  const generated: RoomInstance[] = [];
  const snapshots: RequestStudioSceneData[] = [];
  for (const scene of scenes) {
    const pieces: RequestStudioSceneData['pieces'] = {};
    const requestEntryIds: Record<string, string> = {};
    for (const placement of scene.placements) {
      const piece = data.pieces[placement.pieceId];
      if (!piece) return { ok: false, error: 'INVALID_LAYOUT' };
      const previous = currentRooms.find((r) => r.sourceStudio?.sceneId === scene.id && r.sourceStudio.placementId === placement.id);
      const roomType = roomTypes[piece.kind];
      const localId = previous?.localId ?? id();
      requestEntryIds[placement.id] = localId;
      const changed = !previous || previous.roomType !== roomType || JSON.stringify(previous.answers.config3d) !== JSON.stringify(piece.config);
      const answers = { ...(previous?.roomType === roomType ? previous.answers : {}), config3d: piece.config, ...(piece.kind === 'NIGHTSTAND' ? { count: 'ONE' } : {}) };
      if (changed) delete (answers as Record<string, unknown>).snapshot3d;
      generated.push({ localId, roomType, flowVersion: CURRENT_FLOW_VERSION[roomType], answers, completed: changed ? false : previous.completed, sourceStudio: { sceneId: scene.id, placementId: placement.id } });
      pieces[piece.id] = piece;
    }
    snapshots.push({ scene, pieces, ...(data.house ? { house: data.house } : {}), requestEntryIds, requestEntryIdKind: 'LOCAL' });
  }
  const studioScenes = [...currentScenes.filter((s) => !sourceIds.has(s.scene.id) && !previousHouseSceneIds.has(s.scene.id)), ...snapshots];
  if (studioScenes.length > REQUEST_STUDIO_SCENES_MAX || new TextEncoder().encode(JSON.stringify(studioScenes)).byteLength > MAX_STUDIO_DRAFT_BYTES) return { ok: false, error: 'CAPACITY' };
  return { ok: true, roomInstances: [...retained, ...generated], studioScenes, count };
}
