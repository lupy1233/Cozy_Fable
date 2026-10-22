'use client';

import { resolveBudgetFields, type BudgetRange } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { DetailsValues } from '@/stores/configurator-store';

// Compozitie adaptata din Cozy-Mobilaunicat; contractul si publicarea raman ale marketplace-ului.
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-5">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 whitespace-pre-wrap break-words font-medium sm:text-right">{children}</dd>
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
  return <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <h3 className="font-serif text-xl">{tr('sectionGeneral')}</h3>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit} className="min-h-11">
        <Pencil aria-hidden className="mr-1 h-4 w-4" />{t('review.edit')}
      </Button>
    </div>
    {!complete && <Alert tone="amber" className="mt-3">{t('review.detailsIncomplete')}</Alert>}
    <dl className="mt-2 divide-y divide-border-2 text-sm">
      <Fact label={tr('field.budgetRange')}>
        {budget && tr.has(`budget.${budget}`) ? tr(`budget.${budget}`) : missing}
        {budget && budget !== 'UNDISCLOSED' && typeof details.budgetEstimateRon === 'number' && (
          <span className="mt-1 block font-normal text-muted-foreground">{t('review.facts.estimate', {
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
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('review.facts.projectVisibility')}</p>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('review.facts.contactVisibility')}</p>
  </section>;
}
