import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dropzone } from './dropzone';
import { Tabs } from './tabs';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog';

describe('shared keyboard controls', () => {
  it('opens the file chooser with Enter and Space and forwards dropped files', async () => {
    const onFiles = vi.fn();
    const { container } = render(<Dropzone label="Choose a drawing" hint="PNG or PDF" onFiles={onFiles} />);
    const button = screen.getByRole('button', { name: 'Choose a drawing' });
    const chooser = container.querySelector('input')!;
    const open = vi.spyOn(chooser, 'click').mockImplementation(() => {});
    button.focus();
    await userEvent.keyboard('{Enter} ');
    expect(open).toHaveBeenCalledTimes(2);
    expect(button).toHaveAccessibleDescription('PNG or PDF');
    const file = new File(['drawing'], 'plan.png', { type: 'image/png' });
    fireEvent.drop(button, { dataTransfer: { files: [file] } });
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('uses one tab stop and supports wraparound, Home and End', async () => {
    function Example() {
      const [current, setCurrent] = useState('a');
      return <><Tabs label="Categories" panelId="results" current={current} onChange={setCurrent} tabs={[{ value: 'a', label: 'Rooms' }, { value: 'b', label: 'Furniture' }, { value: 'c', label: 'Other' }]} /><div id="results" role="tabpanel" aria-labelledby={`results-tab-${current}`}>Content</div></>;
    }
    render(<Example />);
    const first = screen.getByRole('tab', { name: 'Rooms' });
    const last = screen.getByRole('tab', { name: 'Other' });
    first.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(last).toHaveFocus();
    expect(last).toHaveAttribute('aria-selected', 'true');
    expect(first).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Other');
    await userEvent.keyboard('{Home}');
    expect(first).toHaveFocus();
    await userEvent.keyboard('{End}{ArrowRight}');
    expect(first).toHaveFocus();
  });

  it('localizes the close control and restores focus on Escape', async () => {
    render(<NextIntlClientProvider locale="ro" messages={{ Accessibility: { close: 'Închide' } }}><Dialog><DialogTrigger>Deschide</DialogTrigger><DialogContent aria-describedby={undefined}><DialogTitle>Detalii</DialogTitle><button>Editează</button></DialogContent></Dialog></NextIntlClientProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Deschide' }));
    expect(screen.getByRole('button', { name: 'Închide' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deschide' })).toHaveFocus();
  });
});
