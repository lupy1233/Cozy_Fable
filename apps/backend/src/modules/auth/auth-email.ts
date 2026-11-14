import type { User } from '@prisma/client';
import { supportLineHtml } from '../../infra/mail/mail-footer';

// Emailuri auth (stil comun cu notification-emails; valorile userului escapate).
// Folosit de AuthService (verificare/resetare) si LoginLockoutService (alerta de blocare).

// escape minimal pentru valorile interpolate in HTML-ul emailurilor (nume user)
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// f5 (etapa 12): data si ora in ora Romaniei (invarianta 3.3), in limba contului
export function bucharestDateTime(at: Date, lang: 'ro' | 'en'): { date: string; time: string } {
  const locale = lang === 'ro' ? 'ro-RO' : 'en-GB';
  return {
    // m18 (revizie): forma lunga, ca in restul aplicatiei („14 noiembrie 2026” / „14 November 2026”)
    date: at.toLocaleDateString(locale, { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'long', year: 'numeric' }),
    time: at.toLocaleTimeString(locale, { timeZone: 'Europe/Bucharest', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  };
}

export function authEmailHtml(opts: {
  user: Pick<User, 'name' | 'languagePreference'>;
  body: string;
  link: string;
  ctaLabel: string;
  supportEmail: string | null;
  // subsolul implicit spune "daca nu ai cerut tu, ignora"; alertele de securitate il inlocuiesc
  footer?: { ro: string; en: string };
}): string {
  const { user, body, ctaLabel, supportEmail, footer } = opts;
  // linkul poate avea mai multi parametri (b4: &redirect=) → & devine &amp; in HTML
  const link = esc(opts.link);
  const ro = user.languagePreference !== 'EN';
  const footerText = footer
    ? ro
      ? footer.ro
      : footer.en
    : ro
      ? 'Dacă nu ai cerut tu acest email, îl poți ignora.'
      : 'If you did not request this email, you can ignore it.';
  return `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; color: #2b2b2b;">
        <p style="letter-spacing: 0.12em; font-size: 12px; color: #8a7355;">COZY HOME</p>
        <p>${ro ? 'Salut' : 'Hi'} ${esc(user.name)},</p>
        <p>${body}</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #8a7355; color: #fff; padding: 10px 22px; text-decoration: none; border-radius: 999px;">
            ${ctaLabel}
          </a>
        </p>
        <p style="font-size: 12px; color: #888;">
          ${ro ? 'Sau deschide direct:' : 'Or open directly:'} <a href="${link}">${link}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5ded4; margin: 28px 0 12px;" />
        <p style="font-size: 11px; color: #999;">
          ${footerText}
        </p>
        ${supportLineHtml(ro ? 'ro' : 'en', supportEmail)}
      </div>`;
}
