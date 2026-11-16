import { describe, expect, it } from 'vitest';
import type { AnswerMap } from '../types';
import { balconyFlow } from './balcony';
import { balconyFlowV2 } from './balcony.v2';
import { balconyFlowV3 } from './balcony.v3';
import { BALCONY_OPEN_NOTE, balconyFlowV4 } from './balcony.v4';

// Etapa 12 (c13, PO c13-1): la balcon deschis fiecare piesa primeste in descrierea pentru firma
// "Balcon deschis — exterior". Doar pe v4; v1–v3 raman neschimbate.

const base: AnswerMap = {
  piecesNeeded: ['STORAGE_BENCH', 'SHELVES'],
  sameFinishAll: false,
  materialStorageBench: 'LEMN_MASIV',
  systemsStorageBench: ['MANER'],
  materialShelves: 'PAL',
  dimensions: { balconyLength: 3, balconyDepth: 1, storageBenchWidth: 1.2, shelvesWidth: 0.8 },
};

describe('balcon v4 — nota de exterior pentru firma', () => {
  it('balcon deschis: nota apare prima, pe fiecare piesa', () => {
    const { items } = balconyFlowV4.deriveRoom({ ...base, enclosed: 'OPEN' });
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.description?.startsWith(BALCONY_OPEN_NOTE)).toBe(true);
    }
    // notele existente raman dupa ea
    expect(items[0].description).toBe(`${BALCONY_OPEN_NOTE}; Corp: PAL standard`);
    expect(items[1].description).toBe(BALCONY_OPEN_NOTE);
  });

  it('balcon inchis: descrierile raman ca inainte', () => {
    const { items } = balconyFlowV4.deriveRoom({ ...base, enclosed: 'ENCLOSED' });
    expect(items[0].description).toBe('Corp: PAL standard');
    expect(items[1].description).toBeUndefined();
  });

  it('versiunile vechi nu primesc nota', () => {
    for (const flow of [balconyFlow, balconyFlowV2, balconyFlowV3]) {
      const { items } = flow.deriveRoom({ ...base, enclosed: 'OPEN', material: 'LEMN_MASIV' });
      for (const item of items) expect(item.description ?? '').not.toContain(BALCONY_OPEN_NOTE);
    }
  });
});
