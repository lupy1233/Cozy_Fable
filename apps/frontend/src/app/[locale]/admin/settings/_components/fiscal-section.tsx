'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  SELLER_FIELDS,
  isValidIban,
  isValidRoCui,
  normalizeIban,
  type SellerDetailsDto,
  type SellerField,
  type SellerProblemReason,
} from '@marketplace/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonText } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { useBillingReadiness, useSellerDetails, useUpdateSellerDetails } from '@/hooks/use-billing';
import { ApiError } from '@/lib/api';
import { SettingsSection } from './setting-controls';

// E-admin-platform-4 — datele fiscale ale platformei (furnizor pe facturi). Pana sunt reale,
// cumpararile si confirmarile de plata raspund 503 BILLING_NOT_CONFIGURED.
// Formularul are salvarea lui (validare CUI/IBAN + audit dedicat, toate campurile intr-un apel).
const FISCAL_MAX: Record<SellerField, number> = { name: 200, cui: 14, regCom: 40, address: 300, iban: 42 };

function clientProblem(field: SellerField, value: string): SellerProblemReason | null {
  const v = value.trim();
  if (!v) return 'MISSING';
  if (field === 'cui' && !isValidRoCui(v)) return 'INVALID';
  if (field === 'iban' && !isValidIban(normalizeIban(v))) return 'INVALID';
  return null;
}

export function FiscalDataSection() {
  const t = useTranslations('Admin');
  const seller = useSellerDetails();
  return (
    <SettingsSection id="fiscal" title={t('settings.fiscal.title')} description={t('settings.fiscal.hint')} flush>
      {seller.isPending && <SkeletonText lines={3} />}
      {seller.isError && <LoadError onRetry={() => void seller.refetch()} />}
      {seller.data && <FiscalDataForm key={JSON.stringify(seller.data)} initial={seller.data} />}
    </SettingsSection>
  );
}

function FiscalDataForm({ initial }: { initial: SellerDetailsDto }) {
  const t = useTranslations('Admin');
  const readiness = useBillingReadiness();
  const save = useUpdateSellerDetails();
  const [values, setValues] = useState<SellerDetailsDto>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<SellerField, SellerProblemReason>>>({});

  const reasonText = (field: SellerField, reason: SellerProblemReason) =>
    reason === 'INVALID' ? t(`settings.fiscal.errors.INVALID_${field === 'iban' ? 'iban' : 'cui'}`) : t(`settings.fiscal.errors.${reason}`);

  // problemele curente (din readiness) raman afisate cat timp campul nu a fost modificat
  const storedProblem = (field: SellerField) =>
    values[field] === initial[field] ? readiness.data?.problems.find((p) => p.field === field)?.reason : undefined;

  const errorOf = (field: SellerField) => {
    const reason = serverErrors[field] ?? (submitted ? clientProblem(field, values[field]) : null) ?? storedProblem(field);
    return reason ? reasonText(field, reason) : undefined;
  };

  const dirty = SELLER_FIELDS.some((f) => values[f] !== initial[f]);

  const submit = () => {
    setSubmitted(true);
    if (SELLER_FIELDS.some((f) => clientProblem(f, values[f]))) return;
    save.mutate(values, {
      onSuccess: () => {
        toast.success(t('settings.fiscal.saved'));
        setServerErrors({});
      },
      onError: (err) => {
        const details = err instanceof ApiError && Array.isArray(err.details) ? (err.details as { field: SellerField; reason: SellerProblemReason }[]) : [];
        setServerErrors(Object.fromEntries(details.map((d) => [d.field, d.reason])));
        toast.error(details.length ? reasonText(details[0].field, details[0].reason) : t('settings.saveError'));
      },
    });
  };

  return (
    <>
      {readiness.data?.ready && <Alert tone="sage">{t('settings.fiscal.ready')}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        {SELLER_FIELDS.map((field) => (
          <Field
            key={field}
            label={t(`settings.fiscal.${field}`)}
            error={errorOf(field)}
            className={field === 'name' || field === 'address' ? 'sm:col-span-2' : undefined}
          >
            <Input
              value={values[field]}
              maxLength={FISCAL_MAX[field]}
              autoComplete="off"
              spellCheck={false}
              className={field === 'cui' || field === 'iban' ? 'h-11 font-mono' : 'h-11'}
              aria-invalid={!!errorOf(field)}
              onChange={(e) => {
                const value = e.target.value;
                setValues((v) => ({ ...v, [field]: value }));
                setServerErrors((s) => ({ ...s, [field]: undefined }));
              }}
            />
          </Field>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" className="h-11" onClick={submit} disabled={save.isPending}>
          {t('settings.fiscal.save')}
        </Button>
        {dirty && <span className="text-ui text-amber">{t('settings.fiscal.unsaved')}</span>}
      </div>
    </>
  );
}
