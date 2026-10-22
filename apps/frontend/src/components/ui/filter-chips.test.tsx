import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FilterChips } from './filter-chips';

const OPTIONS = [
  { value: 'a', label: 'Alfa', count: 3 },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gama' },
] as const;

describe('FilterChips', () => {
  it('are grup etichetat, aria-pressed corect si type=button', () => {
    render(<FilterChips label="Filtru" value="a" onChange={() => {}} options={OPTIONS} />);
    const group = screen.getByRole('group', { name: 'Filtru' });
    const chips = group.querySelectorAll('button');
    expect(chips).toHaveLength(3);
    chips.forEach((c) => expect(c).toHaveAttribute('type', 'button'));
    expect(screen.getByRole('button', { name: /Alfa/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('afiseaza contorul', () => {
    render(<FilterChips label="Filtru" value="a" onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('click schimba valoarea', () => {
    function Example() {
      const [v, setV] = useState<string | null>('a');
      return <FilterChips label="Filtru" value={v} onChange={setV} options={OPTIONS} />;
    }
    render(<Example />);
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(screen.getByRole('button', { name: 'Beta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Alfa/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('allowDeselect: click pe cel activ → onChange(null)', () => {
    const onChange = vi.fn();
    render(<FilterChips label="Filtru" allowDeselect value="a" onChange={onChange} options={OPTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: /Alfa/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('fara allowDeselect, click pe cel activ pastreaza valoarea', () => {
    const onChange = vi.fn();
    render(<FilterChips label="Filtru" value="a" onChange={onChange} options={OPTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: /Alfa/ }));
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('multiple: toggle in array', () => {
    const onChange = vi.fn();
    render(<FilterChips label="Filtru" multiple value={['a']} onChange={onChange} options={OPTIONS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    fireEvent.click(screen.getByRole('button', { name: /Alfa/ }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
