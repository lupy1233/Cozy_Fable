'use client';

import { useTranslations } from 'next-intl';
import { Field } from '@/components/ui/field';
import type { AdminCreditPackage, AdminThreshold } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';
import { BigSwitch, ValueBox } from './setting-controls';
import { FIELD, boolValue, textValue, useSettingText, useSettingsDraft } from './settings-drafts';

const ROW = 'flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-background py-4 last:border-b-0';
const BOXES = 'flex max-w-full flex-wrap items-start gap-x-4 gap-y-3';

function Failure({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-crimson">
      {message}
    </p>
  );
}

// Pachet de credite: cate credite, la ce pret (fara TVA) si daca se mai vinde.
export function PackageRow({ pkg }: { pkg: AdminCreditPackage }) {
  const t = useTranslations('Admin.settings');
  const text = useSettingText();
  const { drafts, setField, problems, failures, busy } = useSettingsDraft();
  const creditsField = FIELD.pkg(pkg.id, 'credits');
  const priceField = FIELD.pkg(pkg.id, 'priceRon');
  const activeField = FIELD.pkg(pkg.id, 'isActive');
  const credits = textValue(drafts, creditsField, String(pkg.credits));
  const price = textValue(drafts, priceField, String(pkg.priceRon));
  const active = boolValue(drafts, activeField, pkg.isActive);
  const creditsChanged = credits.trim() !== String(pkg.credits);
  const priceChanged = price.trim() !== String(pkg.priceRon);

  return (
    <div className={ROW}>
      <div className="min-w-0 flex-[1_1_200px]">
        <div className="font-semibold">{t('packageTitle', { credits: pkg.credits })}</div>
        {!pkg.isActive && <p className="text-ui text-muted-foreground">{t('packageInactive')}</p>}
        <Failure message={failures[`package.${pkg.id}`]} />
      </div>
      <div className={BOXES}>
        <Field
          label={t('fields.packageCredits')}
          error={problems[creditsField]}
          hint={creditsChanged ? t('was', { value: pkg.credits }) : undefined}
          className="w-40"
        >
          <ValueBox
            value={credits}
            onChange={(v) => setField(creditsField, v, String(pkg.credits))}
            unit={text.unit('credits')}
            changed={creditsChanged}
            invalid={!!problems[creditsField]}
            disabled={busy}
            variant="fillNumber"
          />
        </Field>
        <Field
          label={t('fields.packagePrice')}
          error={problems[priceField]}
          hint={priceChanged ? t('was', { value: pkg.priceRon }) : undefined}
          className="w-40"
        >
          <ValueBox
            value={price}
            onChange={(v) => setField(priceField, v, String(pkg.priceRon))}
            unit={text.unit('ron')}
            changed={priceChanged}
            invalid={!!problems[priceField]}
            disabled={busy}
            variant="fillNumber"
          />
        </Field>
        {/* mt-6 = inaltimea etichetei de deasupra casetelor vecine (comutatorul sta in dreptul lor) */}
        <div className="mt-6 flex h-11 items-center gap-2.5">
          <BigSwitch
            checked={active}
            onChange={(v) => setField(activeField, v, pkg.isActive)}
            label={`${t('packageTitle', { credits: pkg.credits })}: ${t('fields.active')}`}
            disabled={busy}
          />
          <span className={cn('text-sm', active !== pkg.isActive && 'font-medium text-amber')}>{t('fields.active')}</span>
        </div>
      </div>
    </div>
  );
}

// Prag de marime: intervalul de scor care da marimea S / M / L (deci termenul firmei).
export function ThresholdRow({ threshold }: { threshold: AdminThreshold }) {
  const t = useTranslations('Admin.settings');
  const tr = useTranslations('Requests');
  const text = useSettingText();
  const { drafts, setField, problems, failures, busy } = useSettingsDraft();
  const minField = FIELD.threshold(threshold.id, 'minScore');
  const maxField = FIELD.threshold(threshold.id, 'maxScore');
  // max gol = fara limita superioara (pragul LARGE are maxScore null)
  const serverMax = threshold.maxScore === null ? '' : String(threshold.maxScore);
  const min = textValue(drafts, minField, String(threshold.minScore));
  const max = textValue(drafts, maxField, serverMax);
  const minChanged = min.trim() !== String(threshold.minScore);
  const maxChanged = max.trim() !== serverMax;
  const known = tr.has(`sizeValue.${threshold.size}`);

  return (
    <div className={ROW}>
      <div className="min-w-0 flex-[1_1_200px]">
        <div className={cn('font-semibold', !known && 'font-mono text-ui font-medium')}>
          {known ? tr(`sizeValue.${threshold.size}`) : threshold.size}
        </div>
        {known && <div className="font-mono text-meta text-muted-foreground">{threshold.size}</div>}
        <Failure message={failures[`threshold.${threshold.id}`]} />
      </div>
      <div className={BOXES}>
        <Field
          label={t('fields.thresholdMin')}
          error={problems[minField]}
          hint={minChanged ? t('was', { value: threshold.minScore }) : undefined}
          className="w-44"
        >
          <ValueBox
            value={min}
            onChange={(v) => setField(minField, v, String(threshold.minScore))}
            unit={text.unit('points')}
            changed={minChanged}
            invalid={!!problems[minField]}
            disabled={busy}
            variant="fillNumber"
          />
        </Field>
        <Field
          label={t('fields.thresholdMax')}
          error={problems[maxField]}
          hint={maxChanged ? t('was', { value: serverMax === '' ? t('noMax') : serverMax }) : undefined}
          className="w-44"
        >
          <ValueBox
            value={max}
            placeholder={t('noMax')}
            onChange={(v) => setField(maxField, v, serverMax)}
            unit={text.unit('points')}
            changed={maxChanged}
            invalid={!!problems[maxField]}
            disabled={busy}
            variant="fillNumber"
          />
        </Field>
      </div>
    </div>
  );
}
