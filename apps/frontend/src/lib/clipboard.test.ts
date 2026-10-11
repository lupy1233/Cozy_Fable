import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

const setClipboard = (value: unknown) =>
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
const setExec = (fn: unknown) =>
  Object.defineProperty(document, 'execCommand', { value: fn, configurable: true, writable: true });

afterEach(() => {
  setClipboard(undefined);
  setExec(undefined);
});

describe('copyText', () => {
  it('foloseste navigator.clipboard cand exista', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    await expect(copyText('RO49AAAA')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('RO49AAAA');
  });

  it('clipboard respins → fallback execCommand; fara execCommand → false', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    setExec(undefined);
    await expect(copyText('x')).resolves.toBe(false);
    const exec = vi.fn().mockReturnValue(true);
    setExec(exec);
    await expect(copyText('x')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('fara API clipboard → fallback execCommand', async () => {
    setClipboard(undefined);
    const exec = vi.fn().mockReturnValue(true);
    setExec(exec);
    await expect(copyText('abc')).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('execCommand esuat → false', async () => {
    setClipboard(undefined);
    setExec(vi.fn().mockReturnValue(false));
    await expect(copyText('abc')).resolves.toBe(false);
  });
});
