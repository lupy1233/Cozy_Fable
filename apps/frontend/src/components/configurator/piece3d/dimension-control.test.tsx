import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { initialPieceConfig, type Piece3dKind, type PieceConfig3d } from '@marketplace/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import Configurator3dStepUI from './configurator3d-step';
import { PieceDimensionControl } from './dimension-control';

vi.mock('./piece-canvas', () => ({ PieceCanvas: () => null, zoneKey: () => '' }));

// Etapa 8 (41.4): o singura componenta de dimensiune in toate panourile 3D — aceeasi
// eticheta, acelasi "cm", intervalul formatat langa eticheta, acelasi mesaj de corectare.
const c3 = ro.Configurator.config3d;

function Harness({ piece }: { piece: Piece3dKind }) {
  const [value, setValue] = useState<PieceConfig3d>(() => initialPieceConfig(piece));
  return <Configurator3dStepUI piece={piece} value={value} onChange={setValue} />;
}

const blockOf = (input: HTMLElement) => input.closest('div')!.parentElement!.parentElement as HTMLElement;

describe('PieceDimensionControl', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  // dulap (corp), masa (mobilier), lavoar (catalog)
  it.each([
    ['WARDROBE', '60–600 cm'],
    ['TABLE', '120–300 cm'],
    ['BATHROOM_VANITY', '60–200 cm'],
  ] as const)('%s: latimea are eticheta, intervalul, "cm" si corectarea la minim', async (piece, range) => {
    render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <Harness piece={piece} />
      </NextIntlClientProvider>,
    );
    const input = screen.getByRole('textbox', { name: c3.width }) as HTMLInputElement;
    const block = blockOf(input);
    expect(within(block).getByText(range)).toBeInTheDocument();
    expect(within(block).getByText('cm')).toBeInTheDocument();
    expect(within(block).getByRole('slider', { name: c3.width })).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, '1{Enter}');
    const min = range.split('–')[0];
    expect(within(block).getByRole('status')).toHaveTextContent(c3.dimClampedMin.replaceAll('{value}', min));
  });

  it('intervalul dupa limba: virgula in ro, punct in en', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <PieceDimensionControl label="L" minM={0.455} maxM={1.2} valueM={0.8} onValueM={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('45,5–120 cm')).toBeInTheDocument();
    unmount();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <PieceDimensionControl label="L" minM={0.455} maxM={1.2} valueM={0.8} onValueM={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('45.5–120 cm')).toBeInTheDocument();
  });
});
