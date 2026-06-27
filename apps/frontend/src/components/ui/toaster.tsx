'use client';
import { Toaster as SonnerToaster } from 'sonner';

// Toaster — sonner stilizat pe tokenurile warm.
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group rounded-lg border border-border bg-surface text-foreground shadow-lg font-sans text-sm',
          description: 'text-muted-foreground',
          actionButton: 'bg-foreground text-background',
          cancelButton: 'bg-secondary text-foreground',
          error: 'border-crimson/30',
          success: 'border-sage/30',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
