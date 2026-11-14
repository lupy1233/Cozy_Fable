import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './tabs';

const TABS = [
  { value: 'a', label: 'Firma A · ofertă trimisă' },
  { value: 'b', label: 'Firma B · discuție' },
  { value: 'c', label: 'Firma C · discuție' },
];

// etapa 8 (40): filele firmelor pe un singur rand derulabil; fara prop — Tabs ca inainte
describe('Tabs', () => {
  it('without "scrollable" it is exactly as before (the cart uses it)', () => {
    render(<Tabs tabs={TABS} current="a" onChange={() => {}} panelId="p" label="Firme" className="mb-0 flex-wrap" />);
    const list = screen.getByRole('tablist', { name: 'Firme' });
    expect(list.className).toContain('flex-wrap');
    expect(list.className).not.toContain('overflow-x-auto');
    expect(list).not.toHaveAttribute('data-scrollable');
    expect(screen.getByRole('tab', { name: TABS[0].label }).className).toContain('-mb-px');
    expect(screen.getByRole('tab', { name: TABS[0].label }).className).not.toContain('shrink-0');
  });

  it('"scrollable": one row that scrolls sideways; the tabs do not shrink or wrap', () => {
    render(<Tabs tabs={TABS} current="b" onChange={() => {}} panelId="p" label="Firme" className="mb-0 flex-wrap" scrollable />);
    const list = screen.getByRole('tablist', { name: 'Firme' });
    expect(list.className).toContain('flex-nowrap');
    expect(list.className).toContain('overflow-x-auto');
    expect(list.className).not.toMatch(/(^|\s)flex-wrap(\s|$)/);
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('shrink-0');
      expect(tab.className).toContain('whitespace-nowrap');
    }
    expect(screen.getByRole('tab', { name: TABS[1].label })).toHaveAttribute('aria-selected', 'true');
  });

  it('keyboard and click still select a tab', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} current="a" onChange={onChange} panelId="p" label="Firme" scrollable />);
    fireEvent.keyDown(screen.getByRole('tab', { name: TABS[0].label }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    fireEvent.click(screen.getByRole('tab', { name: TABS[2].label }));
    expect(onChange).toHaveBeenLastCalledWith('c');
  });
});
