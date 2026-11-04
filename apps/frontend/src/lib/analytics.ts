// E-admin-platform-8: statistici de baza fara cookie-uri (Umami sau Plausible, decizie PO).
// Dezactivat cat timp PROVIDER/HOST/SITE_ID nu sunt copte la build. Doar doua evenimente,
// cu URL fix (niciodata location.href → fara tokenuri de draft), fara props, respecta DNT.
export type AnalyticsEvent = 'wizard_start' | 'request_published';
type Provider = 'umami' | 'plausible';

function config(): { provider: Provider; host: string; siteId: string } | null {
  const provider = process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER?.trim();
  const rawHost = process.env.NEXT_PUBLIC_ANALYTICS_HOST?.trim();
  const siteId = process.env.NEXT_PUBLIC_ANALYTICS_SITE_ID?.trim();
  if ((provider !== 'umami' && provider !== 'plausible') || !rawHost || !siteId) return null;
  try {
    const host = new URL(rawHost);
    if (host.protocol !== 'https:') return null;
    return { provider, host: host.origin, siteId };
  } catch {
    return null;
  }
}

export function track(name: AnalyticsEvent, locale = 'ro'): void {
  try {
    if (typeof window === 'undefined') return;
    const cfg = config();
    if (!cfg) return;
    if (navigator.doNotTrack === '1') return;
    const lang = locale === 'en' ? 'en' : 'ro';
    const path = `/${lang}/requests/new`;
    const payload =
      cfg.provider === 'umami'
        ? {
            endpoint: `${cfg.host}/api/send`,
            body: { type: 'event', payload: { website: cfg.siteId, hostname: location.hostname, url: path, name } },
          }
        : {
            endpoint: `${cfg.host}/api/event`,
            body: { name, url: `${location.origin}${path}`, domain: cfg.siteId },
          };
    fetch(payload.endpoint, {
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.body),
    }).catch(() => {});
  } catch {
    // statisticile nu au voie sa strice fluxul
  }
}
