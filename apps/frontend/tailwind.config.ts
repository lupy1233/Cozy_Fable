import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        'border-2': 'hsl(var(--border-2))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        // surfaces / ink steps portate din prototip
        surface: 'hsl(var(--card))',
        'surface-2': 'hsl(var(--surface-2))',
        'surface-3': 'hsl(var(--surface-3))',
        ink: 'hsl(var(--foreground))',
        'ink-2': 'hsl(var(--ink-2))',
        'muted-2': 'hsl(var(--muted-2))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // brand palette (limbaj "PLANSA" — birou de proiectare)
        // `plan` = albastru-plan (cerneala de trasat). `walnut` e numele
        // istoric al aceluiasi var, pastrat pentru cele ~40 fisiere vechi.
        plan: {
          DEFAULT: 'hsl(var(--walnut))',
          deep: 'hsl(var(--walnut-deep))',
          soft: 'hsl(var(--walnut-soft))',
        },
        walnut: {
          DEFAULT: 'hsl(var(--walnut))',
          deep: 'hsl(var(--walnut-deep))',
          soft: 'hsl(var(--walnut-soft))',
        },
        sage: {
          DEFAULT: 'hsl(var(--sage))',
          soft: 'hsl(var(--sage-soft))',
        },
        amber: {
          DEFAULT: 'hsl(var(--amber))',
          soft: 'hsl(var(--amber-soft))',
        },
        brass: {
          DEFAULT: 'hsl(var(--brass))',
          2: 'hsl(var(--brass-2))',
        },
        crimson: {
          DEFAULT: 'hsl(var(--crimson))',
          soft: 'hsl(var(--crimson-soft))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          soft: 'hsl(var(--info-soft))',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        // croiala calma: rotunjire mica, nu bombata
        xl: '14px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // lumina calda de galerie: umbre moi, adanci
        sm: '0 1px 2px rgba(46,33,20,0.05), 0 1px 1px rgba(46,33,20,0.03)',
        DEFAULT: '0 6px 20px -6px rgba(46,33,20,0.12), 0 2px 6px -2px rgba(46,33,20,0.06)',
        lg: '0 28px 60px -18px rgba(46,33,20,0.22), 0 8px 18px -8px rgba(46,33,20,0.10)',
        sheet: '0 14px 30px -12px rgba(46,33,20,0.18)',
        glow: '0 0 0 1px rgba(26,23,20,0.04)',
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        pageIn: {
          from: { opacity: '0', transform: 'translateY(9px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        // FARA fill-mode "both": pastra transform-ul pe element si dupa animatie,
        // iar un stramos cu transform devine containing block pentru position:fixed
        // — lightbox-urile se ancorau la inceputul documentului (U3, PO r4)
        pageIn: 'pageIn 420ms cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
    },
  },
  plugins: [animate],
};

export default config;
