import type { ItemSystem, Material } from '../../../enums';
import { NEW_PIECE_KINDS, PIECE3D_RULES, pieceConfig3dSchema, describePieceConfig } from '../../piece3d';
import type { RoomFlow } from '../../types';
import { otherMaterialStep } from '../common';
import { pieceMaterialStep, pieceSketchStep } from './builder';
import { snapshot3dStep } from './v3';

type CatalogRoomType = `PIECE_${typeof NEW_PIECE_KINDS[number]}`;
export const catalogFlowRegistry = {} as Record<CatalogRoomType, Record<number, RoomFlow>>;
export const catalogFlowVersions = {} as Record<CatalogRoomType, number>;
for (const kind of NEW_PIECE_KINDS) {
  const roomType: CatalogRoomType = `PIECE_${kind}`;
  const key = `flows.${roomType}`;
  const flow: RoomFlow = {
    roomType, version: 1,
    steps: [
      { id: 'config3d', type: 'configurator-3d', piece: kind, titleKey: `${key}.config3d.title`, subtitleKey: `${key}.config3d.subtitle` },
      pieceMaterialStep(key), otherMaterialStep('material', 'material'), pieceSketchStep(key), snapshot3dStep(),
    ],
    deriveRoom: (answers) => {
      const parsed = pieceConfig3dSchema(kind).safeParse(answers.config3d);
      if (!parsed.success) return { lengthM: 0, widthM: 0, heightM: 0, items: [] };
      const config = parsed.data;
      const opening = config.vanity ? (config.vanity.storage === 'OPEN' ? undefined : config.vanity.handles)
        : config.entryway ? (config.entryway.shoeStorage === 'DOORS' ? 'HANDLE' : undefined) : config.frontStyle;
      const systems: ItemSystem[] = opening === 'HANDLE' ? ['MANER'] : opening === 'PUSH' ? ['PUSH'] : [];
      const description = [describePieceConfig(kind, config)];
      if (answers.material === 'ALTUL' && typeof answers.materialOther === 'string' && answers.materialOther.trim()) description.push(`Material dorit: ${answers.materialOther.trim()}`);
      return { lengthM: config.widthM, widthM: config.depthM, heightM: config.heightM,
        items: [{ name: PIECE3D_RULES[kind].itemName, material: (answers.material as Material) ?? 'ALTUL', systems, quantity: 1, description: description.join('; ') }] };
    },
  };
  catalogFlowRegistry[roomType] = { 1: flow };
  catalogFlowVersions[roomType] = 1;
}
