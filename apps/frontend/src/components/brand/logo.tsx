import { cn } from '@/lib/utils';

// Brandul "Cozy Home": casa desenata in linie (aceeasi mana care
// traseaza schita din hero) cu fum de alama din horn — caldura casei.
// Wordmark in Marcellus (font-serif), spatiat ca o gravura.

export function CozyHomeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={className}>
      {/* acoperis */}
      <path
        d="M5.5 15.5 L16 6.5 L26.5 15.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* pereti cu colturi blande */}
      <path
        d="M8 14 V24.5 A1.5 1.5 0 0 0 9.5 26 H22.5 A1.5 1.5 0 0 0 24 24.5 V14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* usa arcuita */}
      <path
        d="M13.5 26 V21 A2.5 2.5 0 0 1 18.5 21 V26"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* horn pe panta acoperisului */}
      <path
        d="M21.5 11.2 V7.5 M24 7.5 V13.4 M20.8 7.5 H24.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* fum — alama */}
      <path
        d="M22.9 5.4 C22.1 4.6 23.6 3.8 22.9 3"
        stroke="hsl(var(--brass))"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CozyHomeLogo({
  size = 'md',
  className,
}: {
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={cn('flex items-center', size === 'lg' ? 'gap-2.5' : 'gap-2', className)}>
      <CozyHomeMark className={size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'} />
      <span
        className={cn(
          'whitespace-nowrap font-serif uppercase leading-none tracking-[0.18em]',
          size === 'lg' ? 'text-[19px]' : 'text-[15px]',
        )}
      >
        Cozy&nbsp;Home
      </span>
    </span>
  );
}
