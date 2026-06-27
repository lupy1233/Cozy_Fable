'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  companyOnboardingSchema,
  type CompanyDto,
  type CompanyOnboardingInput,
} from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import { useMyCompany, useOnboardCompany } from '@/hooks/use-company';
import { CompanyDashboard } from './_components/company-dashboard';

export default function CompanyPage() {
  const t = useTranslations('Company');
  const router = useRouter();
  const me = useMe();
  const company = useMyCompany();

  // Doar COMPANY_USER acceseaza zona; restul → dashboard
  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending || company.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }

  // 404 (NOT_FOUND) = userul nu are inca firma → formular onboarding
  const noCompany = company.isError && company.error instanceof ApiError && company.error.status === 404;
  if (noCompany) return <OnboardingForm />;

  if (company.data) return <CompanyDashboard company={company.data as CompanyDto} />;

  return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
}

function OnboardingForm() {
  const t = useTranslations('Company');
  const onboard = useOnboardCompany();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompanyOnboardingInput>({
    resolver: zodResolver(companyOnboardingSchema),
  });

  const onSubmit = handleSubmit((values) => onboard.mutate(values));
  const apiErr = onboard.error instanceof ApiError ? onboard.error.code : null;

  const Field = ({
    name,
    type = 'text',
    step,
  }: {
    name: keyof CompanyOnboardingInput;
    type?: string;
    step?: string;
  }) => (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {t(name)}
      </span>
      <input
        type={type}
        step={step}
        className="h-10 rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/5"
        {...register(name, type === 'number' ? { valueAsNumber: true } : {})}
      />
      {errors[name] && (
        <span className="text-xs text-crimson">{t(`validation.${errors[name]?.message}`)}</span>
      )}
    </label>
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="page-title">{t('onboardingTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('onboardingSubtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field name="name" />
        <div className="grid grid-cols-2 gap-4">
          <Field name="cui" />
          <Field name="regComNumber" />
        </div>
        <Field name="addressText" />
        <div className="grid grid-cols-2 gap-4">
          <Field name="county" />
          <Field name="city" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field name="lat" type="number" step="any" />
          <Field name="lng" type="number" step="any" />
        </div>

        {apiErr && (
          <p className="rounded-md border border-crimson/25 bg-crimson-soft px-3 py-2 text-sm text-crimson">
            {t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')}
          </p>
        )}

        <button
          type="submit"
          disabled={onboard.isPending}
          className="rounded-md bg-walnut px-5 py-2.5 font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-50"
        >
          {t('submit')}
        </button>
      </form>
    </div>
  );
}
