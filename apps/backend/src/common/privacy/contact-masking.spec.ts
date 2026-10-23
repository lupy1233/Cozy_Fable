import { CONTACT_MASK_TOKEN, type RequestStudioSceneData } from '@marketplace/shared';
import { maskFreeText, maskRoomForFirm, maskSceneData, maskSceneName } from './contact-masking';

// E-admin-platform-45 — mascarea la citire pentru firmele fara acces la contacte.
describe('contact-masking', () => {
  it('maskFreeText: null/undefined → sir gol, dimensiunile raman', () => {
    expect(maskFreeText(null)).toBe('');
    expect(maskFreeText(undefined)).toBe('');
    expect(maskFreeText('Corp 240 x 60 cm')).toBe('Corp 240 x 60 cm');
    expect(maskFreeText('tel 0722 123 456')).toBe(`tel ${CONTACT_MASK_TOKEN}`);
  });

  it('maskRoomForFirm: raspunsuri text + items, fara a atinge restul campurilor', () => {
    const room = {
      id: 'room-1',
      roomType: 'KITCHEN' as const,
      flowVersion: 1,
      lengthM: 3,
      answers: { notes: 'ana@example.com', layout: 'L_SHAPE' } as Record<string, unknown>,
      items: [
        { id: 'i1', name: 'Vitrina 0722123456', description: null, quantity: 1 },
        { id: 'i2', name: 'Corp', description: 'H=2.6m, PAL 18mm', quantity: 2 },
      ],
    };
    const out = maskRoomForFirm(room);
    expect(out.answers).toEqual({ notes: CONTACT_MASK_TOKEN, layout: 'L_SHAPE' });
    expect(out.items[0]).toEqual({ id: 'i1', name: `Vitrina ${CONTACT_MASK_TOKEN}`, description: null, quantity: 1 });
    expect(out.items[1].description).toBe('H=2.6m, PAL 18mm');
    expect(out.lengthM).toBe(3);
    expect(room.answers.notes).toBe('ana@example.com');
    expect(maskRoomForFirm({ ...room, answers: null }).answers).toBeNull();
  });

  it('maskSceneName ramane in limita de 60 de caractere', () => {
    expect(maskSceneName('Living 0722123456')).toBe(`Living ${CONTACT_MASK_TOKEN}`);
    const long = `${'x'.repeat(55)} a@b.co`;
    expect(maskSceneName(long).length).toBeLessThanOrEqual(60);
  });

  it('maskSceneData: numele scenei si ale pieselor', () => {
    const data = {
      scene: { id: 's', name: 'Hol www.mobila-ana.ro' },
      pieces: { p1: { id: 'p1', name: 'Dulap @ana.design' } },
    } as unknown as RequestStudioSceneData;
    const out = maskSceneData(data) as unknown as { scene: { name: string }; pieces: Record<string, { name: string }> };
    expect(out.scene.name).toBe(`Hol ${CONTACT_MASK_TOKEN}`);
    expect(out.pieces.p1.name).toBe(`Dulap ${CONTACT_MASK_TOKEN}`);
    expect(maskSceneData({} as RequestStudioSceneData)).toEqual({});
  });
});
