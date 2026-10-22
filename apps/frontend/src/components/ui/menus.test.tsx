import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

describe('Popover (Radix)', () => {
  it('se deschide din trigger, Escape il inchide si focusul revine pe trigger', async () => {
    render(
      <Popover>
        <PopoverTrigger>Deschide</PopoverTrigger>
        <PopoverContent>
          <p>Continut panou</p>
        </PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole('button', { name: 'Deschide' });
    expect(screen.queryByText('Continut panou')).toBeNull();

    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('Continut panou')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Continut panou')).toBeNull());
    expect(trigger).toHaveFocus();
  });
});

describe('DropdownMenu (Radix)', () => {
  it('Enter deschide, ArrowDown muta focusul pe item, Escape inchide', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Cont</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Prima</DropdownMenuItem>
          <DropdownMenuItem>A doua</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const trigger = screen.getByRole('button', { name: 'Cont' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('menu')).toBeInTheDocument();

    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      const items = screen.getAllByRole('menuitem');
      expect(items.some((el) => el === document.activeElement)).toBe(true);
    });

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(trigger).toHaveFocus();
  });
});
