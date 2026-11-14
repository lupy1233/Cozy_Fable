import type { ProcessedRoom } from './configurator.service';
import { RequestsService } from './requests.service';

// c11 (etapa 12): titlul generat al cererii foloseste glosarul de piese — „Altă piesă”,
// „Noptieră / Noptiere” dupa numar, piesa „Birou de lucru” fata de camera „Birou” (PO c11-1).
// Titlul se genereaza la publicare / editare; cererile publicate isi pastreaza titlul salvat.
describe('RequestsService — titlul generat al cererii (c11)', () => {
  const service = new RequestsService(
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  const title = (rooms: ProcessedRoom[], city = 'Cluj-Napoca'): string =>
    (service as unknown as { buildRequestTitle(r: ProcessedRoom[], c: string): string }).buildRequestTitle(rooms, city);
  const room = (roomType: string, answers: Record<string, unknown> = {}): ProcessedRoom =>
    ({ roomType, flowVersion: 1, answers, derived: {}, scoreEntries: [] }) as unknown as ProcessedRoom;

  it('o noptieră: singular', () => {
    expect(title([room('PIECE_NIGHTSTAND', { count: 'ONE' })])).toBe('Noptieră — Cluj-Napoca');
  });

  it('două noptiere: pluralul cu numar (perechea din „Câte noptiere?”, implicit doua)', () => {
    expect(title([room('PIECE_NIGHTSTAND', { count: 'TWO' })])).toBe('2 Noptiere — Cluj-Napoca');
    expect(title([room('PIECE_NIGHTSTAND')])).toBe('2 Noptiere — Cluj-Napoca');
    expect(title([room('PIECE_NIGHTSTAND', { count: 'ONE' }), room('PIECE_NIGHTSTAND', { count: 'ONE' })])).toBe(
      '2 Noptiere — Cluj-Napoca',
    );
  });

  it('altă piesă: „Altă piesă”, nu „Piese individuale”; mai multe randuri → plural', () => {
    expect(title([room('PIECES', { pieces: [{ name: 'Raft' }] })])).toBe('Altă piesă — Cluj-Napoca');
    expect(title([room('PIECES')])).toBe('Altă piesă — Cluj-Napoca');
    expect(title([room('PIECES', { pieces: [{ name: 'Raft' }, { name: 'Cuier' }] })])).toBe('2 Alte piese — Cluj-Napoca');
  });

  it('camera Birou + piesa Birou de lucru nu se mai confunda', () => {
    expect(title([room('OFFICE'), room('PIECE_DESK')])).toBe('Birou + Birou de lucru — Cluj-Napoca');
    expect(title([room('PIECE_DESK'), room('PIECE_DESK')], '')).toBe('2 Birouri de lucru');
  });

  it('restul ramane ca inainte (camere, Debara, oras gol)', () => {
    expect(title([room('KITCHEN'), room('PANTRY'), room('BEDROOM'), room('BEDROOM')])).toBe(
      'Bucătărie + Debara + 2 Dormitoare — Cluj-Napoca',
    );
  });
});
