import { describe, expect, it } from 'vitest';
import { budgetEstimatePayload } from '@/hooks/use-requests';
import type { RoomInstance } from '@/stores/configurator-store';
import { anyRoomNeedsDesignHelp, roomInstanceLabels, toServerRoom } from './room-payload';

const SKETCH = '0b6ad530-3c0f-4c39-8ab1-8a4f3f5d2b6e';
const bedroom = (needsDesignHelp?: boolean): RoomInstance => ({
  localId: 'b1', roomType: 'BEDROOM', flowVersion: 2, completed: true,
  answers: { sketch: [SKETCH], bedSize: 'QUEEN' }, ...(needsDesignHelp === undefined ? {} : { needsDesignHelp }),
});

// b8-3 (PO): camera bifata pleaca doar cu tipul, fisierele ei si bifa
describe('toServerRoom', () => {
  it('sends a flagged room without its answers, keeping only its files', () => {
    expect(toServerRoom(bedroom(true))).toEqual({ roomType: 'BEDROOM', flowVersion: 2, answers: { sketch: [SKETCH] }, needsDesignHelp: true });
  });

  it('sends a regular room unchanged, with an explicit false flag', () => {
    expect(toServerRoom(bedroom())).toEqual({ roomType: 'BEDROOM', flowVersion: 2, answers: bedroom().answers, needsDesignHelp: false });
  });

  // d3 (PO d3-2): lungimea aproximativa pleaca la publicare si la estimare
  // dormitor cu dulap = pas de dimensiuni cu metri liniari (latimea dulapului), fara raspuns
  const wardrobe = { piecesNeeded: ['WARDROBE'] };
  it('sends the approximate length when the room has one (not for a flagged room)', () => {
    expect(toServerRoom({ ...bedroom(), answers: wardrobe, approxLengthM: 8.5 })).toEqual({
      roomType: 'BEDROOM', flowVersion: 2, answers: wardrobe, needsDesignHelp: false, approxLengthM: 8.5,
    });
    expect('approxLengthM' in toServerRoom(bedroom())).toBe(false);
    expect('approxLengthM' in toServerRoom({ ...bedroom(true), answers: wardrobe, approxLengthM: 8.5 })).toBe(false);
  });

  // revizuire M1: dulap → 6 m → clientul lasa doar cadrul de pat: campul dispare, valoarea nu pleaca
  it('does not send a value left over after the room lost its dimensions step', () => {
    expect('approxLengthM' in toServerRoom({ ...bedroom(), answers: { piecesNeeded: ['BED_FRAME'] }, approxLengthM: 6 })).toBe(false);
    // nici cand dimensiunile (ascunse de "Am deja un proiect") dau deja o lungime
    expect('approxLengthM' in toServerRoom({ ...bedroom(), answers: { ...wardrobe, dimensions: { wardrobeWidth: 1.5 } }, approxLengthM: 8 })).toBe(false);
  });

  it('the estimate payload carries the approximate length only when set', () => {
    const [withLength, without] = budgetEstimatePayload([
      toServerRoom({ ...bedroom(), answers: wardrobe, approxLengthM: 8.5 }),
      toServerRoom(bedroom()),
    ]);
    expect(withLength).toEqual({ roomType: 'BEDROOM', flowVersion: 2, answers: wardrobe, approxLengthM: 8.5 });
    expect('approxLengthM' in without).toBe(false);
  });

  it('derives "with design" from the rooms', () => {
    expect(anyRoomNeedsDesignHelp([bedroom(false), bedroom(true)])).toBe(true);
    expect(anyRoomNeedsDesignHelp([bedroom(false)])).toBe(false);
  });

  it('numbers rooms of the same type', () => {
    const labels = roomInstanceLabels(
      [{ localId: 'a', roomType: 'BEDROOM' }, { localId: 'b', roomType: 'BEDROOM' }, { localId: 'c', roomType: 'KITCHEN' }],
      (rt) => rt,
    );
    expect([...labels.values()]).toEqual(['BEDROOM 1', 'BEDROOM 2', 'KITCHEN']);
  });
});
