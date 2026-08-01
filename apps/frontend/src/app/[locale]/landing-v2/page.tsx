import { redirect } from 'next/navigation';

// Fosta pagina de lucru a landing-ului v2: continutul a fost promovat pe
// radacina (PO 2026-08-01). Linkurile distribuite catre /landing-v2 raman
// functionale prin redirect.
export default function LandingV2Redirect({ params }: { params: { locale: string } }) {
  redirect(`/${params.locale}`);
}
