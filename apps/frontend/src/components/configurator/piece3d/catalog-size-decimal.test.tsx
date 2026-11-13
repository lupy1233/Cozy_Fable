import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { CatalogSize } from './catalog-controls';

// b1: campurile de dimensiuni din 3D accepta virgula; o valoare in afara
// intervalului e refuzata cu mesaj si ramane valoarea veche (nu se taie la maxim)
function Harness({ onChange }: { onChange: (m: number) => void }) {
  const [value, setValue] = useState(1.2);
  return (
    <CatalogSize
      label="Lățime"
      value={value}
      min={0.8}
      max={2}
      onChange={(m) => {
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
  const input = screen.getByRole('textbox', { name: 'Lățime (cm)' }) as HTMLInputElement;
  return { input, onChange };
}

describe('CatalogSize — dimensiuni cu virgula (b1)', () => {
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

  it('valoarea peste limita e refuzata cu mesaj, ramane valoarea veche', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.type(input, '1505{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('120');
    expect(screen.getByRole('alert')).toHaveTextContent('80–200 cm');
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

  it('campul golit pastreaza valoarea veche', async () => {
    const { input, onChange } = setup();
    await userEvent.clear(input);
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('120');
  });
});
