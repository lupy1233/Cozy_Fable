'use client';

import { resolveBudgetFields, type BudgetRange } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { DetailsValues } from '@/stores/configurator-store';

// Compozitie adaptata din Cozy-Mobilaunicat; contractul si publicarea raman ale marketplace-ului.
// Rand de fapt: eticheta in stanga, valoarea in dreapta ei (pe telefon, dedesubt).
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-background py-3 last:border-b-0">
    <dt className="w-full text-muted-foreground sm:w-48 sm:shrink-0">{label}</dt>
    <dd className="min-w-0 flex-1 basis-64 whitespace-pre-wrap break-words font-medium">{children}</dd>
  </div>;
}

export function ReviewFactsCard({ details, complete, designHelp, onEdit }: {
  details: Partial<DetailsValues>;
  complete: boolean;
  designHelp: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations('Configurator');
  const tr = useTranslations('Requests');
  const format = useFormatter();
  const missing = t('review.facts.notProvided');
  // eticheta bucket-ului derivata din estimarea RON (aceeasi regula ca serverul):
  // un draft vechi nu mai arata "Sub 5.000 RON" langa 33.000 RON
  const budget = details.budgetRange
    ? resolveBudgetFields(details.budgetRange as BudgetRange, details.budgetEstimateRon).budgetRange
    : undefined;
  const yesNo = (value?: boolean) => t(value ? 'common.boolean.yes' : 'common.boolean.no');
  // "Cine vede cererea" (cele doua note de vizibilitate) sta in coloana de publicare a sumarului
  return <section aria-labelledby="review-facts-title" className="rounded-xl border border-border bg-surface">
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
      <h2 id="review-facts-title" className="heading-section">{tr('sectionGeneral')}</h2>
      <Button type="button" variant="outline" size="lg" onClick={onEdit} className="h-11 px-3.5">
        <Pencil aria-hidden />{t('review.edit')}
      </Button>
    </div>
    <div className="px-5 pb-3 pt-1.5 sm:px-6">
      {!complete && <Alert tone="amber" className="mt-3">{t('review.detailsIncomplete')}</Alert>}
      <dl className="text-sm">
        <Fact label={tr('field.budgetRange')}>
          {budget && tr.has(`budget.${budget}`) ? tr(`budget.${budget}`) : missing}
          {budget && budget !== 'UNDISCLOSED' && typeof details.budgetEstimateRon === 'number' && (
            <span className="mt-0.5 block text-ui font-normal text-muted-foreground">{t('review.facts.estimate', {
              amount: format.number(details.budgetEstimateRon, { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }),
            })}</span>
          )}
        </Fact>
        <Fact label={t('review.facts.deadline')}>{details.deadlineBucket && tr.has(`deadline.${details.deadlineBucket}`) ? tr(`deadline.${details.deadlineBucket}`) : missing}</Fact>
        <Fact label={t('review.facts.location')}>{[details.addressText, details.city, details.county, details.country ?? 'RO'].filter(Boolean).join(', ')}</Fact>
        <Fact label={t('review.facts.contact')}>
          {details.contactPreferences?.length ? details.contactPreferences.map((contact, i) => (
            <span key={`${contact.channel}-${i}`} className="block break-all">{tr(`contactChannel.${contact.channel}`)}: {contact.value || missing}</span>
          )) : missing}
        </Fact>
        <Fact label={tr('field.hasOwnProject')}>{yesNo(details.hasOwnProject)}</Fact>
        <Fact label={tr('field.includesPaidDesign')}>{yesNo(details.includesPaidDesign)}</Fact>
        <Fact label={t('review.facts.designHelp')}>{yesNo(designHelp)}</Fact>
        {details.description?.trim() && <Fact label={t('review.facts.description')}>{details.description.trim()}</Fact>}
      </dl>
    </div>
  </section>;
}
