'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { useAdminPlans } from '@/hooks/use-admin';
import { useGrantSubscription } from '@/hooks/use-billing';
import { useAdminCompanies } from '@/hooks/use-company';
import { useMoney } from '@/hooks/use-money';
import { planDisplayName } from '@/lib/plan-label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { usePaymentErrorText } from './use-payment-error-text';

// Zona „Acorda abonament”: acordare/prelungire manuala (vanzare asistata, compensatii).
// Nu se creeaza comanda si nu se emite factura; inainte de trimitere, un dialog spune ce urmeaza.
export function GrantZone() {
  const t = useTranslations('AdminPayments');
  const format = useFormatter();
  const locale = useLocale();
  const money = useMoney();
  const errorText = usePaymentErrorText();
  const titleId = useId();
  const companies = useAdminCompanies('APPROVED');
  const plans = useAdminPlans();
  const grant = useGrantSubscription();

  const [companyId, setCompanyId] = useState('');
  const [planId, setPlanId] = useState('');
  const [days, setDays] = useState(30);
  const [includeCredits, setIncludeCredits] = useState(false);
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // E-admin-platform-58: planurile gratuite (0 lei) se acorda tot de aici
  const activePlans = useMemo(() => (plans.data ?? []).filter((p) => p.isActive), [plans.data]);
  const company = companies.data?.find((c) => c.id === companyId);
  const plan = activePlans.find((p) => p.id === planId);
  const canSubmit = !!companyId && !!planId && days >= 1 && days <= 366 && !grant.isPending;

  const submit = () => {
    if (!canSubmit) return;
    grant.mutate(
      { companyId, planId, days, includeCredits, note: note.trim() || undefined },
      {
        onSuccess: (res) => {
          toast.success(
            t('grant.success', {
              company: res.companyName,
              date: format.dateTime(new Date(res.expiresAt), { dateStyle: 'medium' }),
            }),
          );
          setNote('');
          setConfirmOpen(false);
        },
        onError: (err) => toast.error(errorText(err)),
      },
    );
  };

  return (
    <>
      <Card as="section" aria-labelledby={titleId} padding="lg" className="flex max-w-3xl flex-col gap-4">
        <div>
          <h2 id={titleId} className="heading-section">
            {t('grant.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('grant.hint')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('grant.company')}>
            <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">{t('grant.pickCompany')}</option>
              {companies.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.cui}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('grant.plan')}>
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">{t('grant.pickPlan')}</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {planDisplayName(p, locale)} · {p.isFree ? t('grant.freePlan') : money(p.priceRon)} · {p.includedCredits} cr.
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('grant.days')}>
            <Input
              type="number"
              min={1}
              max={366}
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label={t('grant.includeCredits')} hint={t('grant.includeCreditsHint')}>
            <div className="flex h-10 items-center">
              <Switch checked={includeCredits} onCheckedChange={setIncludeCredits} aria-label={t('grant.includeCredits')} />
            </div>
          </Field>
          <Field label={t('grant.note')} className="sm:col-span-2">
            <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button size="lg" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
            {t('grant.review')}
          </Button>
        </div>
      </Card>

      {/* Confirmare: ce primeste firma si ce NU se intampla (fara comanda, fara factura) */}
      <Dialog open={confirmOpen} onOpenChange={(open) => !open && !grant.isPending && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('grant.confirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('grant.confirmDesc', {
                company: company?.name ?? '',
                plan: plan ? planDisplayName(plan, locale) : '',
                days,
              })}{' '}
              {includeCredits
                ? t('grant.confirmWithCredits', { n: plan?.includedCredits ?? 0 })
                : t('grant.confirmNoCredits')}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('grant.hint')}</p>
          <DialogFooter>
            <Button variant="outline" disabled={grant.isPending} onClick={() => setConfirmOpen(false)}>
              {t('back')}
            </Button>
            <Button variant="walnut" disabled={!canSubmit} onClick={submit}>
              {t('grant.confirmCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
