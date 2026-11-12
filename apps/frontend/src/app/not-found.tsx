/* eslint-disable @next/next/no-html-link-for-pages --
   404-ul de radacina e in afara segmentului [locale] (fara context next-intl): ancorele brute
   duc intentionat la "/" (middleware-ul alege limba salvata) si la rutele cu prefix de limba. */
import type { CSSProperties } from 'react';
import { headers } from 'next/headers';

// 404 pentru rutele din AFARA segmentului de limba (ex. /xyz, /partners fara /ro, sau o limba
// necunoscuta): se randeaza fara [locale]/layout.tsx, deci fara i18n, fonturi, Tailwind
// sau Providers — html/body minimale, bilingv. De aceea stilurile sunt inline, cu valorile
// tokenurilor din globals.css scrise direct (singurul loc din aplicatie unde e nevoie).
// 404-ul "normal" (din /ro, /en) e [locale]/not-found.tsx, in cadrul paginilor publice;
// asezarea de aici il urmeaza: casa, 404, titlu, o iesire principala + patru secundare.
// E-admin-platform-56: headers() face 404-ul dinamic, ca scripturile Next sa primeasca
// nonce-ul CSP-ului din middleware (o pagina statica ar avea scripturile blocate).

const INK = '#1A1714';
const MUTED = '#6F675D';
const WALNUT = '#855232';
const BRASS = '#B48431';
const RULE = '#D7CCB7';

// fara next-intl aici: cele patru iesiri sunt scrise in ambele limbi, fiecare spre prefixul ei
const EXITS = [
  {
    lang: 'ro',
    links: [
      { href: '/ro/requests/new', label: 'Cere oferte' },
      { href: '/ro/inspiration', label: 'Caietul de idei' },
      { href: '/ro/partners', label: 'Firme partenere' },
      { href: '/ro/login', label: 'Autentificare' },
    ],
  },
  {
    lang: 'en',
    links: [
      { href: '/en/requests/new', label: 'Get offers' },
      { href: '/en/inspiration', label: 'The Idea Book' },
      { href: '/en/partners', label: 'Partner companies' },
      { href: '/en/login', label: 'Log in' },
    ],
  },
] as const;

const exitRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '4px 28px',
};

const exitLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  color: WALNUT,
  fontWeight: 500,
};

export default async function RootNotFound() {
  await headers();
  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#F1EADF',
          color: INK,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <main
          style={{
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: 640,
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            textAlign: 'center',
          }}
        >
          {/* casa din logo, cu usa punctata (aceleasi trasee ca in [locale]/not-found.tsx) */}
          <svg
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden
            width={112}
            height={112}
            stroke="#B9AC93"
            strokeWidth="1"
            strokeLinecap="round"
          >
            <path d="M5.5 15.5 L16 6.5 L26.5 15.5" strokeLinejoin="round" />
            <path d="M8 14 V24.5 A1.5 1.5 0 0 0 9.5 26 H22.5 A1.5 1.5 0 0 0 24 24.5 V14" />
            <path d="M13.5 26 V21 A2.5 2.5 0 0 1 18.5 21 V26" strokeDasharray="1.5 1.5" />
            <path d="M21.5 11.2 V7.5 M24 7.5 V13.4 M20.8 7.5 H24.7" />
            <path d="M22.9 5.4 C22.1 4.6 23.6 3.8 22.9 3" stroke={BRASS} />
          </svg>
          <p
            style={{
              margin: 0,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 13,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: MUTED,
            }}
          >
            Cozy Home · 404
          </p>
          <h1
            style={{
              margin: 0,
              fontFamily: 'Georgia, serif',
              fontWeight: 400,
              fontSize: 'clamp(32px, 3.6vw, 50px)',
              lineHeight: 1.08,
              letterSpacing: '0.01em',
            }}
          >
            Pagina nu există
          </h1>
          <p style={{ margin: 0, maxWidth: 460, fontSize: 16, lineHeight: 1.6, color: MUTED }}>
            Linkul e greșit sau pagina a fost mutată.
            <br />
            <span lang="en">The link is wrong or the page has moved.</span>
          </p>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              height: 52,
              padding: '0 32px',
              borderRadius: 6,
              background: WALNUT,
              color: '#F8F6F2',
              textDecoration: 'none',
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            <span>Înapoi acasă</span>
            <span aria-hidden>·</span>
            <span lang="en">Back home</span>
          </a>
          <div
            style={{
              boxSizing: 'border-box',
              width: '100%',
              marginTop: 16,
              paddingTop: 24,
              borderTop: `1px solid ${RULE}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {EXITS.map((group) => (
              <nav
                key={group.lang}
                lang={group.lang}
                aria-label={group.lang === 'ro' ? 'Alte pagini utile' : 'Other useful pages'}
                style={exitRow}
              >
                {group.links.map((l) => (
                  <a key={l.href} href={l.href} style={exitLink}>
                    {l.label}
                  </a>
                ))}
              </nav>
            ))}
          </div>
        </main>
      </body>
    </html>
  );
}
