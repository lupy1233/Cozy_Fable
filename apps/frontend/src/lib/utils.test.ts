import { describe, expect, it } from 'vitest';
import { cn } from './utils';

// tailwind-merge trateaza text-<necunoscut> drept culoare: tokenii de font noi
// trebuie declarati in extendTailwindMerge, altfel `cn` ii sterge tacit.
describe('cn cu scala tipografica', () => {
  it('pastreaza marimea si culoarea', () => {
    expect(cn('text-meta', 'text-muted-foreground')).toBe('text-meta text-muted-foreground');
    expect(cn('text-micro', 'text-foreground')).toBe('text-micro text-foreground');
  });

  it('o marime o inlocuieste pe cealalta', () => {
    expect(cn('text-micro', 'text-meta')).toBe('text-meta');
    expect(cn('text-sm', 'text-ui')).toBe('text-ui');
    expect(cn('text-lead', 'text-xs')).toBe('text-xs');
  });
});
