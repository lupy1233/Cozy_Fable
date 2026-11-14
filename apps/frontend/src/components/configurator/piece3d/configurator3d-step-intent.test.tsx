import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import {
  defaultPieceConfig,
  editPieceConfig,
  normalizePieceConfig,
  type Piece3dKind,
  type PieceConfig3d,
} from '@marketplace/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import Configurator3dStepUI from './configurator3d-step';

vi.mock('./piece-canvas', () => ({ PieceCanvas: () => null, zoneKey: () => '' }));

// b7: pasul 3D tine intentia clientului — o regula incalcata temporar scoate
// elementul din configuratia SALVATA (curatata), dar el revine cand regula nu
// mai e incalcata; motivul apare ca o linie scurta. (jsdom fara WebGL →
// modul cu campuri.)
const c3 = ro.Configurator.config3d;

function Harness({ piece, onChange }: { piece: Piece3dKind; onChange: (c: PieceConfig3d) => void }) {
  const [value, setValue] = useState<PieceConfig3d>(() => defaultPieceConfig(piece));
  return (
    <Configurator3dStepUI
      piece={piece}
      value={value}
      onChange={(c) => {
        setValue(c);
        onChange(c);
      }}
    />
  );
}

function setup(piece: Piece3dKind) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <Harness piece={piece} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  const last = () => onChange.mock.calls.at(-1)?.[0] as PieceConfig3d;
  const typeDim = async (label: string, text: string) => {
    const input = screen.getByRole('textbox', { name: label });
    await userEvent.clear(input);
    await userEvent.type(input, `${text}{Enter}`);
  };
  return { onChange, last, typeDim };
}

describe('Configurator 3D — intentia clientului (b7)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('dulap: adancime 40 → 60 cm, barele de haine revin pe aceleasi coloane', async () => {
    const { last, typeDim } = setup('WARDROBE');
    const hangingCols = defaultPieceConfig('WARDROBE').columns.map((c) => c.zones[0].fill);
    expect(hangingCols.every((f) => f === 'HANGING')).toBe(true);

    await typeDim(c3.depth, '40');
    // ce se salveaza e configuratia curatata: fara bare
    expect(last().depthM).toBe(0.4);
    expect(last().columns.map((c) => c.zones[0].fill)).toEqual(hangingCols.map(() => undefined));
    expect(screen.getByTestId('cleanup-reasons')).toHaveTextContent(c3.hangingNeeds.replace('{depth}', '55').replace('{height}', '80'));

    await typeDim(c3.depth, '60');
    expect(last().depthM).toBe(0.6);
    expect(last().columns.map((c) => c.zones[0].fill)).toEqual(hangingCols);
    // etapa 8 (d2): dulapul are sertare, deci deschiderea "Push" e scrisa in ce se salveaza
    // etapa 9 (l1-1): sertarele de 2 x 57 cm se strang la 2 x 50 cm (ciorna veche), cu motiv
    expect(last()).toEqual({ ...editPieceConfig('WARDROBE', defaultPieceConfig('WARDROBE')), frontStyle: 'PUSH' });
    expect(normalizePieceConfig('WARDROBE', last())).toEqual(last());
    // revizuire m1: motivul sertarelor apare o data (la redeschidere), nu la fiecare editare
    expect(screen.getByTestId('cleanup-reasons')).toBeEmptyDOMElement();
  });

  it('birou: 2 casetiere, latime 100 → 160 cm, a doua casetiera revine', async () => {
    const { last, typeDim } = setup('DESK');
    await typeDim(c3.width, '160');
    await userEvent.click(screen.getAllByRole('button', { name: c3.more })[0]);
    expect(last().columns).toHaveLength(2);

    await typeDim(c3.width, '100');
    expect(last().widthM).toBe(1);
    expect(last().columns).toHaveLength(1);
    const reason = c3.pedestalsNeedWidth.replace('{width}', '127,1');
    expect(screen.getByTestId('cleanup-reasons')).toHaveTextContent(reason);
    // si butonul "+" dezactivat are motivul sub el
    expect(screen.getAllByRole('button', { name: c3.more })[0]).toBeDisabled();
    expect(screen.getByTestId('column-limit-reason')).toHaveTextContent(reason);

    await typeDim(c3.width, '160');
    expect(last().columns).toHaveLength(2);
    expect(screen.getByTestId('cleanup-reasons')).toBeEmptyDOMElement();
  });

  it('noptiera: inaltime 30 cm scoate sertarul (sub 15 cm); la 55 cm revine', async () => {
    const { last, typeDim } = setup('NIGHTSTAND');
    expect(defaultPieceConfig('NIGHTSTAND').columns[0].zones[0]).toEqual({ type: 'DRAWERS', count: 1 });

    await typeDim(c3.height, '30');
    expect(last().heightM).toBe(0.3);
    expect(last().columns[0].zones[0].type).toBe('OPEN');
    expect(screen.getByTestId('cleanup-reasons')).toHaveTextContent(c3.drawersTooShort.replace('{cm}', '15'));

    await typeDim(c3.height, '55');
    expect(last().columns[0].zones[0]).toEqual({ type: 'DRAWERS', count: 1 });
    expect(screen.getByTestId('cleanup-reasons')).toBeEmptyDOMElement();
  });

  it('comoda: inaltime 50 cm lasa 2 sertare din 3, cu motiv; la 90 cm revin 3', async () => {
    const { last, typeDim } = setup('DRESSER');
    expect(defaultPieceConfig('DRESSER').columns[0].zones[0]).toEqual({ type: 'DRAWERS', count: 3 });

    await typeDim(c3.height, '50');
    expect(last().columns[0].zones[0]).toEqual({ type: 'DRAWERS', count: 2 });
    expect(screen.getByTestId('cleanup-reasons')).toHaveTextContent(
      'Am lăsat 2 sertare: fiecare sertar cere cel puțin 15 cm înălțime.',
    );

    await typeDim(c3.height, '90');
    expect(last().columns[0].zones[0]).toEqual({ type: 'DRAWERS', count: 3 });
    expect(screen.getByTestId('cleanup-reasons')).toBeEmptyDOMElement();
  });

  it('dupa o reincarcare (alt raspuns salvat) porneste de la configuratia salvata', async () => {
    const onChange = vi.fn();
    const saved = { ...defaultPieceConfig('WARDROBE'), depthM: 0.4 };
    const cleaned = { ...saved, columns: saved.columns.map((c) => ({ zones: [{ type: 'OPEN' as const }, c.zones[1]] })) };
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <Configurator3dStepUI piece="WARDROBE" value={cleaned} onChange={onChange} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('cleanup-reasons')).toBeEmptyDOMElement();
    const input = screen.getByRole('textbox', { name: c3.depth });
    await userEvent.clear(input);
    await userEvent.type(input, '60{Enter}');
    // fara intentie in memorie, barele nu apar din senin
    const next = onChange.mock.calls.at(-1)?.[0] as PieceConfig3d;
    expect(next.columns.every((c) => c.zones[0].fill === undefined)).toBe(true);
  });
});
