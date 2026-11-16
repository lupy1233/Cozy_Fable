import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { defaultPieceConfig, initialPieceConfig, PIECE3D_RULES, type Piece3dKind, type PieceConfig3d } from '@marketplace/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import Configurator3dStepUI from './configurator3d-step';

vi.mock('./piece-canvas', () => ({ PieceCanvas: () => null, zoneKey: () => '' }));
const edit = vi.hoisted(() => ({ on: false }));
vi.mock('@/stores/configurator-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/configurator-store')>()),
  isInEditSession: () => edit.on,
}));

// Etapa 9 (l1): ciornele in afara limitelor noi se ajusteaza o data la redeschidere, cu motiv;
// tipurile de zona apar mereu in ordinea Deschis · Sertare · Usa. (jsdom fara WebGL → campuri.)
const c3 = ro.Configurator.config3d;

function setup(piece: Piece3dKind, initial: PieceConfig3d) {
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState<PieceConfig3d>(initial);
    return <Configurator3dStepUI piece={piece} value={value} onChange={(c) => { setValue(c); onChange(c); }} />;
  }
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <Harness />
    </NextIntlClientProvider>,
  );
  return { onChange, last: () => onChange.mock.calls.at(-1)?.[0] as PieceConfig3d };
}

describe('Configurator 3D — regulile etapei 9', () => {
  beforeEach(() => {
    edit.on = false;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('revizuire m1: motivul sertarelor apare la redeschiderea ciornei si dispare la urmatoarea editare', async () => {
    const { last } = setup('WARDROBE', defaultPieceConfig('WARDROBE'));
    const reason = c3.drawerFrontMax.replace('{cm}', '50');
    expect(last().columns[0].zones[1]).toMatchObject({ type: 'DRAWERS', count: 2, heightM: 1 });
    expect(screen.getByTestId('cleanup-reasons')).toHaveTextContent(reason);
    await userEvent.click(screen.getByRole('button', { name: c3.finishes.NUC }));
    expect(last().finish).toBe('NUC');
    expect(last().columns[0].zones[1]).toMatchObject({ count: 2, heightM: 1 });
    expect(screen.getByTestId('cleanup-reasons')).toBeEmptyDOMElement();
    await userEvent.click(screen.getByRole('button', { name: c3.finishes.ALB }));
    expect(screen.getByTestId('cleanup-reasons')).toBeEmptyDOMElement();
  });

  it('revizuire M1: omul scrie 50 cm la randul de sertare blocat de regula la 100 cm → ramane 50', async () => {
    const { last } = setup('WARDROBE', initialPieceConfig('WARDROBE'));
    const row = screen.getAllByRole('textbox', { name: c3.rowHeight })[1];
    expect(row).toHaveValue('100');
    await userEvent.clear(row);
    await userEvent.type(row, '50{Enter}');
    expect(last().columns[0].zones[1]).toMatchObject({ count: 2, heightM: 0.5 });
    expect(screen.getAllByRole('textbox', { name: c3.rowHeight })[1]).toHaveValue('50');
    expect(screen.getByTestId('cleanup-reasons')).toBeEmptyDOMElement();
  });

  it('revizuire m3: in coloana doar cu sertare, mai putine sertare decat minimul nu se accepta (cu motiv)', async () => {
    const dresser: PieceConfig3d = { ...defaultPieceConfig('DRESSER'), heightM: 1.4, widthM: 0.8, columns: [{ zones: [{ type: 'DRAWERS', count: 3 }] }] };
    const { last } = setup('DRESSER', dresser);
    const count = screen.getByRole('textbox', { name: c3.countLabel });
    await userEvent.clear(count);
    await userEvent.type(count, '2');
    await userEvent.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('3–');
    expect(last()?.columns[0].zones[0].count ?? 3).toBe(3);
  });

  it('cerere publicata in afara limitelor: deschiderea nu schimba nimic; o schimbare aplica regulile, cu motiv', async () => {
    edit.on = true;
    const tv25: PieceConfig3d = { ...defaultPieceConfig('TV_UNIT'), heightM: 0.25 };
    const { onChange, last } = setup('TV_UNIT', tv25);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: c3.finishes.NUC }));
    expect(last()).toMatchObject({ finish: 'NUC', heightM: 0.35 });
    expect(screen.getByTestId('cleanup-reasons')).toHaveTextContent(c3.tvUnitMinHeight.replaceAll('{cm}', '35'));
  });

  it('cerere publicata: dulapul cu sertare de 57 cm nu se rescrie la deschidere', () => {
    edit.on = true;
    const { onChange } = setup('WARDROBE', defaultPieceConfig('WARDROBE'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('comoda TV de 25 cm (ciorna veche) urca la 35 cm, cu motiv', () => {
    const { last } = setup('TV_UNIT', { ...defaultPieceConfig('TV_UNIT'), heightM: 0.25 });
    expect(last().heightM).toBe(0.35);
    expect(screen.getByTestId('cleanup-reasons')).toHaveTextContent(c3.tvUnitMinHeight.replaceAll('{cm}', '35'));
  });

  it('biblioteca cu coloane de peste 80 cm primeste o coloana in plus, cu motiv', () => {
    const wide: PieceConfig3d = { ...defaultPieceConfig('BOOKCASE'), widthM: 3, columns: Array.from({ length: 3 }, () => PIECE3D_RULES.BOOKCASE.defaultColumn()) };
    const { last } = setup('BOOKCASE', wide);
    expect(last().columns).toHaveLength(4);
    expect(screen.getByTestId('cleanup-reasons')).toHaveTextContent(
      c3.columnsFitWidth.replace('{min}', '22').replace('{max}', '80'),
    );
  });

  it('o ciorna in limite nu se rescrie', () => {
    const { onChange } = setup('BOOKCASE', defaultPieceConfig('BOOKCASE'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('pantofar: tipurile de zona apar Deschis · Sertare · Usa (implicitul ramane Usa)', () => {
    setup('SHOE_CABINET', defaultPieceConfig('SHOE_CABINET'));
    const typeSelect = screen
      .getAllByRole('combobox')
      .find((s) => [...(s as HTMLSelectElement).options].some((o) => o.value === 'DOOR')) as HTMLSelectElement;
    expect([...typeSelect.options].map((o) => o.value)).toEqual(['OPEN', 'DRAWERS', 'DOOR']);
    expect(typeSelect.value).toBe('DOOR');
  });
});
