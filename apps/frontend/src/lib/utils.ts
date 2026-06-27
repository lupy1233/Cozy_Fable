import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper standard shadcn pentru a combina clase Tailwind condizionale
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
