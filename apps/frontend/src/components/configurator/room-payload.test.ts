import { describe, expect, it } from 'vitest';
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
