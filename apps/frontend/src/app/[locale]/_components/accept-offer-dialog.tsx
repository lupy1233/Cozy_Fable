'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { ApiError } from '@/lib/api';
import { useAcceptQuote, useClientQuote } from '@/hooks/use-quotes';
import { latestVersion } from '@/lib/quote-version';
import { useQuoteDate, useQuoteMoney, useVersionTerms } from './use-quote-terms';
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

// E-client-1 — confirmarea acceptarii (audit 2026-08-23 P0 UX + C4-15): acceptul e ireversibil
// si deconteaza creditele celorlalte firme, deci clientul vede exact ce accepta — versiunea,
// pretul, proiectarea, totalul, livrarea si valabilitatea — citite PROASPAT la deschidere.
// Serverul reverifica versiunea sub lock (409 QUOTE_VERSION_CHANGED).

export function AcceptSummary({ version: v }: { quote: QuoteDto; version: QuoteVersionDto }) {
  const t = useTranslations('Quotes');
  const money = useQuoteMoney();
  const date = useQuoteDate();
  const terms = useVersionTerms();
  // a4: moneda e a variantei confirmate
  const cur = v.currency;
  const other = cur === 'RON' ? 'EUR' : 'RON';
  const alt = (ron: number | null, eur: number | null) => {
    const value = cur === 'RON' ? eur : ron;
    return value == null ? null : (
      <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">≈ {money(value, other)}</span>
    );
  };
  const delivery = terms.delivery(v);

  const rows: { key: string; label: string; value: ReactNode; strong?: boolean }[] = [
    {
      key: 'price',
      // g0-11: proiectarea exista doar la cererile cu proiectare cu plata, unde mobilierul e o estimare
      label: v.designFee != null ? t('furnitureEstimate') : t('acceptConfirmPrice'),
      value: (
        <>
          {money(v.price, cur)}
          {alt(v.priceRon, v.priceEur)}
        </>
      ),
    },
  ];
  if (v.designFee != null) {
    rows.push({
      key: 'designFee',
      label: t('builder.designFee'),
      value: (
        <>
          {money(v.designFee, cur)}
          {alt(v.designFeeRon, v.designFeeEur)}
        </>
      ),
    });
    if (v.designIncludes) {
      rows.push({ key: 'designIncludes', label: t('builder.design.includes'), value: v.designIncludes });
    }
  }
  rows.push({
    key: 'total',
    label: t('acceptConfirmTotal'),
    strong: true,
    value: (
      <>
        {money(v.total, cur)}
        {alt(v.totalRon, v.totalEur)}
      </>
    ),
  });
  // a3: aceleasi rubrici ca pe card (TVA, ce e inclus, garantie); variantele vechi nu le au
  const vat = terms.vat(v);
  if (vat) rows.push({ key: 'vat', label: t('builder.vat.label'), value: vat });
  const included = terms.included(v);
  if (included) rows.push({ key: 'included', label: t('builder.included.label'), value: included });
  rows.push({
    key: 'delivery',
    label: t('acceptConfirmDelivery'),
    value: delivery || <span className="text-muted-foreground">{t('acceptConfirmDeliveryUnset')}</span>,
  });
  const warranty = terms.warranty(v);
  if (warranty) rows.push({ key: 'warranty', label: t('builder.warranty'), value: warranty });

  return (
    <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
      <p className="label">{t('versionLabel', { n: v.version })}</p>
      <dl className="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 tabular-nums">
        {rows.map((r) => (
          <div key={r.key} className="contents">
            <dt className={r.strong ? 'font-semibold' : 'text-muted-foreground'}>{r.label}</dt>
            <dd
              className={
                r.strong ? 'text-right font-mono text-lg font-medium' : 'whitespace-pre-wrap break-words text-right'
              }
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-xs text-muted-foreground">{t('validUntil', { date: date(v.validUntil) })}</p>
    </div>
  );
}

export function AcceptOfferDialog({
  quote,
  open,
  onOpenChange,
}: {
  quote: QuoteDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Quotes');
  const accept = useAcceptQuote();
  // oferta reala la deschidere (nu cea din cache-ul listei)
  const fresh = useClientQuote(quote.id, open);
  // versiunea pe care clientul a vazut-o pe card cand a deschis dialogul
  const [openedWithVersionId, setOpenedWithVersionId] = useState<string | null>(null);
  const { reset } = accept;

  useEffect(() => {
    if (!open) return;
    setOpenedWithVersionId(latestVersion(quote)?.id ?? null);
    reset();
    // doar la deschidere: versiunea vazuta nu se actualizeaza cand lista se reimprospateaza
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = fresh.data ? latestVersion(fresh.data) ?? null : null;
  const errorText = (e: unknown) =>
    e instanceof ApiError
      ? t.has(`apiErrors.${e.code}`)
        ? t(`apiErrors.${e.code}`)
        : t('apiErrors.INTERNAL_ERROR')
      : e
        ? t('apiErrors.INTERNAL_ERROR')
        : null;

  let blocked: string | null = null;
  if (fresh.isError) blocked = errorText(fresh.error);
  else if (fresh.data && fresh.data.status !== 'SENT') blocked = t('apiErrors.QUOTE_ACCEPT_NOT_ALLOWED');
  else if (shown?.isExpired) blocked = t('apiErrors.QUOTE_EXPIRED');

  const acceptCode = accept.error instanceof ApiError ? accept.error.code : null;
  const versionChanged =
    acceptCode === 'QUOTE_VERSION_CHANGED' ||
    (!!shown && !!openedWithVersionId && shown.id !== openedWithVersionId);
  const acceptError = accept.error && acceptCode !== 'QUOTE_VERSION_CHANGED' ? errorText(accept.error) : null;
  const canConfirm = !!shown && !blocked && !accept.isPending && !fresh.isFetching;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!accept.isPending) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('acceptConfirmTitle', { company: quote.companyName })}</DialogTitle>
          <DialogDescription>{t('acceptConfirmBody')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {versionChanged && (
            <Alert tone="amber" role="status">
              {t('acceptVersionChanged')}
            </Alert>
          )}

          {!fresh.data && !fresh.isError ? (
            <p className="text-sm text-muted-foreground">{t('acceptConfirmLoading')}</p>
          ) : (
            shown && fresh.data && <AcceptSummary quote={fresh.data} version={shown} />
          )}

          {blocked && (
            <p role="alert" className="text-sm text-crimson">
              {blocked}
            </p>
          )}

          <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {/* a3: indemnul despre TVA ramane doar pe ofertele vechi, fara rubrica de TVA */}
            <p>
              {shown?.vatMode ? t('acceptConfirmPaymentHint') : t('acceptConfirmVatHint')}
            </p>
            <p>{t('acceptConfirmKeepChat', { company: quote.companyName })}</p>
          </div>
          {acceptError && (
            <p role="alert" className="text-sm text-crimson">
              {acceptError}
            </p>
          )}
        </div>

        <DialogFooter className="flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
            disabled={accept.isPending}
          >
            {t('acceptConfirmCancel')}
          </Button>
          <Button
            type="button"
            variant="walnut"
            size="lg"
            onClick={() => {
              if (!shown) return;
              accept.mutate(
                { quoteId: quote.id, quoteVersionId: shown.id },
                { onSuccess: () => onOpenChange(false) },
              );
            }}
            disabled={!canConfirm}
          >
            {accept.isPending ? t('acceptConfirmPending') : t('acceptConfirmCta')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
