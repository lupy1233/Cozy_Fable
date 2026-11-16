'use client';

import { useTranslations } from 'next-intl';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Camp de parola cu „Arata / Ascunde" (design 2026-11). Chenarul e pe invelis, deci
// focusul se arata pe tot campul (focus-within), nu doar pe input.
export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function PasswordInput({ className, ...props }, ref) {
  const t = useTranslations('Auth');
  const [shown, setShown] = useState(false);
  return (
    <div
      className={cn(
        'flex h-11 items-center rounded-md border border-border-2 bg-surface transition-colors',
        'focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/5',
        className,
      )}
    >
      <input
        ref={ref}
        type={shown ? 'text' : 'password'}
        className="h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-sm placeholder:text-muted-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-pressed={shown}
        aria-label={shown ? t('hidePassword') : t('showPassword')}
        className="h-full shrink-0 rounded-md px-3 text-ui font-medium text-walnut transition-colors hover:text-walnut-deep"
      >
        {shown ? t('hide') : t('show')}
      </button>
    </div>
  );
});
