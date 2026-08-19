import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

// Imagine Open Graph 1200x630 per limba (audit 2026-08-19 P1): marca + wordmark
// + tagline din Meta.ogTagline. Fontul e cel implicit al ImageResponse (Noto
// Sans, subset latin) — taglineul se scrie FARA diacritice, altfel ar iesi
// patratele; fara fonturi externe (CSP/retea la build).
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Cozy Home';

export default async function OpenGraphImage({ params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'Meta' });
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px 96px',
          background: '#F1EADF',
          color: '#1A1714',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
            <path
              d="M5.5 15.5 L16 6.5 L26.5 15.5"
              stroke="#1A1714"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 14 V24.5 A1.5 1.5 0 0 0 9.5 26 H22.5 A1.5 1.5 0 0 0 24 24.5 V14"
              stroke="#1A1714"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M13.5 26 V21 A2.5 2.5 0 0 1 18.5 21 V26"
              stroke="#1A1714"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M21.5 11.2 V7.5 M24 7.5 V13.4 M20.8 7.5 H24.7"
              stroke="#1A1714"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path
              d="M22.9 5.4 C22.1 4.6 23.6 3.8 22.9 3"
              stroke="#B4832F"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ display: 'flex', fontSize: 64, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Cozy Home
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 44,
            marginBottom: 32,
          }}
        >
          <div style={{ width: 96, height: 2, background: '#E7DFCE' }} />
          <div style={{ width: 10, height: 10, background: '#B4832F', transform: 'rotate(45deg)' }} />
          <div style={{ flex: 1, height: 2, background: '#E7DFCE' }} />
        </div>
        <div style={{ display: 'flex', fontSize: 36, color: '#766E63', lineHeight: 1.3 }}>
          {t('ogTagline')}
        </div>
      </div>
    ),
    size,
  );
}
