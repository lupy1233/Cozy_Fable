'use client';

import type { CreditPackageDto, SubscriptionPlanDto } from '@marketplace/shared';
import { Landmark, ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMoney } from '@/hooks/use-money';
import { planDisplayName } from '@/lib/plan-label';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { firmRulesChunk } from '../../../_components/firm-rules-link';

// Ce urmeaza sa cumpere firma — dialogul de confirmare arata totalul CU TVA inainte de comanda.
export type PendingPurchase =
  | { kind: 'credits'; pkg: CreditPackageDto }
  | { kind: 'plan'; plan: SubscriptionPlanDto };

export function PurchaseDialog({
  pending,
  busy,
  payDisabled,
  stripeEnabled,
  error,
  onClose,
  onConfirm,
}: {
  pending: PendingPurchase | null;
  /** comanda se plaseaza: dialogul nu se inchide */
  busy: boolean;
  payDisabled: boolean;
  stripeEnabled: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const tb = useTranslations('Billing');
  const locale = useLocale();

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tb('confirmTitle')}</DialogTitle>
          <DialogDescription>
            {pending?.kind === 'credits'
              ? tb('confirmCreditsDesc', { n: pending.pkg.credits })
              : pending?.kind === 'plan'
                ? tb('confirmPlanDesc', {
                    tier: planDisplayName(pending.plan, locale),
                    n: pending.plan.includedCredits,
                  })
                : ''}
          </DialogDescription>
        </DialogHeader>
        {pending && <PriceBreakdown amounts={pending.kind === 'credits' ? pending.pkg : pending.plan} />}
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          {stripeEnabled ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Landmark className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          {stripeEnabled ? tb('confirmStripeHint') : tb('confirmBankHint')}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {tb.rich('rulesNotice', { rules: firmRulesChunk('settlement', true) })}
        </p>
        {error && (
          <Alert tone="crimson" role="alert" className="mt-3">
            {error}
          </Alert>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onClose}>
            {tb('cancel')}
          </Button>
          <Button type="button" variant="walnut" size="lg" disabled={payDisabled} onClick={onConfirm}>
            {stripeEnabled ? tb('confirmButton') : tb('confirmButtonBank')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// E-admin-platform-58: baza/TVA/total vin din backend (aceeasi formula ca la comanda)
function PriceBreakdown({
  amounts,
}: {
  amounts: { priceRon: number; vatRate: number; vatRon: number; totalRon: number };
}) {
  const tb = useTranslations('Billing');
  const money = useMoney();
  const { priceRon: base, vatRate, vatRon: vat, totalRon: total } = amounts;
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-y-1 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm">
      <dt className="text-muted-foreground">{tb('breakdown.base')}</dt>
      <dd className="font-mono">{money(base)}</dd>
      <dt className="text-muted-foreground">{tb('breakdown.vat', { rate: vatRate })}</dt>
      <dd className="font-mono">{money(vat)}</dd>
      <dt className="mt-1 border-t border-border pt-1 font-medium">{tb('breakdown.total')}</dt>
      <dd className="mt-1 border-t border-border pt-1 font-mono font-semibold">{money(total)}</dd>
    </dl>
  );
}
