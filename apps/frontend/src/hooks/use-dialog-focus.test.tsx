import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { useDialogFocus } from './use-dialog-focus';

function Modal({ close, children }: { close: () => void; children?: React.ReactNode }) {
  const ref = useDialogFocus(close);
  return <div ref={ref} role="dialog" tabIndex={-1}><button>First</button><button>Last</button>{children}</div>;
}
describe('custom 3D dialog focus', () => {
  it('traps Tab and restores the original trigger', () => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const close = vi.fn(); const view = render(<Modal close={close} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
    screen.getByRole('button', { name: 'Last' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
    fireEvent.keyDown(document, { key: 'Escape' }); expect(close).toHaveBeenCalledTimes(1);
    view.unmount(); expect(document.activeElement).toBe(trigger); trigger.remove();
  });
  it('Escape dismisses only the top dialog', () => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    const parent = vi.fn(), child = vi.fn();
    function Nested() { const [open, setOpen] = useState(false); return <><Modal close={parent}><button onClick={() => setOpen(true)}>Open child</button></Modal>{open && <Modal close={child} />}</>; }
    const view = render(<Nested />); fireEvent.click(screen.getByText('Open child'));
    fireEvent.keyDown(document, { key: 'Escape' }); expect(child).toHaveBeenCalledTimes(1); expect(parent).not.toHaveBeenCalled(); view.unmount();
  });
});
