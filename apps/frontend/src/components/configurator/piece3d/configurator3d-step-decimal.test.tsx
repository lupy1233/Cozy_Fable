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

// blocul campului (eticheta + camp + mesaje)
const fieldOf = (input: HTMLElement) => input.closest('div')!.parentElement!.parentElement as HTMLElement;

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

  // b7 (accesibilitate): regiunea de mesaje exista INAINTE de mesaj, goala,
  // legata de camp — cititoarele de ecran anunta textul cand apare
  it('regiunea role=status a campului e montata goala si legata prin aria-describedby', async () => {
    const { input } = setup();
    const status = within(fieldOf(input)).getByRole('status');
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(input.getAttribute('aria-describedby')).toBe(status.id);
    await userEvent.clear(input);
    await userEvent.type(input, '5{Enter}');
    expect(within(fieldOf(input)).getByRole('status')).toBe(status);
    expect(status).not.toBeEmptyDOMElement();
  });

  it('"150,5" ramane 150,5 (1.505 m) si nu se transforma in maxim', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '150,5{Enter}');
    expect((onChange.mock.calls.at(-1)?.[0] as PieceConfig3d).widthM).toBe(1.505);
    expect(input.value).toBe('150,5');
  });

  // b7: valoarea in afara limitelor se corecteaza la limita, cu mesaj langa camp
  it('valoarea peste limita se pune pe maxim, cu "Maximul e 600 cm — am pus 600"', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '700{Enter}');
    expect((onChange.mock.calls.at(-1)?.[0] as PieceConfig3d).widthM).toBe(6);
    expect(input.value).toBe('600');
    const field = input.closest('div')!.parentElement!.parentElement as HTMLElement;
    expect(within(field).getByRole('status')).toHaveTextContent(
      ro.Configurator.config3d.dimClampedMax.replaceAll('{value}', '600'),
    );
  });

  it('5 la latimea dulapului → "Minimul e 60 cm — am pus 60"', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '5{Enter}');
    expect((onChange.mock.calls.at(-1)?.[0] as PieceConfig3d).widthM).toBe(0.6);
    expect(input.value).toBe('60');
    expect(within(fieldOf(input)).getByRole('status')).toHaveTextContent(
      ro.Configurator.config3d.dimClampedMin.replaceAll('{value}', '60'),
    );
  });

  it('"1,2" se citeste ca metri → 120 cm, cu "Am inteles 120 cm"', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '1,2{Enter}');
    expect((onChange.mock.calls.at(-1)?.[0] as PieceConfig3d).widthM).toBe(1.2);
    expect(input.value).toBe('120');
    expect(within(fieldOf(input)).getByRole('status')).toHaveTextContent(
      ro.Configurator.config3d.dimReadAsMeters.replace('{value}', '120'),
    );
  });

  it('campul golit pastreaza valoarea veche, cu mesaj', async () => {
    const { input, onChange } = setup();
    const before = onChange.mock.calls.length;
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange.mock.calls.length).toBe(before);
    expect(input.value).toBe('240');
    expect(within(fieldOf(input)).getByRole('status')).toHaveTextContent(ro.Configurator.config3d.dimKeptPrevious);
  });

  it('textul care nu e numar arata "Scrie un numar"', async () => {
    const { input } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '1,2,3{Enter}');
    expect(screen.getByText(ro.Configurator.validation.notANumber)).toBeVisible();
    expect(input.value).toBe('240');
  });
});
