import { ImageResponse } from 'next/og';

// apple-touch-icon 180x180 generat la build: marca Cozy Home (aceleasi
// path-uri ca CozyHomeMark din components/brand/logo.tsx) pe ivorie.
// Fara text → nu depinde de fonturi.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F1EADF',
        }}
      >
        <svg width="140" height="140" viewBox="0 0 32 32" fill="none">
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
      </div>
    ),
    size,
  );
}
