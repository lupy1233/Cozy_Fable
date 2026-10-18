// /.well-known/security.txt (RFC 9116). Expires < 1 an: fiecare release reconstruieste
// fisierul, deci 180 de zile de la build lasa marja. Fara Policy: nu exista inca o
// pagina de divulgare responsabila (campul e optional).
const EXPIRES_AFTER_DAYS = 180;

export function buildSecurityTxt({
  siteUrl,
  contact,
  now,
}: {
  siteUrl: string;
  contact: string;
  now: Date;
}): string | null {
  const email = contact.trim();
  if (!email) return null;
  const expires = new Date(now.getTime() + EXPIRES_AFTER_DAYS * 24 * 60 * 60 * 1000);
  // RFC 3339 cu precizie de secunde (fara milisecunde)
  const expiresIso = expires.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const origin = siteUrl.replace(/\/$/, '');
  return [
    `Contact: mailto:${email}`,
    `Expires: ${expiresIso}`,
    'Preferred-Languages: ro, en',
    `Canonical: ${origin}/.well-known/security.txt`,
  ]
    .map((line) => `${line}\n`)
    .join('');
}
