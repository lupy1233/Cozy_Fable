import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge trateaza `text-<valoare necunoscuta>` drept culoare: fara aceasta
// extensie, cn('text-meta', 'text-muted-foreground') ar sterge tacit `text-meta`.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['micro', 'meta', 'ui', 'lead'] }] } },
});

// Helper standard shadcn pentru a combina clase Tailwind condizionale
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
