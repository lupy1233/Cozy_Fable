// b3 (pasul 3): mesajul "Cererea a fost publicata" / "Modificarile au fost salvate" se
// arata PE pagina cererii. Wizard-ul lasa inainte de navigare un semn de o singura
// folosinta (sessionStorage, acest tab), iar pagina cererii il ia la montare si il sterge.
// Semnul e legat de id-ul cererii si expira repede: nu apare pe alta cerere, la o
// reincarcare ulterioara sau dupa "inapoi" in browser.

export type PublishNoticeKind = 'published' | 'editSaved';

export const PUBLISH_NOTICE_KEY = 'mm_publish_notice';
// cat poate dura deschiderea paginii cererii (prima compilare in dev poate dura mult)
export const PUBLISH_NOTICE_TTL_MS = 2 * 60_000;

interface StoredNotice {
  requestId: string;
  kind: PublishNoticeKind;
  at: number;
}

export function leavePublishNotice(requestId: string, kind: PublishNoticeKind): void {
  try {
    const notice: StoredNotice = { requestId, kind, at: Date.now() };
    window.sessionStorage.setItem(PUBLISH_NOTICE_KEY, JSON.stringify(notice));
  } catch {
    // storage blocat: fara mesaj, publicarea ramane valida
  }
}

// Intoarce felul mesajului pentru ACEASTA cerere (o singura data) sau null. Un semn pentru
// alta cerere ramane pe loc (cat nu expira); unul expirat sau stricat se sterge.
export function takePublishNotice(requestId: string): PublishNoticeKind | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(PUBLISH_NOTICE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let notice: Partial<StoredNotice> | null = null;
  try {
    notice = JSON.parse(raw) as Partial<StoredNotice>;
  } catch {
    notice = null;
  }
  const valid =
    !!notice &&
    (notice.kind === 'published' || notice.kind === 'editSaved') &&
    typeof notice.requestId === 'string' &&
    typeof notice.at === 'number' &&
    Date.now() - notice.at <= PUBLISH_NOTICE_TTL_MS;
  if (valid && notice!.requestId !== requestId) return null;
  try {
    window.sessionStorage.removeItem(PUBLISH_NOTICE_KEY);
  } catch {
    // nimic de sters
  }
  return valid ? (notice!.kind as PublishNoticeKind) : null;
}
