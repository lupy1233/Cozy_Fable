// Linia de suport din subsolul emailurilor (aceeasi in auth, admin si notificari).
const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function supportLineHtml(lang: 'ro' | 'en', supportEmail: string | null): string {
  if (!supportEmail) return '';
  const x = esc(supportEmail);
  const link = `<a href="mailto:${x}" style="color:#999;">${x}</a>`;
  const text = lang === 'ro' ? `Ai nevoie de ajutor? Scrie-ne la ${link}.` : `Need help? Write to us at ${link}.`;
  return `<p style="font-size: 11px; color: #999;">${text}</p>`;
}
