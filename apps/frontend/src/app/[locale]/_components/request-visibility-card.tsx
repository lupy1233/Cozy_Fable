'use client';

import type { RequestVisibilityClosedReasonDto, RequestVisibilityDto } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useRequestVisibility } from '@/hooks/use-requests';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { Card } from '@/components/ui/card';

// E-client-9 (C7-16): "Cine vede cererea" — ce vad firmele inainte de preluare (proiectul) si
// cine detine numele, adresa si contactele (firmele cu preluare ocupanta). Card din coloana
// laterala a fisei: doua blocuri cu titlu mic, lista firmelor si nota de subsol.
export function RequestVisibilityCard({
  visibility,
}: {
  visibility: RequestVisibilityDto & RequestVisibilityClosedReasonDto;
}) {
  const t = useTranslations('Requests.visibility');
  const format = useFormatter();
  const holders = visibility.contactHolders;
  // e4: firmele care au avut datele si au renuntat (fara nume; lipsa = slot vechi)
  const past = visibility.pastContactAccess ?? [];
  // a1: motivul pentru care firme noi nu mai vad cererea (lipsa = slot vechi → textul general)
  const reason = visibility.marketplaceClosedReason;
  // a6 (PO a6-1): cat cererea e in piata si nicio firma nu lucreaza pe raza ei, spunem asta
  // cinstit in locul textului "vizibila firmelor din zona" — fara niciun numar de firme
  const noCoverage = visibility.projectVisibleInMarketplace && visibility.coverage === 'NONE';

  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby="request-visibility-title"
      className="flex flex-col gap-3.5 px-5 py-5 sm:px-6"
    >
      <h2 id="request-visibility-title" className="heading-section">
        {t('title')}
      </h2>

      <div>
        <h3 className="font-semibold">{t('projectLabel')}</h3>
        {noCoverage ? (
          <div
            role="status"
            data-testid="no-coverage-warning"
            className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-ui text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
          >
            <p className="font-medium">{t('noCoverage.title')}</p>
            <p className="mt-1">{t('noCoverage.body')}</p>
          </div>
        ) : (
          <p className="text-ui text-muted-foreground">
            {visibility.projectVisibleInMarketplace
              ? t('projectVisible')
              : reason
                ? t(`closedReason.${reason}`)
                : t('projectClosed')}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{t('contactsLabel')}</h3>
        {holders.length === 0 && past.length === 0 ? (
          <p className="text-ui text-muted-foreground">{t('contactsNone')}</p>
        ) : holders.length === 0 ? (
          // e4: o firma a avut datele si a renuntat — nu mai spunem "Nicio firma inca"
          <p className="text-ui text-muted-foreground">{t('contactsNoneNow')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-ui">
            {holders.map((h) => {
              // contacte in asteptare (dupa perioada de gratie): ora de la care firma le vede;
              // altfel firma le are deja si aratam cand a preluat cererea
              const since = h.contactsVisibleFrom
                ? t('contactsFrom', {
                    time: format.dateTime(new Date(h.contactsVisibleFrom), {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: APP_TIME_ZONE,
                    }),
                  })
                : t('claimedOn', {
                    date: format.dateTime(new Date(h.claimedAt), {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: APP_TIME_ZONE,
                    }),
                  });
              return (
                <li key={h.claimSlotId} className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-0.5">
                    <span className="min-w-0 break-words font-medium">{h.companyName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{since}</span>
                  </div>
                  {/* d5: ce vede firma, dupa regulile de vizibilitate (fisa de lucru a firmei) */}
                  <p className="text-muted-foreground">
                    {t(h.contactsVisibleFrom ? 'holderWillSee' : 'holderSees', { company: h.companyName })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        {past.length > 0 && (
          <ul aria-label={t('pastAccessLabel')} className="flex flex-col gap-1 text-ui text-muted-foreground">
            {past.map((p, i) => (
              <li key={`${p.until}-${i}`}>
                {t('pastAccess', {
                  date: format.dateTime(new Date(p.until), {
                    day: 'numeric',
                    month: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: APP_TIME_ZONE,
                  }),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">{t('note')}</p>
    </Card>
  );
}

// Varianta legata de API: nimic cat se incarca sau la eroare (cardul e informativ, fisa ramane).
export function RequestVisibilitySection({ requestId }: { requestId: string }) {
  const visibility = useRequestVisibility(requestId);
  if (!visibility.data) return null;
  return <RequestVisibilityCard visibility={visibility.data} />;
}
