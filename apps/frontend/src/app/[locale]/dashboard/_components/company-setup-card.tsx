'use client';

import type { CompanySetupDto, CompanySetupStepKey, EntitlementsDto } from '@marketplace/shared';
import { ArrowRight, Check, Circle, Info } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useEntitlements } from '@/hooks/use-billing';
import { useMyCompany } from '@/hooks/use-company';
import { companyCan } from '@/lib/company-permissions';
import { planSentenceName } from '@/lib/plan-label';
import { cn } from '@/lib/utils';
import { useLongDate } from '../../_components/use-long-date';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

// h1 (etapa 11): fiecare pas duce direct la sectiunea lui din pagina firmei.
export const SETUP_STEP_HREF: Record<CompanySetupStepKey, string> = {
  PORTFOLIO: '/company#portfolio',
  LOCATIONS: '/company#locations',
  TEAM: '/company#team',
  BILLING_EMAIL: '/company#profile',
  OFFER_PERMISSIONS: '/company#permissions',
};

// „Pregateste-ti firma”: pasii si progresul vin de la server (dashboard-stats.setup), nimic
// din browser. Cand pasii obligatorii sunt facuti (sau pentru angajati: setup null), dispare.
export function CompanySetupCard({ setup }: { setup: CompanySetupDto | null | undefined }) {
  const t = useTranslations('Dashboard.setup');

  if (!setup || setup.complete) return null;

  const percent = setup.requiredTotal > 0 ? Math.round((setup.requiredDone / setup.requiredTotal) * 100) : 0;

  return (
    <Card as="section" padding="none" aria-labelledby="company-setup-title" className="shadow">
      <div className="flex flex-col gap-3 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 id="company-setup-title" className="heading-section">
            {t('title')}
          </h2>
          <span className="font-mono text-sm text-muted-foreground">
            {t('progress', { done: setup.requiredDone, total: setup.requiredTotal })}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={setup.requiredTotal}
          aria-valuenow={setup.requiredDone}
          aria-label={t('progressLabel', { done: setup.requiredDone, total: setup.requiredTotal })}
          className="h-2 rounded-full bg-background"
        >
          <span className="block h-2 rounded-full bg-walnut" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {setup.steps.map((step) => (
          <li key={step.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6">
            {step.done ? (
              <Check aria-hidden className="size-5 shrink-0 text-sage" />
            ) : (
              <Circle aria-hidden className="size-5 shrink-0 text-muted-2" />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className={cn('font-medium', step.done && 'text-muted-foreground')}>
                {t(`step.${step.key}.title`)}
                {step.optional && (
                  <Badge tone="outline" className="ml-2 align-middle">
                    {t('optional')}
                  </Badge>
                )}
                <span className="sr-only"> — {step.done ? t('done') : t('todo')}</span>
              </p>
              <p className="text-ui text-muted-foreground">{t(`step.${step.key}.hint`)}</p>
            </div>
            <Link
              href={SETUP_STEP_HREF[step.key]}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-walnut hover:text-walnut-deep hover:underline"
            >
              {step.done ? t('review') : t('go')}
              <span className="sr-only">: {t(`step.${step.key}.title`)}</span>
              <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Fraza despre proba gratuita: aceleasi date ca mesajul unificat de abonament (h2,
// GET /billing/entitlements): planul, data pana la care tine (ora Romaniei, limba aplicatiei)
// si ce urmeaza (fara reinnoire automata; creditele raman in cont — decizia PO h2-2).
// Fara proba activa → nimic (lipsa abonamentului o spune deja SubscriptionStatusNotice).
export function TrialSentence({ entitlements }: { entitlements: EntitlementsDto | null | undefined }) {
  const t = useTranslations('Dashboard.trial');
  const locale = useLocale();
  const longDate = useLongDate();
  if (!entitlements?.planId || !entitlements.isTrial || !entitlements.expiresAt) return null;
  const plan =
    planSentenceName({ code: entitlements.planCode, nameRo: entitlements.nameRo, nameEn: entitlements.nameEn }, locale) ||
    entitlements.planCode ||
    '';
  return (
    <Alert
      tone="info"
      icon={<Info />}
      role="status"
      data-testid="trial-sentence"
      className="flex-wrap [&>div.flex-1]:min-w-[14rem]"
      action={
        <Link
          href="/marketplace/wallet#subscription"
          className="inline-flex min-h-11 shrink-0 items-center self-center text-sm font-medium underline-offset-4 hover:underline"
        >
          {t('toWallet')}
        </Link>
      }
    >
      {t('active', { plan, date: longDate(entitlements.expiresAt) })}
    </Alert>
  );
}

// Revizuire m4: fraza trimite la alegerea unui plan → doar cine poate plati (BILLING_MANAGE:
// proprietar / manager). Angajatul nu vede nimic in plus.
export function TrialNotice() {
  const company = useMyCompany();
  const canBuy = companyCan(company.data, 'BILLING_MANAGE');
  const entitlements = useEntitlements(canBuy);
  if (!canBuy) return null;
  return <TrialSentence entitlements={entitlements.data} />;
}
