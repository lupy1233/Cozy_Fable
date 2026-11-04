import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// floating-ui (Popover/DropdownMenu Radix) testeaza `:popover-open` / `:modal`; nwsapi din jsdom nu le
// cunoaste si ajunge la sute de milioane de apeluri recursive (~30 s per deschidere). Raspundem direct.
const nativeMatches = Element.prototype.matches;
Element.prototype.matches = function matches(this: Element, selector: string) {
  if (selector === ':popover-open' || selector === ':modal') return false;
  return nativeMatches.call(this, selector);
};
