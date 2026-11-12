'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  companyOnboardingSchema,
  type CompanyDto,
  type CompanyOnboardingInput,
} from '@marketplace/shared';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/error-messages';
import { useMe } from '@/hooks/use-auth';
import { useMyCompany, useOnboardCompany } from '@/hooks/use-company';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { QueryState } from '@/components/ui/query-state';
import { SkeletonPage } from '@/components/ui/skeleton';
import { firmRulesChunk } from '../_components/firm-rules-link';
import { CompanyDashboard } from './_components/company-dashboard';

export default function CompanyPage() {
  const router = useRouter();
  const me = useMe();
  const company = useMyCompany();

  // Doar COMPANY_USER acceseaza zona; restul → dashboard
  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  const loading = me.isPending || company.isPending;
  if (!loading) {
    // 404 (NOT_FOUND) = userul nu are inca firma → formular onboarding
    const noCompany = company.isError && company.error instanceof ApiError && company.error.status === 404;
    if (noCompany) return <OnboardingForm />;
    if (company.data) return <CompanyDashboard company={company.data as CompanyDto} />;
  }

  // cat timp ruleaza redirectul (sesiune expirata / alt rol) ramane scheletul, nu o eroare
  const redirecting = me.isError || (!!me.data && me.data.role !== 'COMPANY_USER');
  return (
    <QueryState
      pending={loading || redirecting}
      error={company.error}
      onRetry={() => {
        void me.refetch();
        void company.refetch();
      }}
      skeleton={<SkeletonPage variant="list" />}
    />
  );
}

const TEXT_FIELDS = ['name', 'cui', 'regComNumber', 'addressText', 'county', 'city'] as const;

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
  const apiErr = onboard.error ? apiErrorKey(onboard.error) : null;

  // mesajele schemei sunt chei i18n (Company.validation.*); restul cad pe mesajul generic
  const fieldError = (name: keyof CompanyOnboardingInput) => {
    const message = errors[name]?.message;
    if (!message) return undefined;
    const key = `validation.${message}`;
    return t.has(key) ? t(key) : t('apiErrors.VALIDATION_ERROR');
  };

  const field = (name: keyof CompanyOnboardingInput) => {
    const numeric = !(TEXT_FIELDS as readonly string[]).includes(name);
    return (
      <Field label={t(name)} error={fieldError(name)}>
        <Input
          className="h-11"
          type={numeric ? 'number' : 'text'}
          step={numeric ? 'any' : undefined}
          aria-invalid={errors[name] ? true : undefined}
          {...register(name, numeric ? { valueAsNumber: true } : {})}
        />
      </Field>
    );
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <PageHeader title={t('onboardingTitle')} subtitle={t('onboardingSubtitle')} />

      <Card padding="lg">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {field('name')}
          <div className="grid gap-4 sm:grid-cols-2">
            {field('cui')}
            {field('regComNumber')}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">{t('cuiVatHint')}</p>
          {field('addressText')}
          <div className="grid gap-4 sm:grid-cols-2">
            {field('county')}
            {field('city')}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('lat')}
            {field('lng')}
          </div>

          {apiErr && (
            <Alert tone="crimson" icon={<AlertTriangle />} role="alert">
              {t.has(apiErr.key) ? t(apiErr.key) : t('apiErrors.INTERNAL_ERROR')}
            </Alert>
          )}

          <p className="text-sm text-muted-foreground">
            {t.rich('rulesNotice', { rules: firmRulesChunk(undefined, true) })}
          </p>

          <Button type="submit" variant="walnut" size="xl" disabled={onboard.isPending}>
            {t('submit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
