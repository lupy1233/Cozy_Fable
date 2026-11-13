'use client';

import { AlertTriangle } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-billing';
import { useWallet } from '@/hooks/use-marketplace';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { planSentenceName } from '@/lib/plan-label';
import { cn } from '@/lib/utils';

// h2 (2026-11-13): UN SINGUR mesaj de stare pentru firma fara abonament activ, acelasi pe
// Panou, Marketplace, Preluari, Portofel si Firma mea: ce abonament a expirat si cand, ce se
// intampla cu creditele (raman in cont fara termen, se folosesc dupa reactivare — decizia PO
// h2-2) si ca preluarile in curs se pot termina (h2-1). Nu apare cat timp abonamentul e activ
// sau cand datele nu s-au incarcat (firma neaprobata → 403 → nimic; blocajul il arata pagina).
export function SubscriptionStatusNotice({ className }: { className?: string }) {
  const t = useTranslations('Marketplace.subscriptionStatus');
  const format = useFormatter();
  const locale = useLocale();
  const me = useMe();
  const isCompany = me.data?.role === 'COMPANY_USER';
  const entitlements = useEntitlements(isCompany);
  const wallet = useWallet();

  const e = entitlements.data;
  if (!isCompany || !e || e.planId) return null;
  // soldul vine cu mesajul; fara el (portofel inca in incarcare / eroare) asteptam
  if (!wallet.data) return null;

  const last = e.lastExpired;
  // numele: din baza de date, altfel eticheta codului (GOLD → Gold); fara nume → text fara plan
  const plan = last ? planSentenceName({ code: last.planCode, nameRo: last.nameRo, nameEn: last.nameEn }, locale) : '';
  const date = last ? format.dateTime(new Date(last.expiredAt), { dateStyle: 'long' }) : '';
  const lead = !last ? t('none') : plan ? t('expiredOn', { plan, date }) : t('expiredOnNoPlan', { date });

  return (
    <Alert
      tone="crimson"
      icon={<AlertTriangle />}
      role="status"
      data-testid="subscription-status-notice"
      // pe ecran ingust butonul trece sub text in loc sa strivesca mesajul
      className={cn('flex-wrap [&>div.flex-1]:min-w-[14rem]', className)}
      action={
        <Button asChild variant="walnut" className="shrink-0 self-center">
          <Link href="/marketplace/wallet#subscription">{t('reactivate')}</Link>
        </Button>
      }
    >
      {lead} {t('credits', { n: wallet.data.balance })}
    </Alert>
  );
}

// true cand firma (aprobata) nu are abonament activ — pentru butoanele care se schimba in
// "Reactiveaza abonamentul" (Panou) si pentru pachetele de credite (Portofel).
export function useSubscriptionLapsed(enabled = true): boolean {
  const entitlements = useEntitlements(enabled);
  return entitlements.isSuccess && entitlements.data !== null && !entitlements.data.planId;
}
