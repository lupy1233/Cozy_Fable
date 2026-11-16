import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { PieceDimensionControl } from './dimension-control';

// b1: campurile de dimensiuni din 3D accepta virgula; b7: o valoare in afara
// intervalului se pune pe limita, cu mesaj langa camp. Etapa 8 (41.4): fostul CatalogSize
// e acum componenta unica PieceDimensionControl (aceeasi in toate panourile 3D).
function Harness({ onChange }: { onChange: (m: number) => void }) {
  const [value, setValue] = useState(1.2);
  return (
    <PieceDimensionControl
      label="Lățime"
      valueM={value}
      minM={0.8}
      maxM={2}
      onValueM={(m) => {
        setValue(m);
        onChange(m);
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
  const input = screen.getByRole('textbox', { name: 'Lățime' }) as HTMLInputElement;
  return { input, onChange };
}

describe('PieceDimensionControl (fost CatalogSize) — dimensiuni cu virgula (b1)', () => {
  it('campul e text cu tastatura zecimala', () => {
    const { input } = setup();
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('decimal');
    expect(input).not.toHaveAttribute('pattern');
    expect(input.value).toBe('120');
  });

  it('"150,5" ramane 150,5 si nu se transforma in maxim', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '150,5{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(1.505);
    expect(input.value).toBe('150,5');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // b7: valoarea in afara limitelor se pune pe limita, cu mesaj
  it('valoarea peste limita se pune pe maxim, cu mesaj', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '1505{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(input.value).toBe('200');
    expect(screen.getByRole('status')).toHaveTextContent(
      ro.Configurator.config3d.dimClampedMax.replaceAll('{value}', '200'),
    );
  });

  it('textul care nu e numar arata "Scrie un numar"', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, 'abc');
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(ro.Configurator.validation.notANumber);
    expect(input.value).toBe('120');
  });

  it('campul golit pastreaza valoarea veche, cu mesaj', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('120');
    expect(screen.getByRole('status')).toHaveTextContent(ro.Configurator.config3d.dimKeptPrevious);
  });
});
