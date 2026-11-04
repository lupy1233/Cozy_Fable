'use client';

import type { RequestVisibilityDto } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useRequestVisibility } from '@/hooks/use-requests';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';

// E-client-9 (C7-16): "Cine vede cererea" — ce vad firmele inainte de preluare (proiectul) si
// cine detine numele, adresa si contactele (firmele cu preluare ocupanta). Aceeasi forma de
// cartus ca fisa proiectului: randuri cu eticheta mica deasupra valorii.
export function RequestVisibilityCard({ visibility }: { visibility: RequestVisibilityDto }) {
  const t = useTranslations('Requests.visibility');
  const format = useFormatter();
  const holders = visibility.contactHolders;

  return (
    <section aria-labelledby="request-visibility-title" className="border border-ink/15 bg-surface shadow-sm">
      <h2 id="request-visibility-title" className="px-5 py-3.5 font-serif text-lg sm:px-6">
        {t('title')}
      </h2>
      <Row label={t('projectLabel')}>
        {visibility.projectVisibleInMarketplace ? t('projectVisible') : t('projectClosed')}
      </Row>
      <Row label={t('contactsLabel')}>
        {holders.length === 0 ? (
          t('contactsNone')
        ) : (
          <ul className="flex flex-col gap-1">
            {holders.map((h) => (
              <li key={h.claimSlotId} className="break-words">
                <span className="font-medium">{h.companyName}</span>
                {h.contactsVisibleFrom && (
                  <span className="text-muted-foreground">
                    {' · '}
                    {t('contactsFrom', {
                      time: format.dateTime(new Date(h.contactsVisibleFrom), {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: APP_TIME_ZONE,
                      }),
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Row>
      <p className="border-t border-ink/15 px-5 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6">
        {t('note')}
      </p>
    </section>
  );
}

// Varianta legata de API: nimic cat se incarca sau la eroare (cardul e informativ, fisa ramane).
export function RequestVisibilitySection({ requestId }: { requestId: string }) {
  const visibility = useRequestVisibility(requestId);
  if (!visibility.data) return null;
  return <RequestVisibilityCard visibility={visibility.data} />;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-ink/15 px-5 py-3.5 sm:px-6">
      <span className="label block">{label}</span>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
