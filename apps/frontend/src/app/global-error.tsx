'use client';

// Ultimul plasa de siguranta: eroare in [locale]/layout.tsx insusi (fonturi,
// mesaje, Providers). Se randeaza in locul intregului document, deci trebuie
// sa aiba html/body proprii; fara i18n (provider-ul a cazut) — bilingv, minimal.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#F1EADF',
          color: '#1A1714',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <main style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#766E63' }}>
            Cozy Home
          </p>
          <h1 style={{ fontWeight: 400, fontSize: 28, margin: '0.75rem 0 0.5rem' }}>
            A apărut o eroare neașteptată
          </h1>
          <p style={{ color: '#766E63', margin: 0 }}>Something went wrong. Please try again.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: 8,
                border: 0,
                background: '#855232',
                color: '#F8F4EE',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Încearcă din nou · Try again
            </button>
            <a
              href="/"
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: 8,
                border: '1px solid #D9CDB6',
                color: '#1A1714',
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              Înapoi acasă · Back home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
