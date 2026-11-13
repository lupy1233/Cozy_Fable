import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { defaultPieceConfig, type PieceConfig3d } from '@marketplace/shared';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import Configurator3dStepUI from './configurator3d-step';

vi.mock('./piece-canvas', () => ({ PieceCanvas: () => null, zoneKey: () => '' }));

// b1: dimensiunile dulapului din 3D (in jsdom fara WebGL → modul cu campuri)
function Harness({ onChange }: { onChange: (c: PieceConfig3d) => void }) {
  const [value, setValue] = useState<PieceConfig3d>(() => defaultPieceConfig('WARDROBE'));
  return (
    <Configurator3dStepUI
      piece="WARDROBE"
      value={value}
      onChange={(c) => {
        setValue(c);
        onChange(c);
      }}
    />
  );
}

function setup() {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="ro" messages={ro}>
      <Harness onChange={onChange} />
    </NextIntlClientProvider>,
  );
  const input = screen.getByRole('textbox', { name: ro.Configurator.config3d.width }) as HTMLInputElement;
  return { input, onChange };
}

describe('Configurator 3D — dimensiuni cu virgula (b1)', () => {
  // jsdom nu are WebGL: getContext → null (fara zgomot in consola)
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('campul de latime e text cu virgula si afiseaza valoarea in cm', () => {
    const { input } = setup();
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('decimal');
    expect(input).not.toHaveAttribute('pattern');
    expect(input.value).toBe('240');
  });

  it('"150,5" ramane 150,5 (1.505 m) si nu se transforma in maxim', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '150,5{Enter}');
    expect((onChange.mock.calls.at(-1)?.[0] as PieceConfig3d).widthM).toBe(1.505);
    expect(input.value).toBe('150,5');
  });

  it('valoarea peste limita e refuzata cu mesaj langa camp, ramane valoarea veche', async () => {
    const { input, onChange } = setup();
    const before = onChange.mock.calls.length;
    await userEvent.clear(input);
    await userEvent.type(input, '700{Enter}');
    expect(onChange.mock.calls.length).toBe(before);
    expect(input.value).toBe('240');
    const field = input.closest('div')!.parentElement!.parentElement as HTMLElement;
    expect(within(field).getByRole('alert')).toHaveTextContent('60–600 cm');
  });

  it('textul care nu e numar arata "Scrie un numar"', async () => {
    const { input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '1,2,3{Enter}');
    expect(screen.getByText(ro.Configurator.validation.notANumber)).toBeVisible();
    expect(input.value).toBe('240');
  });
});
