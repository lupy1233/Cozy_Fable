import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { defaultPieceConfig, type PieceConfig3d } from '@marketplace/shared';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { config3dKey, snapshot3dStatus } from '@/stores/snapshot3d';
import Configurator3dStepUI from './configurator3d-step';
import { sceneBottomAfterScroll, zonePanelScrollDelta } from './sticky-scene';

// Revizuire M1 / m7: corectarea automata "Push" de la montare ruleaza doar pe ciorne; la
// editarea unei cereri publicate configuratia ramane cum a fost publicata pana cand omul
// schimba ceva la piesa. Pe ciorna, configuratia corectata face imaginea 3D veche si o reface.

const edit = vi.hoisted(() => ({ on: false }));
vi.mock('@/stores/configurator-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/configurator-store')>()),
  isInEditSession: () => edit.on,
}));
// scena falsa care da o functie de captura (ca PieceCanvas cu WebGL)
vi.mock('./piece-canvas', () => ({
  zoneKey: () => '',
  PieceCanvas: ({ onSnapshotReady }: { onSnapshotReady?: (fn: () => string) => void }) => {
    useEffect(() => onSnapshotReady?.(() => 'data:image/png;base64,AAAA'), [onSnapshotReady]);
    return null;
  },
}));

const c3 = ro.Configurator.config3d;
// ciorna / cererea publicata inainte de etapa 8: bufet cu usi, fara deschidere salvata
const old = defaultPieceConfig('SIDEBOARD');
// camera cu imaginea facuta pe configuratia veche
const room = (config: PieceConfig3d) => ({
  roomType: 'PIECE_SIDEBOARD' as const,
  flowVersion: 2,
  answers: { config3d: config, snapshot3d: ['att-1'] },
  snapshot3dKey: config3dKey(old),
});

function Harness({ onChange, onSnapshot }: { onChange: (c: PieceConfig3d) => void; onSnapshot: (d: string | null) => void }) {
  const [value, setValue] = useState<PieceConfig3d>(old);
  return (
    <Configurator3dStepUI
      piece="SIDEBOARD"
      value={value}
      onChange={(c) => {
        setValue(c);
        onChange(c);
      }}
      onSnapshot={onSnapshot}
    />
  );
}

function setup() {
  const onChange = vi.fn();
  const onSnapshot = vi.fn();
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <Harness onChange={onChange} onSnapshot={onSnapshot} />
    </NextIntlClientProvider>,
  );
  return { onChange, onSnapshot };
}

describe('Configurator 3D — ciorna vs editarea unei cereri publicate (M1)', () => {
  beforeEach(() => {
    // "WebGL" prezent → modul 3D, cu captura dupa 800 ms
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
  });
  afterEach(() => {
    edit.on = false;
    vi.useRealTimers();
  });

  it('editare fara atingerea piesei: configuratia nu se schimba, imaginea ramane a ei', () => {
    edit.on = true;
    const { onChange } = setup();
    expect(old.frontStyle).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
    // nimic scris in raspunsuri → ciorna nemodificata, imaginea publicata ramane "fresh"
    expect(snapshot3dStatus(room(old))).toBe('fresh');
  });

  it('editare: cand omul schimba ceva la piesa, regula se aplica atunci', async () => {
    edit.on = true;
    const { onChange } = setup();
    await userEvent.click(screen.getByRole('button', { name: c3.modeFields }));
    await userEvent.click(screen.getByRole('button', { name: c3.finishes.NUC }));
    const saved = onChange.mock.calls.at(-1)?.[0] as PieceConfig3d;
    expect(saved.finish).toBe('NUC');
    expect(saved.frontStyle).toBe('PUSH');
  });

  it('ciorna: "Push" pus automat face imaginea veche si o reface (captura noua)', () => {
    vi.useFakeTimers();
    const { onChange, onSnapshot } = setup();
    const fixed = onChange.mock.calls.at(-1)?.[0] as PieceConfig3d;
    expect(fixed).toEqual({ ...old, frontStyle: 'PUSH' });
    expect(snapshot3dStatus(room(fixed))).toBe('stale');
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(onSnapshot).toHaveBeenLastCalledWith('data:image/png;base64,AAAA');
  });
});

describe('zonePanelScrollDelta (M2)', () => {
  // scena lipita se termina la 400 px; ecran de 844 px
  it('panoul ascuns sub scena → derulare in sus pana sub scena', () => {
    expect(zonePanelScrollDelta({ top: 100, bottom: 300 }, 400, 844)).toBe(100 - 408);
  });
  it('panoul sub ecran → derulare in jos cat sa intre intreg', () => {
    expect(zonePanelScrollDelta({ top: 700, bottom: 900 }, 400, 844)).toBe(900 - 836);
  });
  it('panoul mai inalt decat spatiul ramas → aliniat sus, sub scena', () => {
    expect(zonePanelScrollDelta({ top: 600, bottom: 1300 }, 400, 844)).toBe(600 - 408);
  });
  it('panoul deja vizibil intreg → fara derulare', () => {
    expect(zonePanelScrollDelta({ top: 420, bottom: 800 }, 400, 844)).toBe(0);
  });
});

// verificarea in browser (etapa 8): cu pagina sus, scena nu e inca lipita sub antet
describe('sceneBottomAfterScroll', () => {
  it('scena lipita deja (sau fara pozitie lipita) → marginea ei de acum', () => {
    expect(sceneBottomAfterScroll({ bottom: 398, height: 340 }, 58)).toBe(398);
    expect(sceneBottomAfterScroll({ bottom: 700, height: 340 }, null)).toBe(700);
    expect(sceneBottomAfterScroll({ bottom: 700, height: 340 }, Number.NaN)).toBe(700);
  });
  it('scena inca nelipita → pozitia ei de dupa derulare, sub antet', () => {
    expect(sceneBottomAfterScroll({ bottom: 700, height: 340 }, 58)).toBe(398);
  });
  it('cu scena nelipita, panoul de sub ecran vine intreg intre scena si marginea de jos', () => {
    // scena 360–700, panoul 741–1139, ecran 844, antet 58: inainte pagina se misca doar 33 px
    const sceneBottom = sceneBottomAfterScroll({ bottom: 700, height: 340 }, 58);
    expect(zonePanelScrollDelta({ top: 741, bottom: 1139 }, sceneBottom, 844)).toBe(1139 - 836);
  });
});
