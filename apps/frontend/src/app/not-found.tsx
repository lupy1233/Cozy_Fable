// 404 pentru rutele din AFARA segmentului de limba (ex. /xyz sau o limba
// necunoscuta): se randeaza fara [locale]/layout.tsx, deci fara i18n, fonturi
// sau Providers — html/body minimale, bilingv, cu link catre "/"
// (middleware-ul duce pe limba salvata). 404-ul "normal" (din /ro, /en) e
// [locale]/not-found.tsx, in cadrul paginilor publice.
export default function RootNotFound() {
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
            Cozy Home · 404
          </p>
          <h1 style={{ fontWeight: 400, fontSize: 28, margin: '0.75rem 0 0.5rem' }}>
            Pagina nu există
          </h1>
          <p style={{ color: '#766E63', margin: 0 }}>This page could not be found.</p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              marginTop: '1.5rem',
              padding: '0.6rem 1.25rem',
              borderRadius: 8,
              background: '#855232',
              color: '#F8F4EE',
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            Înapoi acasă · Back home
          </a>
        </main>
      </body>
    </html>
  );
}
