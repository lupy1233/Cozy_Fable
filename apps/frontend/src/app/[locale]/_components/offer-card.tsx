'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { MAX_VALIDITY_EXTENSIONS, type ClaimFirmActionsDto, type QuoteDto, type QuoteVersionDto } from '@marketplace/shared';
import { ApiError } from '@/lib/api';
import {
  useCreateConsultationInvite,
  useEndNegotiation,
  useExtendValidity,
  useRejectChange,
  useRequestChange,
  useRequestExtension,
  useRespondConsultationInvite,
  useWithdrawQuote,
} from '@/hooks/use-quotes';
import { OfferBuilder } from './offer-builder';
import { useNow } from '@/hooks/use-now';
import { isFirmRules, useFirmRules } from '@/hooks/use-legal';
import { ActionConfirmDialog } from './action-confirm-dialog';
import { AcceptOfferDialog } from './accept-offer-dialog';
import { displayedVersion, latestVersion } from '@/lib/quote-version';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export function OfferCard({
  quote,
  mode,
  includesPaidDesign,
  rooms,
  firmActions,
  slaPaused,
  readOnly = false,
}: {
  quote: QuoteDto;
  mode: 'client' | 'company';
  includesPaidDesign: boolean;
  // camerele cererii — pentru defalcarea pe camere in re-ofertare (F7)
  rooms?: { id: string; roomType: string }[];
  // E-company-6: cost/SLA/fereastra de retragere pentru dialogurile firmei (din by-claim)
  firmActions?: ClaimFirmActionsDto;
  slaPaused?: boolean;
  // E-company-3: rezumatul unei preluari inchise — fara actiunile firmei
  readOnly?: boolean;
}) {
  const t = useTranslations('Quotes');
  // E-client-1: pe oferta acceptata se afiseaza versiunea confirmata de client
  const current = displayedVersion(quote);
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
      {mode === 'company' && !readOnly && (
        <CompanyActions
          quote={quote}
          includesPaidDesign={includesPaidDesign}
          pendingChangeId={pendingChange?.id ?? null}
          rooms={rooms}
          firmActions={firmActions}
          slaPaused={slaPaused}
        />
      )}

      <ConsultationInvites quote={quote} mode={mode} />
    </div>
  );
}

function VersionView({ v, quote }: { v: QuoteVersionDto; quote: QuoteDto }) {
  const t = useTranslations('Quotes');
  const tc = useTranslations('Configurator');
  const fmt = (n: number) => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2 }).format(n);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
      {/* defalcarea pe camere (F7, item 22) — tabelul pretului per camera */}
      {v.roomPrices.length > 0 && (
        <div className="col-span-2 mb-1 overflow-hidden rounded-lg border border-border-2">
          <table className="w-full text-sm">
            <tbody>
              {v.roomPrices.map((rp, i) => (
                <tr key={rp.requestRoomId} className={i % 2 ? 'bg-surface-2/60' : undefined}>
                  <td className="px-3 py-1.5">{tc(`rooms.type.${rp.roomType}`)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {fmt(rp.price)} {quote.currency}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border-2 bg-walnut-soft/60">
                <td className="px-3 py-1.5 font-medium">{t('workSubtotal')}</td>
                <td className="px-3 py-1.5 text-right font-serif text-base tabular-nums">
                  {fmt(v.price)} {quote.currency}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
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
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ≈ {fmt((quote.currency === 'RON' ? v.designFeeEur : v.designFeeRon) ?? 0)} {quote.currency === 'RON' ? 'EUR' : 'RON'}
            </span>
          </span>
          {/* E-client-1: totalul ofertei = lucrare + proiectare (docs/03) */}
          <span className="font-medium">{t('offerTotal')}</span>
          <span className="text-right font-serif text-base font-semibold tabular-nums">
            {fmt(v.total)} {quote.currency}
            <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
              ≈ {fmt(quote.currency === 'RON' ? v.totalEur : v.totalRon)} {quote.currency === 'RON' ? 'EUR' : 'RON'}
            </span>
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
        {/* E-admin-platform-3: pe oferta acceptata valabilitatea nu mai conteaza — data acordului */}
        {quote.status === 'ACCEPTED' && quote.acceptedAt
          ? t('acceptedOn', { date: new Date(quote.acceptedAt).toLocaleDateString() })
          : v.isExpired
            ? t('expired')
            : t('validUntil', { date: new Date(v.validUntil).toLocaleDateString() })}
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
  const change = useRequestChange();
  const extension = useRequestExtension();
  const current = latestVersion(quote);
  const [text, setText] = useState('');
  // audit 2026-08-23 (P0 UX): acceptul e ireversibil si deconteaza creditele celorlalte
  // firme — niciodata dintr-un singur click; dialog de confirmare cu consecintele pe fata.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const acceptable = quote.status === 'SENT' && current && !current.isExpired;
  const canRequestChange = quote.status === 'SENT' && !pendingChange && !quote.versionLimitReached;
  const err = (m: { error: unknown }) =>
    m.error instanceof ApiError ? (t.has(`apiErrors.${m.error.code}`) ? t(`apiErrors.${m.error.code}`) : t('apiErrors.INTERNAL_ERROR')) : null;

  if (quote.status === 'ACCEPTED') {
    return <p className="text-sm font-medium text-sage">{t('accepted')}</p>;
  }

  // E-admin-platform-3: oferta expirata nu mai poate fi acceptata — clientul poate cere
  // firmei prelungirea (o singura data per versiune; firma decide).
  if (quote.status === 'EXPIRED') {
    const requested = !!current?.extensionRequestedAt;
    return (
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">{t('expiredClientHint')}</p>
        {requested ? (
          <p className="text-sm font-medium text-sage">{t('extensionRequested')}</p>
        ) : (
          <button
            onClick={() => extension.mutate(quote.id)}
            disabled={extension.isPending}
            className="self-start rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {t('requestExtension')}
          </button>
        )}
        {err(extension) && <p className="text-sm text-crimson">{err(extension)}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={!acceptable}
          className="rounded-md bg-sage px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
        >
          {t('accept')}
        </button>
      </div>

      {/* E-client-1: dialogul reciteste oferta si trimite versiunea confirmata */}
      <AcceptOfferDialog quote={quote} open={confirmOpen} onOpenChange={setConfirmOpen} />


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
  rooms,
  firmActions,
  slaPaused = false,
}: {
  quote: QuoteDto;
  includesPaidDesign: boolean;
  pendingChangeId: string | null;
  rooms?: { id: string; roomType: string }[];
  firmActions?: ClaimFirmActionsDto;
  slaPaused?: boolean;
}) {
  const t = useTranslations('Quotes');
  const tu = useTranslations('Legal.firmRules.units');
  const format = useFormatter();
  // E-company-6: "acum" live — fereastra de retragere si pragul SLA comuta fara reload
  const now = useNow();
  const firmRules = useFirmRules();
  const rules = isFirmRules(firmRules.data) ? firmRules.data : null;
  const [dialog, setDialog] = useState<null | 'reject' | 'extend' | 'endNeg' | 'withdraw'>(null);
  // serverul a cerut confirmarea expirarii (UI vechi fata de SLA) → bifa apare in dialog
  const [forceSlaAck, setForceSlaAck] = useState(false);
  const reject = useRejectChange(quote.id);
  const extend = useExtendValidity(quote.id);
  const withdraw = useWithdrawQuote(quote.id);
  const endNeg = useEndNegotiation(quote.id);
  const invite = useCreateConsultationInvite(quote.id);
  const [showBlock, setShowBlock] = useState(false);
  const [inviteAddr, setInviteAddr] = useState('');
  const [inviteDate, setInviteDate] = useState('');
  const current = quote.versions.reduce((a, b) => (b.version > a.version ? b : a), quote.versions[0]);
  // E-company-2: erorile actiunilor firmei (retragere, prelungire, refuz, inchidere, invitatie)
  // nu mai sunt silentioase — acelasi tipar ca in sectiunea clientului.
  const err = (m: { error: unknown }) =>
    m.error instanceof ApiError ? (t.has(`apiErrors.${m.error.code}`) ? t(`apiErrors.${m.error.code}`) : t('apiErrors.INTERNAL_ERROR')) : null;
  const fmtDate = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const open = (d: NonNullable<typeof dialog>, m: { reset: () => void }) => {
    m.reset();
    setDialog(d);
  };
  const dialogProps = {
    onOpenChange: (o: boolean) => {
      if (!o) setDialog(null);
    },
    cancelLabel: t('confirm.cancel'),
    pendingLabel: t('confirm.pending'),
  };
  // E-company-6: prelungiri folosite pe ultima versiune (max 2 × N zile, 4.13 / D4)
  const extensionsUsed = current?.validityExtensionsUsed ?? 0;
  const extensionsLeft = extensionsUsed < MAX_VALIDITY_EXTENSIONS;
  // E-company-6: retragerea ofertei doar in fereastra de 1 zi lucratoare calculata de server
  const withdrawWindowEndsAt = firmActions?.quoteWithdrawWindowEndsAt ?? null;
  const withdrawWindowOpen = !firmActions || (!!withdrawWindowEndsAt && now < Date.parse(withdrawWindowEndsAt));
  const slaBreachAt = firmActions?.slaBreachAt ?? null;
  const slaBreached = !!slaBreachAt && now >= Date.parse(slaBreachAt);
  const withdrawError = withdraw.error instanceof ApiError ? withdraw.error : null;
  const ackBreachAt =
    slaBreachAt ??
    ((withdrawError?.details as { slaBreachAt?: string } | undefined)?.slaBreachAt ?? null);
  const needsSlaAck = slaBreached || forceSlaAck;
  const claimCredits = tu('credit', { n: firmActions?.claimCostCredits ?? 0 });

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
        <OfferBuilder kind="revise" quoteId={quote.id} changeRequestId={pendingChangeId} includesPaidDesign={includesPaidDesign} rooms={rooms} />
      )}
      {pendingChangeId && (
        <button
          onClick={() => open('reject', reject)}
          disabled={reject.isPending}
          className="self-start rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {t('rejectChange')}
        </button>
      )}
      {err(reject) && <p className="text-sm text-crimson">{err(reject)}</p>}
      {pendingChangeId && (
        <ActionConfirmDialog
          {...dialogProps}
          open={dialog === 'reject'}
          title={t('confirm.rejectTitle')}
          confirmLabel={t('confirm.rejectCta')}
          pending={reject.isPending}
          error={err(reject)}
          onConfirm={() =>
            reject.mutate({ changeRequestId: pendingChangeId }, { onSuccess: () => setDialog(null) })
          }
        >
          <p>{t('confirm.rejectBody')}</p>
        </ActionConfirmDialog>
      )}

      {/* E-admin-platform-3: clientul a cerut prelungirea ofertei expirate */}
      {quote.status === 'EXPIRED' && current?.extensionRequestedAt && (
        <p className="rounded-md border border-amber/25 bg-amber-soft px-3 py-2 text-sm text-amber">
          {t('extensionRequestedByClient')}
        </p>
      )}

      {/* Reofertare la expirare — 2 butoane (A extinde, B modifica) */}
      {current?.isExpired && (
        <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
          <p className="text-sm font-medium">{t('reofferTitle')}</p>
          {extensionsLeft ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => open('extend', extend)}
                disabled={extend.isPending}
                className="self-start rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {t('extendValidity')}
              </button>
              <span className="text-xs text-muted-foreground">
                {t('extensionsUsed', { used: extensionsUsed, max: MAX_VALIDITY_EXTENSIONS })}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('extensionsExhausted', { max: MAX_VALIDITY_EXTENSIONS })}</p>
          )}
          {err(extend) && <p className="text-sm text-crimson">{err(extend)}</p>}
          <ActionConfirmDialog
            {...dialogProps}
            open={dialog === 'extend'}
            title={t('confirm.extendTitle')}
            confirmLabel={t('confirm.extendCta')}
            pending={extend.isPending}
            error={err(extend)}
            confirmDisabled={!extensionsLeft}
            onConfirm={() => extend.mutate({}, { onSuccess: () => setDialog(null) })}
          >
            <p>
              {firmActions
                ? t('confirm.extendBody', { days: tu('day', { n: firmActions.validityExtensionDays }) })
                : t('confirm.extendBodyNoDays')}
            </p>
            <p className="text-muted-foreground">
              {t('confirm.extendCount', { after: extensionsUsed + 1, max: MAX_VALIDITY_EXTENSIONS })}
            </p>
          </ActionConfirmDialog>
          {!quote.versionLimitReached && (
            <OfferBuilder kind="reoffer" quoteId={quote.id} includesPaidDesign={includesPaidDesign} rooms={rooms} />
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
              onClick={() => open('endNeg', endNeg)}
              disabled={endNeg.isPending}
              className="rounded-lg border border-border-2 bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {t('endNegotiation')}
            </button>
          </div>
          {err(endNeg) && <p className="text-sm text-crimson">{err(endNeg)}</p>}
          <ActionConfirmDialog
            {...dialogProps}
            open={dialog === 'endNeg'}
            title={t('confirm.endNegTitle')}
            confirmLabel={t('confirm.endNegCta')}
            tone="danger"
            pending={endNeg.isPending}
            error={err(endNeg)}
            onConfirm={() => endNeg.mutate(undefined, { onSuccess: () => setDialog(null) })}
          >
            <p>{t('confirm.endNegBody')}</p>
          </ActionConfirmDialog>
          {showBlock && <OfferBuilder kind="extra" quoteId={quote.id} includesPaidDesign={includesPaidDesign} rooms={rooms} onDone={() => setShowBlock(false)} />}
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
            {err(invite) && <p className="text-sm text-crimson">{err(invite)}</p>}
          </div>
        </div>
      )}

      {/* Retragere (1 zi lucratoare) — E-company-6: ascunsa dupa inchiderea ferestrei, cu dialog de consecinte */}
      {(quote.status === 'SENT' || quote.status === 'EXPIRED') && withdrawWindowOpen && (
        <div className="flex flex-col gap-1">
          <button
            onClick={() => {
              setForceSlaAck(false);
              open('withdraw', withdraw);
            }}
            disabled={withdraw.isPending}
            className="self-start text-sm text-crimson hover:underline disabled:opacity-50"
          >
            {t('withdraw')}
          </button>
          {withdrawWindowEndsAt && (
            <span className="text-xs text-muted-foreground">
              {t('withdrawUntil', { date: fmtDate(withdrawWindowEndsAt) })}
            </span>
          )}
          <ActionConfirmDialog
            {...dialogProps}
            open={dialog === 'withdraw'}
            title={t('confirm.withdrawTitle')}
            confirmLabel={t('confirm.withdrawCta')}
            tone="danger"
            pending={withdraw.isPending}
            error={err(withdraw)}
            ackLabel={needsSlaAck ? t('confirm.withdrawAck') : undefined}
            onConfirm={() =>
              withdraw.mutate(needsSlaAck ? { acknowledgeSlaBreach: true } : {}, {
                onSuccess: () => setDialog(null),
                onError: (e) => {
                  // UI vechi: serverul vede SLA-ul depasit → dialogul ramane deschis cu bifa obligatorie
                  if (e instanceof ApiError && e.code === 'QUOTE_WITHDRAW_SLA_ACK_REQUIRED') setForceSlaAck(true);
                },
              })
            }
          >
            <p>{t('confirm.withdrawBody')}</p>
            {needsSlaAck && ackBreachAt ? (
              <p className="font-medium text-crimson">
                {t('confirm.withdrawSlaBreached', { date: fmtDate(ackBreachAt), credits: claimCredits })}
              </p>
            ) : slaBreachAt ? (
              <p>{t('confirm.withdrawSlaOk', { date: fmtDate(slaBreachAt), credits: claimCredits })}</p>
            ) : slaPaused ? (
              <p className="text-muted-foreground">{t('confirm.withdrawSlaPaused')}</p>
            ) : null}
            {rules && (needsSlaAck || slaBreachAt) && (
              <p>{t('confirm.slaMissPoints', { points: tu('point', { n: rules.penalties.points.SLA_MISS }) })}</p>
            )}
          </ActionConfirmDialog>
        </div>
      )}
      {err(withdraw) && dialog !== 'withdraw' && <p className="text-sm text-crimson">{err(withdraw)}</p>}
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
          {/* E-company-3: adresa lipseste cand contactele clientului nu sunt vizibile */}
          {inv.locationAddress && <p>{inv.locationAddress}</p>}
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
