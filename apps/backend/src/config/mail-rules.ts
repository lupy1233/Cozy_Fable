// Reguli pure pentru configuratia de email (fara importuri Nest) — folosite de
// config.schema (garda de productie) si de MailService (avertismente la boot).

const DEV_SMTP_LABELS = new Set(['mailpit', 'mailhog', 'maildev', 'smtp4dev', 'green-mail']);

// Host de captura/dev: localhost, loopback, retea interna (*.internal, *.local) sau
// un serviciu de captura cunoscut (inclusiv FQDN, ex. mailpit.railway.internal).
export function isDevSmtpHost(raw: string): boolean {
  let host = raw.trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true;
  if (/^127\./.test(host)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  const firstLabel = host.split('.')[0] ?? '';
  return DEV_SMTP_LABELS.has(firstLabel);
}

// Porturile implicite Mailpit/MailHog (SMTP 1025, UI 8025).
export const DEV_SMTP_PORTS = new Set([1025, 8025]);

export interface ParsedMailbox {
  name: string | null;
  address: string;
  local: string;
  domain: string;
}

const ANGLE_FORM = /^\s*(?:"?([^"<>]*?)"?\s*)?<([^<>\s@]+)@([^<>\s@]+)>\s*$/;
const BARE_FORM = /^\s*([^<>\s@"]+)@([^<>\s@"]+\.[^<>\s@"]+)\s*$/;

// Accepta `"Cozy Home" <notificari@x.ro>`, `Cozy Home <notificari@x.ro>` si `notificari@x.ro`.
export function parseMailbox(raw: string): ParsedMailbox | null {
  const angle = ANGLE_FORM.exec(raw);
  if (angle) {
    const name = (angle[1] ?? '').trim();
    const local = angle[2] ?? '';
    const domain = (angle[3] ?? '').toLowerCase();
    if (!local || !domain.includes('.')) return null;
    return { name: name || null, address: `${local}@${domain}`, local, domain };
  }
  const bare = BARE_FORM.exec(raw);
  if (bare) {
    const local = bare[1] ?? '';
    const domain = (bare[2] ?? '').toLowerCase();
    return { name: null, address: `${local}@${domain}`, local, domain };
  }
  return null;
}

const RESERVED_SUFFIXES = ['.local', '.localhost', '.invalid', '.test', '.example', '.internal'];
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org', 'railway.app', 'up.railway.app'];

// Domenii rezervate/de test sau ale hostingului (railway.app) — nu pot fi expeditor real.
export function isReservedMailDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase().replace(/\.$/, '');
  if (RESERVED_SUFFIXES.some((s) => d === s.slice(1) || d.endsWith(s))) return true;
  return RESERVED_DOMAINS.some((r) => d === r || d.endsWith(`.${r}`));
}

export function isNoReplyLocal(local: string): boolean {
  return /^(no-?reply|do-?not-?reply|donotreply)$/i.test(local.trim());
}

// Aliniere slaba intre domeniul expeditorului si hostul site-ului (doar avertisment).
export function domainsAligned(mailDomain: string, siteHost: string): boolean {
  const a = mailDomain.trim().toLowerCase();
  const b = siteHost.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}
