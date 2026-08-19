import { notFound } from 'next/navigation';

// Catch-all pentru rutele necunoscute din /ro|/en: fara el, Next ar sari
// peste [locale]/layout.tsx si ar randa 404-ul radacina (fara header, fara
// i18n). Rutele reale (statice/dinamice) au prioritate — aici ajunge doar
// ce nu potriveste nimic altceva. Pattern recomandat de next-intl.
export default function CatchAllNotFound() {
  notFound();
}
