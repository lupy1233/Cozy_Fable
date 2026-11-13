'use client';

import { useTranslations } from 'next-intl';
import { Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useBudgetFormat } from '@/hooks/use-budget-format';
import type { DetailsValues, StartMode } from '@/stores/configurator-store';
import { isBudgetChosen } from './budget-choice';

// Compozitie adaptata din Cozy-Mobilaunicat; contractul si publicarea raman ale marketplace-ului.
// Rand de fapt: eticheta in stanga, valoarea in dreapta ei (pe telefon, dedesubt).
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-background py-3 last:border-b-0">
    <dt className="w-full text-muted-foreground sm:w-48 sm:shrink-0">{label}</dt>
    <dd className="min-w-0 flex-1 basis-64 whitespace-pre-wrap break-words font-medium">{children}</dd>
  </div>;
}

export function ReviewFactsCard({ details, complete, mode, helpRooms = [], onEdit }: {
  details: Partial<DetailsValues>;
  complete: boolean;
  // b8 / b10: un singur rand despre mod, in locul celor trei (am proiect / proiectare / ajutor)
  mode: StartMode | null;
  // numele camerelor bifate "am nevoie de ajutor" (in "Stiu ce vreau")
  helpRooms?: string[];
  onEdit: () => void;
}) {
  const t = useTranslations('Configurator');
  const tr = useTranslations('Requests');
  const budgetFormat = useBudgetFormat();
  const missing = t('review.facts.notProvided');
  // b11: suma aleasa in lei (acelasi format ca la firma) sau 'Buget nedeclarat'; fara trepte.
  // Neales inca = Necompletat (ciorna veche cu bugetul pus din oficiu cere alegerea din nou).
  const budgetText = isBudgetChosen(details) ? budgetFormat.amount({ budgetRange: details.budgetRange, budgetEstimateRon: details.budgetEstimateRon }) : missing;
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
          {budgetText}
        </Fact>
        <Fact label={t('review.facts.deadline')}>{details.deadlineBucket && tr.has(`deadline.${details.deadlineBucket}`) ? tr(`deadline.${details.deadlineBucket}`) : missing}</Fact>
        <Fact label={t('review.facts.location')}>{[details.addressText, details.city, details.county, details.country ?? 'RO'].filter(Boolean).join(', ')}</Fact>
        <Fact label={t('review.facts.contact')}>
          {details.contactPreferences?.length ? details.contactPreferences.map((contact, i) => (
            <span key={`${contact.channel}-${i}`} className="block break-all">{tr(`contactChannel.${contact.channel}`)}: {contact.value || missing}</span>
          )) : missing}
        </Fact>
        {mode && (
          <Fact label={t('review.facts.mode')}>
            {t(`start.${mode}.title`)}
            {mode === 'STANDARD' && helpRooms.length > 0 && (
              <span className="mt-0.5 block text-ui font-normal text-muted-foreground">
                {t('review.facts.helpRooms', { rooms: helpRooms.join(', ') })}
              </span>
            )}
          </Fact>
        )}
        {details.description?.trim() && <Fact label={t('review.facts.description')}>{details.description.trim()}</Fact>}
      </dl>
    </div>
  </section>;
}
