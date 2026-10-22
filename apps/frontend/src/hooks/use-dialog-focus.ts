'use client';

import { useEffect, useRef } from 'react';

const dialogs: symbol[] = [];
const focusable = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

// Dialogurile 3D pastreaza canvas-ul si layout-ul propriu; stiva comuna
// asigura ca Escape/Tab afecteaza numai dialogul de deasupra.
export function useDialogFocus(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const token = Symbol('dialog'); dialogs.push(token);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(node.querySelectorAll<HTMLElement>(focusable)).filter((el) => el.getClientRects().length > 0);
    const first = () => (items()[0] ?? node).focus({ preventScroll: true });
    first();
    const key = (event: KeyboardEvent) => {
      if (dialogs[dialogs.length - 1] !== token) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); close.current(); return;
      }
      if (event.key !== 'Tab') return;
      const choices = items();
      if (!choices.length) { event.preventDefault(); node.focus(); return; }
      const index = choices.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); choices[choices.length - 1].focus(); }
      else if (!event.shiftKey && (index === choices.length - 1 || index < 0)) { event.preventDefault(); choices[0].focus(); }
    };
    const focus = (event: FocusEvent) => {
      if (dialogs[dialogs.length - 1] === token && event.target instanceof Node && !node.contains(event.target)) first();
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('focusin', focus);
    return () => {
      dialogs.splice(dialogs.indexOf(token), 1);
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('focusin', focus);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
