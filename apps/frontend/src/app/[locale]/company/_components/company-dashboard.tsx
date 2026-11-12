'use client';

import { companyProfileUpdateSchema, type CompanyDto } from '@marketplace/shared';
import { AlertTriangle, Ban, Check, Clock, X, type LucideIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Link } from '@/i18n/routing';
import { useSubscription } from '@/hooks/use-marketplace';
import { FirmRulesLink } from '../../_components/firm-rules-link';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from '@/components/ui/toaster';
import { apiErrorKey } from '@/lib/error-messages';
import { companyCan } from '@/lib/company-permissions';
import { cn } from '@/lib/utils';
import { useUpdateCompanyProfile } from '@/hooks/use-company';
import { CompanySection } from './company-section';
import { LocationsSection } from './locations-section';
import { OfferPermissionsSection } from './offer-permissions-section';
import { PortfolioSection } from './portfolio-section';
import { SectionNav } from './section-nav';
import { TeamSection } from './team-section';

// Starea verificarii firmei, la vedere in antet. Culoarea spune cine are mutarea:
// info = asteapta verificarea adminului, sage = in regula, crimson = problema.
const STATUS_STYLE: Record<CompanyDto['status'], { className: string; icon: LucideIcon }> = {
  PENDING_VERIFICATION: { className: 'bg-info-soft text-info', icon: Clock },
  APPROVED: { className: 'bg-sage-soft text-sage', icon: Check },
  REJECTED: { className: 'bg-crimson-soft text-crimson', icon: X },
  SUSPENDED: { className: 'bg-crimson-soft text-crimson', icon: Ban },
};

export function CompanyDashboard({ company }: { company: CompanyDto }) {
  const t = useTranslations('Company');
  const format = useFormatter();
  // matricea de permisiuni (offerFieldPermissions) ramane doar a proprietarului — verificare inline
  const isOwner = company.myRole === 'OWNER';
  // E-admin-platform-58: permisiunile vin din CompanyDto.permissions (aceleasi roluri ca inainte)
  const canEditProfile = companyCan(company, 'COMPANY_PROFILE_EDIT');
  const canManageMembers = companyCan(company, 'MEMBERS_MANAGE');
  const canManageBilling = companyCan(company, 'BILLING_MANAGE');

  const status = STATUS_STYLE[company.status];
  const StatusIcon = status.icon;

  const navItems = [
    { id: 'profile', label: t('profile') },
    { id: 'locations', label: t('locations') },
    { id: 'team', label: t('team') },
    { id: 'portfolio', label: t('portfolio') },
    { id: 'permissions', label: t('navPermissions') },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={t('dashboardTitle')}
        subtitle={
          <>
            {t('dashboardSubtitle')}{' '}
            <FirmRulesLink className="text-walnut underline-offset-4 hover:underline">
              {t('rulesLink')}
            </FirmRulesLink>
          </>
        }
        actions={
          <span
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium',
              status.className,
            )}
          >
            <StatusIcon className="size-3.5 shrink-0" aria-hidden />
            {t('status')}: {t(`statusValue.${company.status}`)}
          </span>
        }
      />

      {company.status === 'PENDING_VERIFICATION' && (
        <Alert tone="info" icon={<Clock />}>
          {t('pendingNotice')}
        </Alert>
      )}
      {company.status === 'REJECTED' && (
        <Alert tone="crimson" icon={<AlertTriangle />}>
          {t('rejectedNotice', { reason: company.rejectionReason ?? '' })}{' '}
          <FirmRulesLink anchor="verification" className="underline">
            {t('rulesReapplyLink')}
          </FirmRulesLink>
        </Alert>
      )}
      {company.status === 'SUSPENDED' && company.suspendedUntil && (
        <Alert tone="crimson" icon={<AlertTriangle />}>
          {t('suspendedNotice', {
            until: format.dateTime(new Date(company.suspendedUntil), { dateStyle: 'medium' }),
          })}{' '}
          <FirmRulesLink anchor="suspension" className="underline">
            {t('rulesSuspensionLink')}
          </FirmRulesLink>
        </Alert>
      )}

      {company.status === 'APPROVED' && <SubscriptionBanner />}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
        <SectionNav variant="side" label={t('sectionsNav')} items={navItems} />

        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <CompanySection id="profile" title={t('profile')}>
            <Card padding="lg" className="flex flex-col gap-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="heading-section">{company.name}</p>
                  <p className="data-mono text-muted-foreground">
                    {t('cui')}: {company.isVatPayer ? 'RO' : ''}
                    {company.cui.replace(/^RO/i, '')} · {t('regComNumber')}: {company.regComNumber}
                  </p>
                  <p className="mt-1.5 text-sm">
                    {company.addressText}, {company.city}, {company.county}
                  </p>
                </div>
                {company.isVatPayer && <Badge tone="info">{t('vatPayer')}</Badge>}
              </div>
              {canManageBilling && <BillingEmailForm company={company} />}
            </Card>
          </CompanySection>

          <LocationsSection company={company} canManage={canEditProfile} />
          <TeamSection company={company} canManage={canManageMembers} />
          <PortfolioSection company={company} canManage={canEditProfile} />
          <OfferPermissionsSection company={company} isOwner={isOwner} />
        </div>
      </div>
    </div>
  );
}

// Banner abonament (L0-D): expira in <= 7 zile → amber, lipsa/expirat → crimson; link la portofel.
const SUBSCRIPTION_WARN_DAYS = 7;

function SubscriptionBanner() {
  const t = useTranslations('Company');
  const subscription = useSubscription();
  if (subscription.isPending || subscription.isError) return null;
  const sub = subscription.data;
  if (sub && sub.daysLeft > SUBSCRIPTION_WARN_DAYS) return null;
  const cta = (
    <Link
      href="/marketplace/wallet#subscription"
      className="shrink-0 self-center text-sm font-medium underline-offset-4 hover:underline"
    >
      {sub ? t('subscriptionBanner.extend') : t('subscriptionBanner.choosePlan')} →
    </Link>
  );
  return sub ? (
    <Alert tone="amber" icon={<AlertTriangle />} action={cta}>
      {t('subscriptionBanner.expiring', { tier: sub.tier, n: sub.daysLeft })}
    </Alert>
  ) : (
    <Alert tone="crimson" icon={<AlertTriangle />} action={cta}>
      {t('subscriptionBanner.expired')}
    </Alert>
  );
}

// E-company-24: adresa de facturare optionala (ex. contabilul) — primeste proforma si facturile.
const billingEmailSchema = companyProfileUpdateSchema.pick({ billingEmail: true });

function BillingEmailForm({ company }: { company: CompanyDto }) {
  const t = useTranslations('Company');
  const update = useUpdateCompanyProfile();
  const inputId = useId();
  const noteId = useId();
  const saved = company.billingEmail ?? '';
  const [value, setValue] = useState(saved);
  const [invalid, setInvalid] = useState(false);
  const apiErr = update.error ? apiErrorKey(update.error) : null;
  const dirty = value.trim().toLowerCase() !== saved;

  const save = () => {
    const parsed = billingEmailSchema.safeParse({ billingEmail: value });
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    // gol = stergere
    update.mutate(
      { billingEmail: parsed.data.billingEmail || null },
      {
        onSuccess: (c) => {
          setValue(c.billingEmail ?? '');
          toast.success(t('billingEmail.saved'));
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-[18px]">
      <Label htmlFor={inputId}>{t('billingEmail.label')}</Label>
      <div className="flex flex-wrap gap-3">
        <Input
          id={inputId}
          className="h-11 min-w-0 flex-[1_1_280px]"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          placeholder={t('billingEmail.placeholder')}
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={noteId}
          onChange={(e) => {
            setValue(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dirty && !update.isPending) save();
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 px-5"
          onClick={save}
          disabled={update.isPending || !dirty}
        >
          {t('billingEmail.save')}
        </Button>
      </div>
      {invalid ? (
        <p id={noteId} className="text-xs text-crimson">
          {t('billingEmail.invalid')}
        </p>
      ) : (
        <p id={noteId} className="text-xs text-muted-foreground">
          {t('billingEmail.hint')}
        </p>
      )}
      {apiErr && (
        <Alert tone="crimson" icon={<AlertTriangle />} className="mt-1.5">
          {t.has(apiErr.key) ? t(apiErr.key) : t('apiErrors.INTERNAL_ERROR')}
        </Alert>
      )}
    </div>
  );
}
