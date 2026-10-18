'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { ApiError } from '@/lib/api';
import { useAcceptQuote, useClientQuote } from '@/hooks/use-quotes';
import { latestVersion } from '@/lib/quote-version';
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

const fmt = (n: number) => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2 }).format(n);

export function AcceptSummary({ quote, version: v }: { quote: QuoteDto; version: QuoteVersionDto }) {
  const t = useTranslations('Quotes');
  const other = quote.currency === 'RON' ? 'EUR' : 'RON';
  const alt = (ron: number | null, eur: number | null) => {
    const value = quote.currency === 'RON' ? eur : ron;
    return value == null ? null : (
      <span className="ml-2 text-xs font-normal text-muted-foreground">
        ≈ {fmt(value)} {other}
      </span>
    );
  };
  // data calendaristica (YYYY-MM-DD) afisata fara deplasare de fus orar
  const delivery = [
    v.deliveryTerm,
    v.deliveryDate ? new Date(`${v.deliveryDate}T12:00:00`).toLocaleDateString() : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rows: { key: string; label: string; value: ReactNode; strong?: boolean }[] = [
    {
      key: 'price',
      label: t('acceptConfirmPrice'),
      value: (
        <>
          {fmt(v.price)} {quote.currency}
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
          {fmt(v.designFee)} {quote.currency}
          {alt(v.designFeeRon, v.designFeeEur)}
        </>
      ),
    });
  }
  rows.push({
    key: 'total',
    label: t('acceptConfirmTotal'),
    strong: true,
    value: (
      <>
        {fmt(v.total)} {quote.currency}
        {alt(v.totalRon, v.totalEur)}
      </>
    ),
  });
  rows.push({
    key: 'delivery',
    label: t('acceptConfirmDelivery'),
    value: delivery || <span className="text-muted-foreground">{t('acceptConfirmDeliveryUnset')}</span>,
  });

  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
      <p className="text-xs text-muted-foreground">{t('versionLabel', { n: v.version })}</p>
      <dl className="mt-1 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 tabular-nums">
        {rows.map((r) => (
          <div key={r.key} className="contents">
            <dt className={r.strong ? 'font-semibold' : 'text-muted-foreground'}>{r.label}</dt>
            <dd className={r.strong ? 'text-right font-serif text-base font-semibold' : 'text-right'}>{r.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('validUntil', { date: new Date(v.validUntil).toLocaleDateString() })}
      </p>
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

        {versionChanged && (
          <p role="status" className="rounded-md border border-amber/25 bg-amber-soft px-3 py-2 text-sm text-amber">
            {t('acceptVersionChanged')}
          </p>
        )}

        {!fresh.data && !fresh.isError ? (
          <p className="text-sm text-muted-foreground">{t('acceptConfirmLoading')}</p>
        ) : (
          shown && fresh.data && <AcceptSummary quote={fresh.data} version={shown} />
        )}

        {blocked && <p className="text-sm text-crimson">{blocked}</p>}

        <p className="mt-2 text-sm text-muted-foreground">{t('acceptConfirmVatHint')}</p>
        <p className="text-sm text-muted-foreground">
          {t('acceptConfirmKeepChat', { company: quote.companyName })}
        </p>
        {acceptError && <p className="mt-2 text-sm text-crimson">{acceptError}</p>}

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            disabled={accept.isPending}
            className="rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {t('acceptConfirmCancel')}
          </button>
          <button
            onClick={() => {
              if (!shown) return;
              accept.mutate(
                { quoteId: quote.id, quoteVersionId: shown.id },
                { onSuccess: () => onOpenChange(false) },
              );
            }}
            disabled={!canConfirm}
            className="rounded-md bg-sage px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {accept.isPending ? t('acceptConfirmPending') : t('acceptConfirmCta')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
