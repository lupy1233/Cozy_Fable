import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import {
  defaultPieceConfig,
  getFlow,
  initialPieceConfig,
  pieceConfigTotals,
  type Piece3dKind,
  type PieceConfig3d,
} from '@marketplace/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import Configurator3dStepUI from './configurator3d-step';
import { config3dChips } from './config-chips';

vi.mock('./piece-canvas', () => ({ PieceCanvas: () => null, zoneKey: () => '' }));

// Etapa 8 (d2): ce porneste pasul 3D si ce ajunge la firma cand clientul lasa valorile
// implicite (PO d2-2, d2-3). jsdom fara WebGL → modul cu campuri.
const c3 = ro.Configurator.config3d;
const tRo = createTranslator({ locale: 'ro', messages: ro, namespace: 'Configurator' }) as never;

function Harness({ piece, initial, onChange }: { piece: Piece3dKind; initial?: PieceConfig3d; onChange: (c: PieceConfig3d) => void }) {
  const [value, setValue] = useState<PieceConfig3d | undefined>(initial);
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

function setup(piece: Piece3dKind, initial?: PieceConfig3d) {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <Harness piece={piece} initial={initial} onChange={onChange} />
    </NextIntlClientProvider>,
  );
  const last = () => onChange.mock.calls.at(-1)?.[0] as PieceConfig3d;
  return { onChange, last };
}

const pill = (name: string) => screen.getByRole('button', { name });

describe('Configurator 3D — valorile de pornire (d2)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('comoda TV noua porneste cu un rand de sertare si Push; Sumarul nu are „Fronturi cu mâner”', () => {
    const { last } = setup('TV_UNIT');
    expect(last()).toEqual(initialPieceConfig('TV_UNIT'));
    expect(last().columns.every((c) => c.zones[0].type === 'DRAWERS')).toBe(true);
    expect(pill(c3.frontStyles.PUSH)).toHaveAttribute('aria-pressed', 'true');
    const chips = config3dChips(tRo, last(), 'TV_UNIT');
    expect(chips.join(' · ')).not.toMatch(/Fronturi cu mâner/);
    expect(chips).toContain('Deschidere: Push');
  });

  it('comoda TV deschisa (ciorna veche): fara selectorul de deschidere si fara deschidere salvata', () => {
    const { last } = setup('TV_UNIT', { ...defaultPieceConfig('TV_UNIT'), frontStyle: 'HANDLE' });
    expect(screen.queryByText(c3.frontStyleLabel)).toBeNull();
    expect(last().frontStyle).toBeUndefined();
    expect(config3dChips(tRo, last(), 'TV_UNIT').join(' ')).not.toMatch(/mâner/i);
  });

  it('bufet lasat pe implicit → firma primeste sistemul PUSH si „deschidere push”', () => {
    const { last } = setup('SIDEBOARD');
    expect(last().frontStyle).toBe('PUSH');
    const derived = getFlow('PIECE_SIDEBOARD').deriveRoom({ config3d: last(), material: 'PAL' });
    expect(derived.items[0].systems).toContain('PUSH');
    expect(derived.items[0].description).toContain('deschidere push');
  });

  it('ciorna veche de bufet fara deschidere se corecteaza la montare (D5)', () => {
    const old = defaultPieceConfig('SIDEBOARD');
    expect(old.frontStyle).toBeUndefined();
    const { last } = setup('SIDEBOARD', old);
    expect(last()).toEqual({ ...old, frontStyle: 'PUSH' });
  });

  it('dulap nou: usi batante pe toate zonele, „Batante” ales', () => {
    const { last } = setup('WARDROBE');
    expect(pieceConfigTotals(last()).doors).toBeGreaterThan(0);
    expect(pill(c3.doorModes.HINGED)).toHaveAttribute('aria-pressed', 'true');
  });

  it('dulap vechi fara usi: niciuna aleasa; „Batante” pune usile', async () => {
    const { last } = setup('WARDROBE', defaultPieceConfig('WARDROBE'));
    expect(pill(c3.doorModes.HINGED)).toHaveAttribute('aria-pressed', 'false');
    expect(pill(c3.doorModes.SLIDING)).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(pill(c3.doorModes.HINGED));
    expect(pieceConfigTotals(last()).doors).toBeGreaterThan(0);
    expect(pill(c3.doorModes.HINGED)).toHaveAttribute('aria-pressed', 'true');
  });

  it('biblioteca (fara fronturi): fara selectorul de deschidere', () => {
    const { last } = setup('BOOKCASE');
    expect(screen.queryByText(c3.frontStyleLabel)).toBeNull();
    expect(last().frontStyle).toBeUndefined();
  });

  it('„De la capăt” revine la configuratia de pornire noua', async () => {
    const { last } = setup('WARDROBE', { ...defaultPieceConfig('WARDROBE'), finish: 'NUC' });
    await userEvent.click(screen.getByRole('button', { name: c3.reset }));
    expect(last()).toEqual(initialPieceConfig('WARDROBE'));
  });

  it('„Cu mâner” ales ramane in configuratia salvata si apare apasat', async () => {
    const { last } = setup('DRESSER');
    await userEvent.click(pill(c3.frontStyles.HANDLE));
    expect(last().frontStyle).toBe('HANDLE');
    expect(pill(c3.frontStyles.HANDLE)).toHaveAttribute('aria-pressed', 'true');
  });
});
