'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { QuoteDto, QuoteVersionDto } from '@marketplace/shared';
import { ApiError } from '@/lib/api';
import {
  useAcceptQuote,
  useCreateConsultationInvite,
  useEndNegotiation,
  useExtendValidity,
  useRejectChange,
  useRequestChange,
  useRespondConsultationInvite,
  useWithdrawQuote,
} from '@/hooks/use-quotes';
import { OfferBuilder } from './offer-builder';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export function OfferCard({
  quote,
  mode,
  includesPaidDesign,
}: {
  quote: QuoteDto;
  mode: 'client' | 'company';
  includesPaidDesign: boolean;
}) {
  const t = useTranslations('Quotes');
  const current = quote.versions.reduce((a, b) => (b.version > a.version ? b : a), quote.versions[0]);
  const pdfUrl = mode === 'client' ? `${API}/client/quotes/${quote.id}/pdf` : `${API}/quotes/${quote.id}/pdf`;
  const pendingChange =
    quote.versions.flatMap((v) => (v.changeRequest && v.changeRequest.status === 'PENDING' ? [v.changeRequest] : []))[0] ??
    null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{quote.companyName}</h3>
          <p className="text-xs text-muted-foreground">
            {t('versionLabel', { n: current?.version ?? 0 })}
            {current?.isExtra ? ` · ${t('extraTag')}` : ''} · {t(`status.${quote.status}`)}
          </p>
        </div>
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-walnut hover:underline">
          {t('downloadPdf')}
        </a>
      </div>

      {current && <VersionView v={current} quote={quote} />}

      {pendingChange && (
        <div className="rounded-md border border-amber/25 bg-amber-soft px-3 py-2 text-sm text-amber">
          {t('changeRequested')}: “{pendingChange.requestedText}”
        </div>
      )}

      {mode === 'client' && (
        <ClientActions quote={quote} pendingChange={!!pendingChange} />
      )}
      {mode === 'company' && (
        <CompanyActions quote={quote} includesPaidDesign={includesPaidDesign} pendingChangeId={pendingChange?.id ?? null} />
      )}

      <ConsultationInvites quote={quote} mode={mode} />
    </div>
  );
}

function VersionView({ v, quote }: { v: QuoteVersionDto; quote: QuoteDto }) {
  const t = useTranslations('Quotes');
  const fmt = (n: number) => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2 }).format(n);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      <span className="text-muted-foreground">{t('builder.price')}</span>
      <span className="text-right font-semibold">
        {fmt(v.price)} {quote.currency}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          ≈ {fmt(quote.currency === 'RON' ? v.priceEur : v.priceRon)} {quote.currency === 'RON' ? 'EUR' : 'RON'}
        </span>
      </span>
      {v.designFee != null && (
        <>
          <span className="text-muted-foreground">{t('builder.designFee')}</span>
          <span className="text-right">
            {fmt(v.designFee)} {quote.currency}
          </span>
        </>
      )}
      {v.deliveryTerm && (
        <>
          <span className="text-muted-foreground">{t('builder.deliveryTerm')}</span>
          <span className="text-right">{v.deliveryTerm}</span>
        </>
      )}
      {v.deliveryDate && (
        <>
          <span className="text-muted-foreground">{t('builder.deliveryDate')}</span>
          <span className="text-right">{new Date(v.deliveryDate).toLocaleDateString()}</span>
        </>
      )}
      {v.warranty && (
        <>
          <span className="text-muted-foreground">{t('builder.warranty')}</span>
          <span className="text-right">{v.warranty}</span>
        </>
      )}
      <span className="col-span-2 mt-1 whitespace-pre-wrap text-foreground">{v.description}</span>
      <span className="col-span-2 text-xs text-muted-foreground">
        {v.isExpired ? t('expired') : t('validUntil', { date: new Date(v.validUntil).toLocaleDateString() })}
      </span>
      {v.attachments.length > 0 && (
        <span className="col-span-2 flex flex-wrap gap-2 text-xs">
          {v.attachments.map((a) => (
            <a key={a.id} href={a.downloadUrl ?? '#'} target="_blank" rel="noreferrer" className="text-walnut underline">
              📎 {a.filename}
            </a>
          ))}
        </span>
      )}
    </div>
  );
}

function ClientActions({ quote, pendingChange }: { quote: QuoteDto; pendingChange: boolean }) {
  const t = useTranslations('Quotes');
  const accept = useAcceptQuote();
  const change = useRequestChange();
  const current = quote.versions.reduce((a, b) => (b.version > a.version ? b : a), quote.versions[0]);
  const [text, setText] = useState('');
  const acceptable = quote.status === 'SENT' && current && !current.isExpired;
  const canRequestChange = quote.status === 'SENT' && !pendingChange && !quote.versionLimitReached;
  const err = (m: typeof accept | typeof change) =>
    m.error instanceof ApiError ? (t.has(`apiErrors.${m.error.code}`) ? t(`apiErrors.${m.error.code}`) : t('apiErrors.INTERNAL_ERROR')) : null;

  if (quote.status === 'ACCEPTED') {
    return <p className="text-sm font-medium text-sage">{t('accepted')}</p>;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => accept.mutate(quote.id)}
          disabled={!acceptable || accept.isPending}
          className="rounded-md bg-sage px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {t('accept')}
        </button>
      </div>
      {err(accept) && <p className="text-sm text-crimson">{err(accept)}</p>}

      {pendingChange && <p className="text-sm text-muted-foreground">{t('awaitingFirm')}</p>}
      {quote.versionLimitReached && !pendingChange && (
        <p className="text-sm text-muted-foreground">{t('limitNoticeClient')}</p>
      )}

      {canRequestChange && (
        <div className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder={t('changePlaceholder')}
            className="rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
          />
          <button
            onClick={() =>
              change.mutate(
                { quoteVersionId: current!.id, requestedText: text.trim() },
                { onSuccess: () => setText('') },
              )
            }
            disabled={text.trim().length < 3 || change.isPending}
            className="self-start rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {t('requestChange')}
          </button>
          {err(change) && <p className="text-sm text-crimson">{err(change)}</p>}
        </div>
      )}
    </div>
  );
}

function CompanyActions({
  quote,
  includesPaidDesign,
  pendingChangeId,
}: {
  quote: QuoteDto;
  includesPaidDesign: boolean;
  pendingChangeId: string | null;
}) {
  const t = useTranslations('Quotes');
  const reject = useRejectChange(quote.id);
  const extend = useExtendValidity(quote.id);
  const withdraw = useWithdrawQuote(quote.id);
  const endNeg = useEndNegotiation(quote.id);
  const invite = useCreateConsultationInvite(quote.id);
  const [showBlock, setShowBlock] = useState(false);
  const [inviteAddr, setInviteAddr] = useState('');
  const [inviteDate, setInviteDate] = useState('');
  const current = quote.versions.reduce((a, b) => (b.version > a.version ? b : a), quote.versions[0]);

  if (quote.status === 'ACCEPTED') {
    return <p className="text-sm font-medium text-sage">{t('acceptedByClient')}</p>;
  }
  if (quote.status === 'WITHDRAWN' || quote.status === 'SUPERSEDED') {
    return <p className="text-sm text-muted-foreground">{t(`status.${quote.status}`)}</p>;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      {/* Raspuns la o cerere de modificare */}
      {pendingChangeId && !quote.versionLimitReached && (
        <OfferBuilder kind="revise" quoteId={quote.id} changeRequestId={pendingChangeId} includesPaidDesign={includesPaidDesign} />
      )}
      {pendingChangeId && (
        <button
          onClick={() => reject.mutate({ changeRequestId: pendingChangeId })}
          disabled={reject.isPending}
          className="self-start rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {t('rejectChange')}
        </button>
      )}

      {/* Reofertare la expirare — 2 butoane (A extinde, B modifica) */}
      {current?.isExpired && (
        <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
          <p className="text-sm font-medium">{t('reofferTitle')}</p>
          <button
            onClick={() => extend.mutate({})}
            disabled={extend.isPending}
            className="self-start rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {t('extendValidity')}
          </button>
          {!quote.versionLimitReached && (
            <OfferBuilder kind="reoffer" quoteId={quote.id} includesPaidDesign={includesPaidDesign} />
          )}
        </div>
      )}

      {/* Block dupa v3: extra voluntara / consultanta / inchidere */}
      {quote.versionLimitReached && !pendingChangeId && (
        <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
          <p className="text-sm font-medium">{t('limitNoticeCompany')}</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowBlock((s) => !s)} className="rounded-lg border border-border-2 bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-secondary">
              {t('extraVersion')}
            </button>
            <button
              onClick={() => endNeg.mutate()}
              disabled={endNeg.isPending}
              className="rounded-lg border border-border-2 bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {t('endNegotiation')}
            </button>
          </div>
          {showBlock && <OfferBuilder kind="extra" quoteId={quote.id} includesPaidDesign={includesPaidDesign} onDone={() => setShowBlock(false)} />}
          <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
            <p className="text-sm font-medium">{t('consultationTitle')}</p>
            <input
              value={inviteAddr}
              onChange={(e) => setInviteAddr(e.target.value)}
              placeholder={t('consultationAddress')}
              className="rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
            />
            <input
              type="datetime-local"
              value={inviteDate}
              onChange={(e) => setInviteDate(e.target.value)}
              className="rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
            />
            <button
              onClick={() =>
                invite.mutate(
                  { locationAddress: inviteAddr, proposedDatetime: new Date(inviteDate).toISOString() },
                  { onSuccess: () => { setInviteAddr(''); setInviteDate(''); } },
                )
              }
              disabled={!inviteAddr || !inviteDate || invite.isPending}
              className="self-start rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {t('sendInvite')}
            </button>
          </div>
        </div>
      )}

      {/* Retragere (1 zi lucratoare) */}
      {(quote.status === 'SENT' || quote.status === 'EXPIRED') && (
        <button
          onClick={() => withdraw.mutate()}
          disabled={withdraw.isPending}
          className="self-start text-sm text-crimson hover:underline disabled:opacity-50"
        >
          {t('withdraw')}
        </button>
      )}
    </div>
  );
}

function ConsultationInvites({ quote, mode }: { quote: QuoteDto; mode: 'client' | 'company' }) {
  const t = useTranslations('Quotes');
  const respond = useRespondConsultationInvite();
  if (quote.consultationInvites.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-sm font-medium">{t('consultationTitle')}</p>
      {quote.consultationInvites.map((inv) => (
        <div key={inv.id} className="rounded-md border border-border p-3 text-sm">
          <p>{inv.locationAddress}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(inv.proposedDatetime).toLocaleString()} · {t(`consultationStatus.${inv.status}`)}
          </p>
          {mode === 'client' && inv.status === 'PENDING_CLIENT' && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => respond.mutate({ inviteId: inv.id, accept: true })}
                className="rounded-md bg-sage px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110"
              >
                {t('inviteAccept')}
              </button>
              <button
                onClick={() => respond.mutate({ inviteId: inv.id, accept: false })}
                className="rounded-lg border border-border-2 bg-surface px-3 py-1.5 text-xs transition-colors hover:bg-secondary"
              >
                {t('inviteDecline')}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
