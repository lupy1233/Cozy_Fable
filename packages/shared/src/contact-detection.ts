// Detector de date de contact in texte libere (E-admin-platform-45, F2-16).
// docs/03 §4.2: contactele clientului ajung doar la firma cu preluare ocupanta
// (si doar la membrii cu acces). Clientul poate scrie totusi un telefon/email/link
// in descriere sau in raspunsurile text — detectorul le gaseste ca sa fie ascunse
// firmelor fara acces (MASK) sau refuzate la publicare (BLOCK).
// Ruleaza identic pe backend (sursa de adevar) si pe frontend (hint non-blocant).
// Tinta: formatele scrise uzual. Cifrele scrise in litere, numerele sparte in
// mai multe campuri si pozele sunt in afara scopului.

export const CONTACT_MATCH_KINDS = ['PHONE', 'EMAIL', 'URL', 'HANDLE', 'MESSENGER'] as const;
export type ContactMatchKind = (typeof CONTACT_MATCH_KINDS)[number];

export const CONTACT_DETECTION_FIELDS = ['TITLE', 'DESCRIPTION', 'ANSWER', 'PHOTO_NOTE'] as const;
export type ContactDetectionField = (typeof CONTACT_DETECTION_FIELDS)[number];

export const CONTACT_DETECTION_ACTIONS = ['MASKED', 'BLOCKED', 'TITLE_REPLACED', 'FLAGGED'] as const;
export type ContactDetectionAction = (typeof CONTACT_DETECTION_ACTIONS)[number];

export const CONTACT_DETECTION_TRIGGERS = ['PUBLISH', 'EDIT'] as const;
export type ContactDetectionTrigger = (typeof CONTACT_DETECTION_TRIGGERS)[number];

// system_settings.pre_claim_contact_text_policy — DECIZIE NECESARA PO (default MASK)
export const PRE_CLAIM_CONTACT_TEXT_POLICIES = ['MASK', 'BLOCK'] as const;
export type PreClaimContactTextPolicy = (typeof PRE_CLAIM_CONTACT_TEXT_POLICIES)[number];
export const SETTING_PRE_CLAIM_CONTACT_TEXT_POLICY = 'pre_claim_contact_text_policy';

// Tokenul care inlocuieste contactele in DTO-urile pentru firme; frontend-ul il
// randeaza ca eticheta localizata ("contact ascuns").
export const CONTACT_MASK_TOKEN = '⟦contact⟧';

export interface ContactMatch {
  kind: ContactMatchKind;
  start: number;
  end: number;
  text: string;
}

const MAX_SCAN_CHARS = 20_000;

// Telefon: sir de cifre cu separatori scurti, validat apoi pe cifre.
// Lookbehind/lookahead-urile exclud cifre lipite de litere (UUID, #hex, 18mm).
// Sirul nu e limitat la 16 cifre: doua numere lipite ("0722123456 0733111222")
// sau o cifra in fata ("Piesa 2 0722123456") se separa apoi la spatii.
const PHONE_RUN_RE =
  /(?<![\p{L}\d_.,+\-/])(?:\+|00)?\d(?:[ .\-/()]{0,2}\d)*(?![ .\-/()]{0,2}\d)(?![\p{L}\d_])/gu;
const MAX_PHONE_DIGITS = 17;
// Cuantificatori limitati (64/63/8/24): fara ei, un text lung fara '@' sau cu
// multe puncte costa O(n^2) (≈0,7 s la 20k caractere) la fiecare listare marketplace.
const EMAIL_RE = /[\p{L}\d._%+-]{1,64}@[\p{L}\d-]{1,63}(?:\.[\p{L}\d-]{1,63}){0,8}\.\p{L}{2,24}/giu;
// "ana [at] gmail [dot] com", "ana arond yahoo.com"; punctul simplu trebuie lipit
// de TLD ca sa nu prinda propozitii ("at home. Thanks").
const EMAIL_OBFUSCATED_RE =
  /[\p{L}\d._%+-]{1,64}\s{0,3}(?:[[({]\s{0,3}(?:at|a|arond)\s{0,3}[\])}]|\s(?:at|arond)\s)\s{0,3}[\p{L}\d-]{1,63}(?:\.(?=\p{L})|\s{0,3}[[({]\s{0,3}(?:dot|punct)\s{0,3}[\])}]\s{0,3})\p{L}{2,24}/giu;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const BARE_DOMAIN_RE =
  /\b(?:[a-z0-9-]{1,63}\.){1,8}(?:ro|com|net|org|eu|info|biz|io|md|co|me|app|shop|store|online|site)\b(?:\/[^\s<>"']*)?/gi;
const HANDLE_RE = /(?<![\p{L}\d._%+-])@[\p{L}\d._]{3,30}/gu;
const MESSENGER_RE =
  /\b(?:whats\s?app|whatsap|watsapp|telegram|viber|signal|messenger|instagram|insta|facebook|tik\s?tok)\b/giu;

const KIND_PRIORITY: Record<ContactMatchKind, number> = {
  EMAIL: 0,
  URL: 1,
  PHONE: 2,
  HANDLE: 3,
  MESSENGER: 4,
};

// Punctuatia de final de propozitie nu face parte din link/cont.
const TRAILING_PUNCT_RE = /[.,;:!?)\]}]+$/;

function isValidPhoneCandidate(candidate: string): boolean {
  // metri cu zecimale ("0.72 0.60") — nu sunt telefoane
  if (/(^|[ /-])0[.,]\d/.test(candidate)) return false;
  const intl = candidate.startsWith('+') || candidate.startsWith('00');
  let d = candidate.replace(/\D/g, '');
  if (candidate.startsWith('00')) d = d.slice(2);
  if (!intl && /^0(7\d{8}|[23]\d{8})$/.test(d)) return true;
  if (!intl && /^407\d{8}$/.test(d)) return true;
  if (intl && /^400?(7\d{8}|[23]\d{8})$/.test(d)) return true;
  if (intl && d.length >= 8 && d.length <= 15) return true;
  return false;
}

// Imparte sirul in bucati despartite de spatii (separatorii fara spatiu — punct,
// cratima — raman in bucata: o data "03.10.2026-15.10.2026" nu se taie niciodata).
// Din fiecare bucata de start se ia cel mai lung interval valid de bucati consecutive.
function collectPhones(text: string, out: ContactMatch[]): void {
  PHONE_RUN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PHONE_RUN_RE.exec(text)) !== null) {
    const run = m[0];
    const chunks: { start: number; end: number; digits: number }[] = [];
    let lastDigit = -1;
    for (let i = 0; i < run.length; i++) {
      if (!/\d/.test(run[i])) continue;
      const gap = lastDigit === -1 ? '' : run.slice(lastDigit + 1, i);
      if (lastDigit === -1 || /\s/.test(gap)) {
        chunks.push({ start: lastDigit === -1 ? 0 : i, end: i + 1, digits: 1 });
      } else {
        const c = chunks[chunks.length - 1];
        c.end = i + 1;
        c.digits++;
      }
      lastDigit = i;
    }
    let i = 0;
    while (i < chunks.length) {
      let best = -1;
      let digits = 0;
      for (let j = i; j < chunks.length; j++) {
        digits += chunks[j].digits;
        if (digits > MAX_PHONE_DIGITS) break;
        if (digits >= 8 && isValidPhoneCandidate(run.slice(chunks[i].start, chunks[j].end))) best = j;
      }
      if (best === -1) {
        i++;
        continue;
      }
      const start = m.index + chunks[i].start;
      const end = m.index + chunks[best].end;
      out.push({ kind: 'PHONE', start, end, text: text.slice(start, end) });
      i = best + 1;
    }
  }
}

function collect(
  re: RegExp,
  kind: ContactMatchKind,
  text: string,
  out: ContactMatch[],
  opts: { trimTrailing?: boolean; validate?: (s: string) => boolean } = {},
): void {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let value = m[0];
    if (value.length === 0) {
      re.lastIndex++;
      continue;
    }
    if (opts.trimTrailing) value = value.replace(TRAILING_PUNCT_RE, '');
    if (value.length === 0) continue;
    if (opts.validate && !opts.validate(value)) continue;
    out.push({ kind, start: m.index, end: m.index + value.length, text: value });
  }
}

export function isHideable(m: Pick<ContactMatch, 'kind'>): boolean {
  return m.kind !== 'MESSENGER';
}

// Returneaza potrivirile sortate dupa pozitie, fara suprapuneri. La suprapunere
// castiga tipul cu prioritate mai mare (EMAIL > URL > PHONE > HANDLE > MESSENGER),
// iar intervalul rezultat acopera toate candidatele suprapuse (un link care
// contine un telefon se ascunde integral).
export function detectContactInfo(text: string): ContactMatch[] {
  if (typeof text !== 'string' || !text) return [];
  const src = text.length > MAX_SCAN_CHARS ? text.slice(0, MAX_SCAN_CHARS) : text;
  const candidates: ContactMatch[] = [];
  collect(EMAIL_RE, 'EMAIL', src, candidates);
  collect(EMAIL_OBFUSCATED_RE, 'EMAIL', src, candidates);
  collect(URL_RE, 'URL', src, candidates, { trimTrailing: true });
  collect(BARE_DOMAIN_RE, 'URL', src, candidates, { trimTrailing: true });
  collectPhones(src, candidates);
  collect(HANDLE_RE, 'HANDLE', src, candidates, { trimTrailing: true });
  collect(MESSENGER_RE, 'MESSENGER', src, candidates);
  if (candidates.length === 0) return [];

  // 1) candidatele ascunzibile suprapuse se unesc intr-o singura potrivire
  const hideable = candidates
    .filter((c) => isHideable(c))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: ContactMatch[] = [];
  for (const c of hideable) {
    const last = merged[merged.length - 1];
    if (last && c.start < last.end) {
      const kind = KIND_PRIORITY[c.kind] < KIND_PRIORITY[last.kind] ? c.kind : last.kind;
      const end = Math.max(last.end, c.end);
      merged[merged.length - 1] = { kind, start: last.start, end, text: src.slice(last.start, end) };
    } else {
      merged.push({ ...c });
    }
  }
  // 2) mentiunile de aplicatii doar unde nu se suprapun cu un contact ascuns
  const result: ContactMatch[] = [...merged];
  const mentions = candidates
    .filter((c) => !isHideable(c))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  for (const mention of mentions) {
    if (!result.some((r) => mention.start < r.end && r.start < mention.end)) result.push(mention);
  }
  return result.sort((a, b) => a.start - b.start);
}

// Inlocuieste contactele ascunzibile cu CONTACT_MASK_TOKEN. Mentiunile de
// aplicatii ("prefer WhatsApp") raman — nu dezvaluie nimic. Idempotenta.
export function maskContactInfo(text: string): string {
  if (!text) return text;
  const matches = detectContactInfo(text).filter(isHideable);
  if (matches.length === 0) return text;
  let out = '';
  let cursor = 0;
  for (const m of matches) {
    out += text.slice(cursor, m.start) + CONTACT_MASK_TOKEN;
    cursor = m.end;
  }
  return out + text.slice(cursor);
}

const BULLET = '•';
const ELLIPSIS = '…';
const MAX_EXCERPT_CHARS = 240;

function redactPhone(value: string): string {
  const total = value.replace(/\D/g, '').length;
  let seen = 0;
  let out = '';
  for (const ch of value) {
    if (/\d/.test(ch)) {
      seen++;
      out += seen <= 2 || seen > total - 2 ? ch : BULLET;
    } else {
      out += ch;
    }
  }
  return out;
}

function redactEmail(value: string): string {
  const at = value.lastIndexOf('@');
  if (at > 0) return `${value[0]}${BULLET.repeat(3)}@${value.slice(at + 1)}`;
  // forma ofuscata: "ana [at] gmail [dot] com"
  const m = /^([^\s[({]+)\s*(?:[[({]\s*(?:at|a|arond)\s*[\])}]|\s(?:at|arond)\s)\s*(.*)$/iu.exec(
    value,
  );
  const domain = m
    ? m[2].replace(/\s*[[({]\s*(?:dot|punct)\s*[\])}]\s*/giu, '.').replace(/\s+/g, '')
    : '';
  return `${value[0]}${BULLET.repeat(3)}@${domain}`;
}

function redactUrl(value: string): string {
  const noScheme = value.replace(/^https?:\/\//i, '');
  const slash = noScheme.indexOf('/');
  if (slash === -1) return noScheme;
  return `${noScheme.slice(0, slash)}/${ELLIPSIS}`;
}

function redactHandle(value: string): string {
  return `@${value.charAt(1)}${BULLET.repeat(3)}`;
}

function redactMatch(m: ContactMatch): string {
  switch (m.kind) {
    case 'PHONE':
      return redactPhone(m.text);
    case 'EMAIL':
      return redactEmail(m.text);
    case 'URL':
      return redactUrl(m.text);
    case 'HANDLE':
      return redactHandle(m.text);
    default:
      return m.text;
  }
}

// Fragment pentru logul de admin: context de ±radius caractere in jurul
// potrivirii, cu TOATE contactele ascunzibile din fereastra partial ascunse.
// Nu contine niciodata numarul sau emailul complet. Maxim 240 de caractere.
export function redactContactExcerpt(text: string, match: ContactMatch, radius = 60): string {
  const all = detectContactInfo(text);
  let from = Math.max(0, match.start - radius);
  let to = Math.min(text.length, match.end + radius);
  // o potrivire taiata de marginea ferestrei se include integral (apoi se ascunde)
  for (const m of all) {
    if (m.start < from && m.end > from) from = m.start;
    if (m.start < to && m.end > to) to = m.end;
  }
  let out = from > 0 ? ELLIPSIS : '';
  let cursor = from;
  for (const m of all) {
    if (m.end <= from || m.start >= to) continue;
    out += text.slice(cursor, m.start);
    out += isHideable(m) ? redactMatch(m) : m.text;
    cursor = m.end;
  }
  out += text.slice(cursor, to);
  if (to < text.length) out += ELLIPSIS;
  out = out.replace(/\s+/g, ' ').trim();
  if (out.length > MAX_EXCERPT_CHARS) out = out.slice(0, MAX_EXCERPT_CHARS - 1) + ELLIPSIS;
  return out;
}
