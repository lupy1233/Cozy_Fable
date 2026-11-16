import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { defaultPieceConfig, type PieceConfig3d } from '@marketplace/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { FurnitureControls } from './furniture-controls';

vi.mock('./piece-canvas', () => ({ PieceCanvas: () => null }));
const edit = vi.hoisted(() => ({ on: false }));
vi.mock('@/stores/configurator-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/stores/configurator-store')>()),
  isInEditSession: () => edit.on,
}));

// Etapa 9 (l1-3 + pasul 5): masa — doua forme + "Extensibilă" da/nu, diametru pe tip,
// avertisment de persoane, adancimea nu mai sare pe maxim la intoarcerea de la rotund.
const onChange = vi.fn();
function Harness({ initial }: { initial: PieceConfig3d }) {
  const [value, setValue] = useState<PieceConfig3d>(initial);
  return <FurnitureControls piece="TABLE" value={value} onChange={(v) => { onChange(v); setValue(v); }} />;
}
const last = () => onChange.mock.calls.at(-1)?.[0] as PieceConfig3d;
const f = ro.Configurator.flows.PIECE_TABLE;

function setup(patch: Partial<PieceConfig3d>) {
  const base = defaultPieceConfig('TABLE');
  return render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <Harness initial={{ ...base, ...patch }} />
    </NextIntlClientProvider>,
  );
}

describe('FurnitureControls — masa', () => {
  beforeEach(() => {
    onChange.mockClear();
    edit.on = false;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('formele sunt doua; "Extensibilă" e bifa separata si se salveaza ca EXTENDABLE', () => {
    setup({ widthM: 1.8, depthM: 0.9 });
    const shape = screen.getByRole('combobox', { name: f.shape.title });
    expect([...(shape as HTMLSelectElement).options].map((o) => o.value)).toEqual(['RECTANGULAR', 'ROUND']);
    const extendable = screen.getByRole('checkbox', { name: f.shape.options.EXTENDABLE.label });
    fireEvent.click(extendable);
    expect(last().table?.shape).toBe('EXTENDABLE');
    // forma afisata ramane dreptunghiulara
    expect((shape as HTMLSelectElement).value).toBe('RECTANGULAR');
    fireEvent.click(screen.getByRole('checkbox', { name: f.shape.options.EXTENDABLE.label }));
    expect(last().table?.shape).toBe('RECTANGULAR');
  });

  it('o ciorna veche EXTENDABLE se afiseaza ca dreptunghi + bifa', () => {
    setup({ widthM: 2, depthM: 1, table: { type: 'DINING', shape: 'EXTENDABLE', seats: 'EIGHT_PLUS' } });
    expect((screen.getByRole('combobox', { name: f.shape.title }) as HTMLSelectElement).value).toBe('RECTANGULAR');
    expect(screen.getByRole('checkbox', { name: f.shape.options.EXTENDABLE.label })).toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('6 persoane la 120 cm: avertisment', () => {
    setup({ widthM: 1.2, depthM: 0.8 });
    expect(screen.getByTestId('table-seats-warning')).toBeInTheDocument();
  });

  it('rotund → dreptunghi: adancimea de dinainte revine (nu maximul)', () => {
    setup({ widthM: 1.4, depthM: 0.8 });
    const shape = screen.getByRole('combobox', { name: f.shape.title });
    fireEvent.change(shape, { target: { value: 'ROUND' } });
    expect(last()).toMatchObject({ widthM: 1.4, depthM: 1.4 });
    fireEvent.change(shape, { target: { value: 'RECTANGULAR' } });
    expect(last()).toMatchObject({ widthM: 1.4, depthM: 0.8 });
  });

  it('revizuire m5: ciorna cu masa de cafea rotunda de 180 cm se strange o data la 100 cm, la redeschidere, cu motiv', () => {
    setup({ widthM: 1.8, depthM: 1.8, heightM: 0.45, table: { type: 'COFFEE', shape: 'ROUND' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last()).toMatchObject({ widthM: 1, depthM: 1 });
    expect(screen.getByTestId('table-reasons')).toHaveTextContent('am pus 100 cm');
  });

  it('cerere publicata: masa de cafea rotunda de 180 cm ramane la deschidere; se strange la prima schimbare, cu motiv', () => {
    edit.on = true;
    setup({ widthM: 1.8, depthM: 1.8, heightM: 0.45, table: { type: 'COFFEE', shape: 'ROUND' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: ro.Configurator.config3d.furniture.visualFinish }), { target: { value: 'NUC' } });
    expect(last()).toMatchObject({ widthM: 1, depthM: 1, finish: 'NUC' });
    expect(screen.getByTestId('table-reasons')).toHaveTextContent('am pus 100 cm');
  });

  it('revizuire m6: "Extensibilă" revine dupa ocolul Dining → Cafea → Dining si prin rotund', () => {
    setup({ widthM: 1.8, depthM: 0.9, table: { type: 'DINING', shape: 'EXTENDABLE', seats: 'SIX' } });
    const type = () => screen.getByRole('combobox', { name: f.tableType.title });
    fireEvent.change(type(), { target: { value: 'COFFEE' } });
    expect(last().table?.shape).toBe('RECTANGULAR');
    fireEvent.change(type(), { target: { value: 'DINING' } });
    expect(last().table?.shape).toBe('EXTENDABLE');
    const shape = () => screen.getByRole('combobox', { name: f.shape.title });
    fireEvent.change(shape(), { target: { value: 'ROUND' } });
    expect(last().table?.shape).toBe('ROUND');
    fireEvent.change(shape(), { target: { value: 'RECTANGULAR' } });
    expect(last().table?.shape).toBe('EXTENDABLE');
    // debifata de om: nu mai revine
    fireEvent.click(screen.getByRole('checkbox', { name: f.shape.options.EXTENDABLE.label }));
    fireEvent.change(type(), { target: { value: 'COFFEE' } });
    fireEvent.change(type(), { target: { value: 'DINING' } });
    expect(last().table?.shape).toBe('RECTANGULAR');
  });
});
