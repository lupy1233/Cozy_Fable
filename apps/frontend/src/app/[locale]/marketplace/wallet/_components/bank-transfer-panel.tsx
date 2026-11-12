'use client';

import type { BillingOrderDto, PaymentInstructionsDto } from '@marketplace/shared';
import { Check, Copy, FileDown, Landmark } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useMoney } from '@/hooks/use-money';
import { copyText } from '@/lib/clipboard';
import { formatAmount } from '@/lib/money';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CardSection } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import { shortRef } from './order-ref';

// Transfer bancar — datele de plata ale unei comenzi PENDING (cand Stripe e dezactivat):
// beneficiar, IBAN, suma si referinta cu "Copiaza", proforma si "Am platit" (E-company-24).
export function BankTransferPanel({
  order,
  bankTransfer,
  billingReady,
  markPaidPending,
  markPaidError,
  onMarkPaid,
  downloadingProforma,
  onDownloadProforma,
}: {
  order: BillingOrderDto;
  bankTransfer: PaymentInstructionsDto['bankTransfer'] | undefined;
  billingReady: boolean;
  markPaidPending: boolean;
  markPaidError: string | null;
  onMarkPaid: (order: BillingOrderDto) => void;
  downloadingProforma: boolean;
  onDownloadProforma: (order: BillingOrderDto) => void;
}) {
  const tb = useTranslations('Billing');
  const format = useFormatter();
  const locale = useLocale();
  const money = useMoney();
  // chitantele vechi nu au campurile (undefined = null)
  const claimedAt = order.paymentClaimedAt ?? null;
  const expiresAt = order.transferExpiresAt ?? null;
  const reference = tb('bankTransfer.referenceValue', { ref: shortRef(order.id) });

  return (
    <CardSection
      id="bank-transfer"
      className="scroll-mt-24"
      tone="amber"
      padding="lg"
      icon={Landmark}
      title={tb('bankTransfer.title')}
      titleSize="section"
    >
      <p className="text-sm">{tb('bankTransfer.intro', { ref: shortRef(order.id) })}</p>
      <p className="text-sm text-muted-foreground">{tb('bankTransfer.emailed')}</p>
      {bankTransfer?.iban ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">{tb('bankTransfer.beneficiary')}</dt>
          <dd className="font-medium">{bankTransfer.sellerName}</dd>
          <dt className="text-muted-foreground">{tb('bankTransfer.cui')}</dt>
          <dd className="font-mono">{bankTransfer.cui}</dd>
          <dt className="text-muted-foreground">{tb('bankTransfer.iban')}</dt>
          <dd className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-all font-mono">{bankTransfer.iban}</span>
            <CopyButton label={tb('bankTransfer.iban')} value={bankTransfer.iban.replace(/\s+/g, '')} />
          </dd>
          <dt className="text-muted-foreground">{tb('bankTransfer.amount')}</dt>
          <dd className="flex items-center justify-between gap-2">
            <span className="font-mono font-medium">{money(order.totalRon)}</span>
            <CopyButton label={tb('bankTransfer.amount')} value={formatAmount(order.totalRon, locale)} />
          </dd>
          <dt className="text-muted-foreground">{tb('bankTransfer.reference')}</dt>
          <dd className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-all font-mono">{reference}</span>
            <CopyButton label={tb('bankTransfer.reference')} value={reference} />
          </dd>
        </dl>
      ) : (
        <p className="mt-1 text-sm">{tb('bankTransfer.missing')}</p>
      )}
      {expiresAt && (
        <p className="mt-2 text-sm">
          {tb('bankTransfer.autoCancelNote', {
            date: format.dateTime(new Date(expiresAt), { dateStyle: 'medium', timeStyle: 'short' }),
          })}
        </p>
      )}
      {order.status === 'PENDING' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!claimedAt && (
            <Button
              type="button"
              size="lg"
              disabled={markPaidPending}
              aria-busy={markPaidPending}
              onClick={() => onMarkPaid(order)}
            >
              <Check aria-hidden /> {tb('bankTransfer.markPaid')}
            </Button>
          )}
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={downloadingProforma || !billingReady}
            aria-busy={downloadingProforma}
            onClick={() => onDownloadProforma(order)}
          >
            <FileDown aria-hidden /> {tb('bankTransfer.downloadProforma')}
          </Button>
        </div>
      )}
      {order.status === 'PENDING' &&
        (claimedAt ? (
          <p className="text-sm font-medium">
            {tb('bankTransfer.markedPaid', {
              date: format.dateTime(new Date(claimedAt), { dateStyle: 'medium', timeStyle: 'short' }),
            })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{tb('bankTransfer.markPaidHint')}</p>
        ))}
      {markPaidError && (
        <Alert tone="crimson" role="alert" className="mt-1">
          {markPaidError}
        </Alert>
      )}
    </CardSection>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const tb = useTranslations('Billing');
  const onCopy = () => {
    void copyText(value).then((ok) => {
      if (ok) toast.success(tb('bankTransfer.copied'));
      else toast.error(tb('bankTransfer.copyFailed'));
    });
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11 min-w-11 shrink-0"
      aria-label={tb('bankTransfer.copyAria', { label })}
      onClick={onCopy}
    >
      <Copy aria-hidden /> {tb('bankTransfer.copy')}
    </Button>
  );
}
