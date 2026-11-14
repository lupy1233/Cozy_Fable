'use client';

import { CheckCircle2, Download, Paperclip, XCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { MAX_VALIDITY_EXTENSIONS, type ClaimFirmActionsDto, type QuoteDto, type QuoteVersionDto } from '@marketplace/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
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
import { DeclineOfferDialog } from './decline-offer-dialog';
import { useQuoteDate as useLongDate, useQuoteMoney, useVersionTerms } from './use-quote-terms';
import {
  answeredBy,
  changeClosedByOffer,
  displayedVersion,
  isOpenQuote,
  latestVersion,
  versionChangeRequests,
  versionChanges,
} from '@/lib/quote-version';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// spatiul lateral al sectiunilor cardului (cardul insusi e fara padding)
const PAD = 'px-5 sm:px-6';
const DAY_MS = 86_400_000;
// sub acest prag valabilitatea e semnalata cu chihlimbar (la fel ca in tabelul de comparatie)
const EXPIRING_SOON_DAYS = 3;

export function OfferCard({
  quote,
  mode,
  includesPaidDesign,
  rooms,
  firmActions,
  slaPaused,
  readOnly = false,
  headingLevel = 'h3',
  meta,
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
  // nivelul titlului (numele firmei): h2 cand cardul e sectiune de sine statatoare pe pagina
  headingLevel?: 'h2' | 'h3';
  // text scurt adaugat in randul de sub titlu (ex. "a preluat cererea acum 2 zile")
  meta?: ReactNode;
}) {
  const t = useTranslations('Quotes');
  // E-client-1: pe oferta acceptata se afiseaza versiunea confirmata de client
  const current = displayedVersion(quote);
  const pdfUrl = mode === 'client' ? `${API}/client/quotes/${quote.id}/pdf` : `${API}/quotes/${quote.id}/pdf`;
  const pendingChange =
    quote.versions.flatMap((v) => versionChangeRequests(quote, v).filter((c) => c.status === 'PENDING'))[0] ?? null;
  const Heading = headingLevel;
  const declined = quote.status === 'DECLINED';
  // m1: o cerere in asteptare pe o oferta inchisa nu mai e "in asteptare"
  const open = isOpenQuote(quote);
  // m11: dialogul de refuz traieste la nivelul cardului — ramane deschis cu eroarea chiar daca
  // oferta se reimprospateaza; dupa un refuz reusit, focusul ajunge pe anuntul de refuz
  const [declineOpen, setDeclineOpen] = useState(false);
  const [focusDeclined, setFocusDeclined] = useState(false);

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-4', PAD)}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading className={headingLevel === 'h2' ? 'font-serif text-2xl leading-tight' : 'heading-card'}>
            {quote.companyName}
          </Heading>
          <p className="text-ui text-muted-foreground">
            {t('versionLabel', { n: current?.version ?? 0 })}
            {current?.isExtra ? ` · ${t('extraTag')}` : ''} · {t(`status.${quote.status}`)}
            {meta ? <> · {meta}</> : null}
          </p>
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-walnut hover:text-walnut-deep hover:underline"
        >
          <Download className="size-4 shrink-0" aria-hidden />
          {t('downloadPdf')}
        </a>
      </div>

      {current && (
        <VersionView
          v={current}
          quote={quote}
          includesPaidDesign={includesPaidDesign}
          // clientul vede valabilitatea in subsolul cu actiuni, langa butoane
          showValidity={mode === 'company'}
        />
      )}

      {pendingChange && open && (
        <div className={cn('pb-4', PAD)}>
          <Alert tone="amber">
            {t('changeRequested')}: “{pendingChange.requestedText}”
          </Alert>
        </div>
      )}

      {/* a4: toate variantele (v1, v2…) cu diferentele si cererile de modificare */}
      <VersionHistory quote={quote} includesPaidDesign={includesPaidDesign} shownId={current?.id ?? null} />

      {/* a4: refuzul clientului — la client si la firma (inclusiv pe rezumatul unei preluari inchise) */}
      {declined && <DeclinedNotice quote={quote} mode={mode} autoFocus={focusDeclined} />}

      {mode === 'client' && <ConsultationInvites quote={quote} mode="client" />}
      {mode === 'client' && (
        <ClientActions
          quote={quote}
          shown={current}
          pendingChange={!!pendingChange}
          onDecline={() => setDeclineOpen(true)}
        />
      )}
      {mode === 'client' && (
        <DeclineOfferDialog
          quote={quote}
          open={declineOpen}
          onOpenChange={setDeclineOpen}
          onDeclined={() => setFocusDeclined(true)}
        />
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
      {mode === 'company' && <ConsultationInvites quote={quote} mode="company" />}
    </Card>
  );
}

// E-admin-platform-3: pe oferta acceptata valabilitatea nu mai conteaza — data acordului
function ValidityLine({ quote, v }: { quote: QuoteDto; v: QuoteVersionDto }) {
  const t = useTranslations('Quotes');
  const longDate = useLongDate();
  const now = useNow(60_000);
  if (quote.status === 'ACCEPTED' && quote.acceptedAt) {
    return <span className="font-medium text-sage">{t('acceptedOn', { date: longDate(quote.acceptedAt) })}</span>;
  }
  // m2: valabilitatea conteaza doar pe ofertele inca deschise (refuzata / retrasa / inlocuita: nimic)
  if (!isOpenQuote(quote)) return null;
  if (v.isExpired) return <span className="font-medium text-amber">{t('expired')}</span>;
  const soon = Math.floor((Date.parse(v.validUntil) - now) / DAY_MS) <= EXPIRING_SOON_DAYS;
  return (
    <span className={soon ? 'font-medium text-amber' : 'text-muted-foreground'}>
      {t('validUntil', { date: longDate(v.validUntil) })}
    </span>
  );
}

function VersionView({
  v,
  quote,
  includesPaidDesign,
  showValidity,
}: {
  v: QuoteVersionDto;
  quote: QuoteDto;
  includesPaidDesign: boolean;
  showValidity: boolean;
}) {
  const t = useTranslations('Quotes');
  const tc = useTranslations('Configurator');
  const money = useQuoteMoney();
  const terms = useVersionTerms();
  // a4: moneda e a variantei; conversia informativa in cealalta moneda (D-v6-12)
  const cur = v.currency;
  const other = cur === 'RON' ? 'EUR' : 'RON';
  const approx = (ron: number | null, eur: number | null) => {
    const value = cur === 'RON' ? eur : ron;
    return value == null ? null : `≈ ${money(value, other)}`;
  };
  const delivery = terms.delivery(v);
  const warranty = terms.warranty(v);
  const vat = terms.vat(v);
  const included = terms.included(v);
  const row = 'flex justify-between gap-4 border-b border-background py-2.5';
  const amount = 'text-right font-mono text-ui tabular-nums';
  const approxClass = 'ml-2 whitespace-nowrap font-sans text-xs text-muted-foreground';

  return (
    <div className={cn('pb-4 pt-2 text-sm', PAD)}>
      <dl>
        {/* defalcarea pe camere (F7, item 22) — pretul per camera */}
        {v.roomPrices.map((rp) => (
          <div key={rp.requestRoomId} className={row}>
            <dt className="text-muted-foreground">{tc(`rooms.type.${rp.roomType}`)}</dt>
            <dd className={amount}>{money(rp.price, cur)}</dd>
          </div>
        ))}
        {v.designFee != null && (
          <>
            {/* g0-11: la proiectarea cu plata, pretul mobilierului e o estimare */}
            <div className={row}>
              <dt className="text-muted-foreground">
                {includesPaidDesign ? t('furnitureEstimate') : t('workSubtotal')}
              </dt>
              <dd className={amount}>
                {money(v.price, cur)}
                <span className={approxClass}>{approx(v.priceRon, v.priceEur)}</span>
              </dd>
            </div>
            <div className={row}>
              <dt className="text-muted-foreground">{t('builder.designFee')}</dt>
              <dd className={amount}>
                {money(v.designFee, cur)}
                <span className={approxClass}>{approx(v.designFeeRon, v.designFeeEur)}</span>
              </dd>
            </div>
            {v.designIncludes && (
              <div className="flex flex-col gap-1 border-b border-background py-2.5">
                <dt className="text-muted-foreground">{t('builder.design.includes')}</dt>
                <dd className="whitespace-pre-wrap">{v.designIncludes}</dd>
              </div>
            )}
          </>
        )}
        {/* E-client-1: totalul ofertei = lucrare + proiectare (docs/03) */}
        <div className="flex justify-between gap-4 border-b border-border py-3">
          <dt className="font-semibold">{t('offerTotal')}</dt>
          <dd className="text-right">
            <div className="font-mono text-lg font-medium tabular-nums">{money(v.total, cur)}</div>
            <div className="text-xs text-muted-foreground">
              {approx(v.totalRon, v.totalEur)}
              {includesPaidDesign && v.designFee == null && ` · ${t('noDesignFee')}`}
            </div>
          </dd>
        </div>
        {vat && (
          <div className={row}>
            <dt className="text-muted-foreground">{t('builder.vat.label')}</dt>
            <dd className="text-right">{vat}</dd>
          </div>
        )}
        {included && (
          <div className={row}>
            <dt className="text-muted-foreground">{t('builder.included.label')}</dt>
            <dd className="text-right">{included}</dd>
          </div>
        )}
        {delivery && (
          <div className={row}>
            <dt className="text-muted-foreground">{t('builder.deliveryTerm')}</dt>
            <dd className="text-right">{delivery}</dd>
          </div>
        )}
        {warranty && (
          <div className={row}>
            <dt className="text-muted-foreground">{t('builder.warranty')}</dt>
            <dd className="text-right">{warranty}</dd>
          </div>
        )}
        {v.description && (
          <div className="flex flex-col gap-1 py-2.5">
            <dt className="text-muted-foreground">{t('builder.description')}</dt>
            <dd className="whitespace-pre-wrap">{v.description}</dd>
          </div>
        )}
      </dl>
      {includesPaidDesign && v.designFee != null && (
        <p className="mt-1 text-xs text-muted-foreground">{t('designEstimateNote')}</p>
      )}
      {v.attachments.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {v.attachments.map((a) => (
            <li key={a.id}>
              <a
                href={a.downloadUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-8 items-center gap-1.5 text-ui text-walnut underline underline-offset-2 hover:text-walnut-deep"
              >
                <Paperclip className="size-3.5 shrink-0" aria-hidden />
                <span className="break-all">{a.filename}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {showValidity && (isOpenQuote(quote) || quote.status === 'ACCEPTED') && (
        <p className="mt-3 text-ui">
          <ValidityLine quote={quote} v={v} />
        </p>
      )}
    </div>
  );
}

// a4: istoricul variantelor (v1, v2…) cu ce s-a schimbat de la una la alta si cererile de
// modificare ale clientului, ramase vizibile si dupa raspuns. Vizibil la client si la firma.
function VersionHistory({
  quote,
  includesPaidDesign,
  shownId,
}: {
  quote: QuoteDto;
  includesPaidDesign: boolean;
  shownId: string | null;
}) {
  const t = useTranslations('Quotes');
  const titleId = useId();
  const versions = [...quote.versions].sort((a, b) => a.version - b.version);
  const anyChange = versions.some((v) => versionChangeRequests(quote, v).length > 0);
  if (versions.length < 2 && !anyChange) return null;
  return (
    <section aria-labelledby={titleId} className={cn('border-t border-border py-4', PAD)}>
      <p id={titleId} className="text-sm font-semibold">
        {t('history.title')}
      </p>
      <ol className="mt-2.5 flex flex-col gap-2.5">
        {versions.map((v, i) => (
          <VersionEntry
            key={v.id}
            v={v}
            prev={i > 0 ? versions[i - 1] : undefined}
            versions={versions}
            quote={quote}
            includesPaidDesign={includesPaidDesign}
            shown={v.id === shownId}
          />
        ))}
      </ol>
    </section>
  );
}

function VersionEntry({
  v,
  prev,
  versions,
  quote,
  includesPaidDesign,
  shown,
}: {
  v: QuoteVersionDto;
  prev: QuoteVersionDto | undefined;
  versions: QuoteVersionDto[];
  quote: QuoteDto;
  includesPaidDesign: boolean;
  shown: boolean;
}) {
  const t = useTranslations('Quotes');
  const date = useLongDate();
  const money = useQuoteMoney();
  // cererile la care raspunde aceasta varianta (cerute pe o varianta anterioara)
  const answers = versions
    .filter((o) => o.version < v.version)
    .flatMap((o) => versionChangeRequests(quote, o).filter((c) => answeredBy(c, versions) === v.version));
  const asked = versionChangeRequests(quote, v);
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border border-border px-3.5 py-3 text-ui">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-medium">
          {t('versionLabel', { n: v.version })}
          {v.isExtra ? ` · ${t('extraTag')}` : ''}
          {shown ? <span className="font-normal text-muted-foreground"> · {t('history.shownAbove')}</span> : null}
        </span>
        <span className="font-mono tabular-nums">{money(v.total, v.currency)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t('history.sentOn', { date: date(v.sentAt) })}</p>
      {answers.map((c) => (
        <p key={c.id} className="text-muted-foreground">
          {t('history.answersChange')} <span className="text-foreground">“{c.requestedText}”</span>
        </p>
      ))}
      {prev && <VersionDiff prev={prev} v={v} />}
      {asked.map((c) => {
        const by = answeredBy(c, versions);
        const closed = changeClosedByOffer(c, quote);
        const status = closed
          ? t('history.changeClosed')
          : c.status === 'PENDING'
            ? t('history.changePending')
            : c.status === 'REJECTED'
              ? t('history.changeRejected')
              : by != null
                ? t('history.changeAnswered', { n: by })
                : t('history.changeFulfilled');
        return (
          <div key={c.id} className="rounded-md bg-surface-2 px-3 py-2">
            <p>
              <span className="font-medium">{t('history.changeAsked', { date: date(c.createdAt) })}</span>{' '}
              “{c.requestedText}”
            </p>
            <p className={cn('text-xs', c.status === 'PENDING' && !closed ? 'text-amber' : 'text-muted-foreground')}>
              {status}
            </p>
          </div>
        );
      })}
      {!shown && (
        <details>
          <summary className="inline-flex min-h-8 cursor-pointer items-center text-ui text-walnut hover:text-walnut-deep hover:underline">
            {t('history.showTerms', { n: v.version })}
          </summary>
          <div className="-mx-5 sm:-mx-6">
            <VersionView v={v} quote={quote} includesPaidDesign={includesPaidDesign} showValidity={false} />
          </div>
        </details>
      )}
    </li>
  );
}

// ce s-a schimbat fata de varianta precedenta: total (cu diferenta), termen, garantie, TVA,
// ce e inclus in pret, proiectare, descriere
function VersionDiff({ prev, v }: { prev: QuoteVersionDto; v: QuoteVersionDto }) {
  const t = useTranslations('Quotes');
  const money = useQuoteMoney();
  const terms = useVersionTerms();
  const a = prev;
  const b = v;
  const ch = versionChanges(prev, v, terms);
  const dash = '—';
  const items: string[] = [];
  if (ch.total) {
    if (ch.currency) {
      items.push(t('history.diff.totalCurrency', { from: money(a.total, a.currency), to: money(b.total, b.currency) }));
    } else {
      const delta = Math.round((b.total - a.total) * 100) / 100;
      items.push(
        t('history.diff.total', {
          from: money(a.total, a.currency),
          to: money(b.total, b.currency),
          delta: `${delta > 0 ? '+' : '−'}${money(Math.abs(delta), b.currency)}`,
        }),
      );
    }
  }
  if (ch.delivery) {
    items.push(t('history.diff.delivery', { from: terms.delivery(a) || dash, to: terms.delivery(b) || dash }));
  }
  if (ch.warranty) {
    items.push(t('history.diff.warranty', { from: terms.warranty(a) ?? dash, to: terms.warranty(b) ?? dash }));
  }
  if (ch.vat) {
    const label = (s: typeof a) => (s.vatMode ? t(`vatShown.${s.vatMode}`) : dash);
    items.push(t('history.diff.vat', { from: label(a), to: label(b) }));
  }
  if (ch.includes) {
    items.push(t('history.diff.included', { from: terms.included(a) ?? dash, to: terms.included(b) ?? dash }));
  }
  if (ch.design) items.push(t('history.diff.design'));
  if (ch.description) items.push(t('history.diff.description'));
  if (items.length === 0) {
    return <p className="text-muted-foreground">{t('history.diff.none', { n: prev.version })}</p>;
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground">{t('history.diffTitle', { n: prev.version })}</p>
      <ul className="mt-0.5 list-disc pl-5">
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

// a4: oferta refuzata de client — fara actiuni; firma vede motivul si textul, daca exista
function DeclinedNotice({
  quote,
  mode,
  autoFocus = false,
}: {
  quote: QuoteDto;
  mode: 'client' | 'company';
  // m11: dupa un refuz reusit focusul ajunge aici (butonul care a deschis dialogul a disparut)
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const t = useTranslations('Quotes');
  const date = useLongDate();
  const q = quote;
  const on = q.declinedAt ? date(q.declinedAt) : null;
  const who = mode === 'client' ? 'client' : 'company';
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className={cn('flex flex-col gap-1.5 border-t border-border bg-surface-2 py-4 text-sm focus:outline-none', PAD)}
    >
      <p className="flex items-center gap-2 font-medium text-crimson">
        <XCircle className="size-4 shrink-0" aria-hidden />
        {on ? t(`declined.${who}On`, { date: on }) : t(`declined.${who}`)}
      </p>
      {q.declineReason && (
        <p>
          <span className="text-muted-foreground">{t('declined.reasonLabel')}</span>{' '}
          {t(`declineReasons.${q.declineReason}`)}
        </p>
      )}
      {q.declineNote && <p className="whitespace-pre-wrap">“{q.declineNote}”</p>}
      {mode === 'company' && !q.declineReason && !q.declineNote && (
        <p className="text-muted-foreground">{t('declined.noReason')}</p>
      )}
      <p className="text-muted-foreground">{t(`declined.${who}Next`)}</p>
    </div>
  );
}

function ClientActions({
  quote,
  shown,
  pendingChange,
  onDecline,
}: {
  quote: QuoteDto;
  // versiunea afisata pe card (cea acceptata, altfel ultima) — pentru randul de valabilitate
  shown: QuoteVersionDto | undefined;
  pendingChange: boolean;
  // a4: deschide dialogul de refuz (tinut de card, ca sa supravietuiasca reimprospatarii)
  onDecline: () => void;
}) {
  const t = useTranslations('Quotes');
  const change = useRequestChange();
  const extension = useRequestExtension();
  const current = latestVersion(quote);
  const [text, setText] = useState('');
  // formularul "Cere modificare" se deschide din buton, sub actiuni
  const [changeOpen, setChangeOpen] = useState(false);
  const changeFormId = useId();
  const changeFieldRef = useRef<HTMLTextAreaElement>(null);
  // audit 2026-08-23 (P0 UX): acceptul e ireversibil si deconteaza creditele celorlalte
  // firme — niciodata dintr-un singur click; dialog de confirmare cu consecintele pe fata.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const acceptable = quote.status === 'SENT' && current && !current.isExpired;
  const canRequestChange = quote.status === 'SENT' && !pendingChange && !quote.versionLimitReached;
  const err = (m: { error: unknown }) =>
    m.error instanceof ApiError ? (t.has(`apiErrors.${m.error.code}`) ? t(`apiErrors.${m.error.code}`) : t('apiErrors.INTERNAL_ERROR')) : null;

  useEffect(() => {
    if (changeOpen) changeFieldRef.current?.focus();
  }, [changeOpen]);

  const footer = cn('mt-auto flex flex-col gap-3 border-t border-border bg-surface-2 pb-5 pt-4', PAD);
  const validity = shown ? <ValidityLine quote={quote} v={shown} /> : null;

  if (quote.status === 'ACCEPTED') {
    return (
      <div className={footer}>
        <p className="flex items-center gap-2 text-sm font-medium text-sage">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {t('accepted')}
        </p>
        {validity && <p className="text-ui">{validity}</p>}
      </div>
    );
  }

  // E-admin-platform-3: oferta expirata nu mai poate fi acceptata — clientul poate cere
  // firmei prelungirea (o singura data per versiune; firma decide).
  if (quote.status === 'EXPIRED') {
    const requested = !!current?.extensionRequestedAt;
    return (
      <div className={footer}>
        {validity && <p className="text-sm">{validity}</p>}
        <p className="text-sm text-muted-foreground">{t('expiredClientHint')}</p>
        {requested ? (
          <p className="text-sm font-medium text-info">{t('extensionRequested')}</p>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => extension.mutate(quote.id)}
            disabled={extension.isPending}
            className="self-start"
          >
            {t('requestExtension')}
          </Button>
        )}
        {err(extension) && (
          <p role="alert" className="text-sm text-crimson">
            {err(extension)}
          </p>
        )}
      </div>
    );
  }

  // a4: refuzata — anuntul (cu data si motivul) e deja pe card, fara actiuni
  if (quote.status === 'DECLINED') return null;

  // retrasa / inlocuita: nimic de facut pe ea
  if (quote.status !== 'SENT') {
    return (
      <div className={footer}>
        <p className="text-sm text-muted-foreground">{t('inactiveNote')}</p>
      </div>
    );
  }

  return (
    <div className={footer}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {validity && <span className="text-sm">{validity}</span>}
        <div className="flex flex-wrap gap-2.5">
          {canRequestChange && (
            <Button
              type="button"
              variant="outline"
              size="xl"
              aria-expanded={changeOpen}
              aria-controls={changeOpen ? changeFormId : undefined}
              onClick={() => setChangeOpen((o) => !o)}
              className="px-4 text-sm"
            >
              {t('requestChange')}
            </Button>
          )}
          <Button
            type="button"
            variant="walnut"
            size="xl"
            onClick={() => setConfirmOpen(true)}
            disabled={!acceptable}
            className="px-6 text-lead"
          >
            {t('accept')}
          </Button>
        </div>
      </div>
      {acceptable && <p className="text-ui text-muted-foreground">{t('acceptHint')}</p>}

      {/* a4: refuzul ofertei — dialog cu consecintele si motivul optional */}
      <button
        type="button"
        onClick={onDecline}
        className="inline-flex min-h-10 items-center self-start rounded-md text-sm font-medium text-crimson hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/40"
      >
        {t('decline.open')}
      </button>

      {/* E-client-1: dialogul reciteste oferta si trimite versiunea confirmata */}
      <AcceptOfferDialog quote={quote} open={confirmOpen} onOpenChange={setConfirmOpen} />

      {pendingChange && <p className="text-sm text-info">{t('awaitingFirm')}</p>}
      {quote.versionLimitReached && !pendingChange && (
        <p className="text-sm text-muted-foreground">{t('limitNoticeClient')}</p>
      )}

      {canRequestChange && changeOpen && (
        <div id={changeFormId} className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3.5">
          <label htmlFor={`${changeFormId}-text`} className="text-sm font-medium">
            {t('changePlaceholder')}
          </label>
          <Textarea
            ref={changeFieldRef}
            id={`${changeFormId}-text`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="min-h-[72px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="lg"
              onClick={() =>
                change.mutate(
                  { quoteVersionId: current!.id, requestedText: text.trim() },
                  {
                    onSuccess: () => {
                      setText('');
                      setChangeOpen(false);
                    },
                  },
                )
              }
              disabled={text.trim().length < 3 || change.isPending}
            >
              {t('sendChangeRequest')}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={() => setChangeOpen(false)}>
              {t('changeCancel')}
            </Button>
          </div>
          {err(change) && (
            <p role="alert" className="text-sm text-crimson">
              {err(change)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// buton secundar al firmei cu text lung: se poate rupe pe doua randuri in coloana ingusta
const WRAP_BUTTON = 'h-auto min-h-10 self-start whitespace-normal py-2 text-left';

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
    return (
      <p className={cn('flex items-center gap-2 border-t border-border py-4 text-sm font-medium text-sage', PAD)}>
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        {t('acceptedByClient')}
      </p>
    );
  }
  // a4: refuzata de client — anuntul cu motivul e deja pe card; nimic de facut
  if (quote.status === 'DECLINED') return null;
  if (quote.status === 'WITHDRAWN' || quote.status === 'SUPERSEDED') {
    return (
      <p className={cn('border-t border-border py-4 text-sm text-muted-foreground', PAD)}>
        {t(`status.${quote.status}`)}
      </p>
    );
  }

  const showExtensionRequested = quote.status === 'EXPIRED' && !!current?.extensionRequestedAt;
  const showReoffer = !!current?.isExpired;
  const showLimitBlock = quote.versionLimitReached && !pendingChangeId;
  const showWithdraw = (quote.status === 'SENT' || quote.status === 'EXPIRED') && withdrawWindowOpen;
  // nimic de facut acum pe oferta → fara banda goala sub ea
  if (
    !pendingChangeId &&
    !showExtensionRequested &&
    !showReoffer &&
    !showLimitBlock &&
    !showWithdraw &&
    !err(reject) &&
    !err(withdraw)
  ) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-3 border-t border-border py-4', PAD)}>
      {/* Raspuns la o cerere de modificare */}
      {pendingChangeId && !quote.versionLimitReached && (
        <OfferBuilder key={current?.id} kind="revise" quoteId={quote.id} changeRequestId={pendingChangeId} includesPaidDesign={includesPaidDesign} rooms={rooms} currency={quote.currency} previous={current} />
      )}
      {pendingChangeId && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => open('reject', reject)}
          disabled={reject.isPending}
          className="self-start"
        >
          {t('rejectChange')}
        </Button>
      )}
      {err(reject) && (
        <p role="alert" className="text-sm text-crimson">
          {err(reject)}
        </p>
      )}
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
      {showExtensionRequested && <Alert tone="amber">{t('extensionRequestedByClient')}</Alert>}

      {/* Reofertare la expirare — 2 butoane (A extinde, B modifica) */}
      {showReoffer && (
        <div className="flex flex-col gap-2.5 rounded-lg bg-surface-2 p-3.5">
          <p className="text-sm font-medium">{t('reofferTitle')}</p>
          {extensionsLeft ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => open('extend', extend)}
                disabled={extend.isPending}
                className={WRAP_BUTTON}
              >
                {t('extendValidity')}
              </Button>
              <span className="font-mono text-xs text-muted-foreground">
                {t('extensionsUsed', { used: extensionsUsed, max: MAX_VALIDITY_EXTENSIONS })}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('extensionsExhausted', { max: MAX_VALIDITY_EXTENSIONS })}</p>
          )}
          {err(extend) && (
            <p role="alert" className="text-sm text-crimson">
              {err(extend)}
            </p>
          )}
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
            <OfferBuilder key={current?.id} kind="reoffer" quoteId={quote.id} includesPaidDesign={includesPaidDesign} rooms={rooms} currency={quote.currency} previous={current} />
          )}
        </div>
      )}

      {/* Block dupa v3: extra voluntara / consultanta / inchidere */}
      {showLimitBlock && (
        <div className="flex flex-col gap-2.5 rounded-lg bg-surface-2 p-3.5">
          <p className="text-sm font-medium">{t('limitNoticeCompany')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              aria-expanded={showBlock}
              onClick={() => setShowBlock((s) => !s)}
            >
              {t('extraVersion')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => open('endNeg', endNeg)}
              disabled={endNeg.isPending}
            >
              {t('endNegotiation')}
            </Button>
          </div>
          {err(endNeg) && (
            <p role="alert" className="text-sm text-crimson">
              {err(endNeg)}
            </p>
          )}
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
          {showBlock && <OfferBuilder key={current?.id} kind="extra" quoteId={quote.id} includesPaidDesign={includesPaidDesign} rooms={rooms} currency={quote.currency} previous={current} onDone={() => setShowBlock(false)} />}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3.5">
            <p className="text-sm font-medium">{t('consultationTitle')}</p>
            <Input
              value={inviteAddr}
              onChange={(e) => setInviteAddr(e.target.value)}
              placeholder={t('consultationAddress')}
              aria-label={t('consultationAddress')}
            />
            <Input
              type="datetime-local"
              value={inviteDate}
              onChange={(e) => setInviteDate(e.target.value)}
            />
            <Button
              type="button"
              size="lg"
              onClick={() =>
                invite.mutate(
                  { locationAddress: inviteAddr, proposedDatetime: new Date(inviteDate).toISOString() },
                  { onSuccess: () => { setInviteAddr(''); setInviteDate(''); } },
                )
              }
              disabled={!inviteAddr || !inviteDate || invite.isPending}
              className="self-start"
            >
              {t('sendInvite')}
            </Button>
            {err(invite) && (
              <p role="alert" className="text-sm text-crimson">
                {err(invite)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Retragere (1 zi lucratoare) — E-company-6: ascunsa dupa inchiderea ferestrei, cu dialog de consecinte */}
      {showWithdraw && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              setForceSlaAck(false);
              open('withdraw', withdraw);
            }}
            disabled={withdraw.isPending}
            className="inline-flex min-h-10 items-center self-start rounded-md text-sm font-medium text-crimson hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/40 disabled:opacity-50"
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
      {err(withdraw) && dialog !== 'withdraw' && (
        <p role="alert" className="text-sm text-crimson">
          {err(withdraw)}
        </p>
      )}
    </div>
  );
}

function ConsultationInvites({ quote, mode }: { quote: QuoteDto; mode: 'client' | 'company' }) {
  const t = useTranslations('Quotes');
  const respond = useRespondConsultationInvite();
  if (quote.consultationInvites.length === 0) return null;
  // M3 (revizuire etapa 4): raspunsul la invitatie doar pe oferta inca valabila (SENT, neexpirata);
  // pe oferta refuzata / retrasa / inlocuita / expirata serverul ar raspunde 409
  const canRespond = quote.status === 'SENT' && !latestVersion(quote)?.isExpired;
  const respondError =
    respond.error instanceof ApiError
      ? t.has(`apiErrors.${respond.error.code}`)
        ? t(`apiErrors.${respond.error.code}`)
        : t('apiErrors.INTERNAL_ERROR')
      : respond.error
        ? t('apiErrors.INTERNAL_ERROR')
        : null;
  return (
    <div className={cn('flex flex-col gap-2 border-t border-border py-4', PAD)}>
      <p className="text-sm font-medium">{t('consultationTitle')}</p>
      {quote.consultationInvites.map((inv) => (
        <div key={inv.id} className="rounded-lg border border-border p-3.5 text-sm">
          {/* E-company-3: adresa lipseste cand contactele clientului nu sunt vizibile */}
          {inv.locationAddress && <p>{inv.locationAddress}</p>}
          <p className="text-xs text-muted-foreground">
            {new Date(inv.proposedDatetime).toLocaleString()} · {t(`consultationStatus.${inv.status}`)}
          </p>
          {mode === 'client' && canRespond && inv.status === 'PENDING_CLIENT' && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ inviteId: inv.id, accept: true })}
              >
                {t('inviteAccept')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={respond.isPending}
                onClick={() => respond.mutate({ inviteId: inv.id, accept: false })}
              >
                {t('inviteDecline')}
              </Button>
            </div>
          )}
          {/* M3: eroarea raspunsului apare langa invitatia la care s-a raspuns */}
          {mode === 'client' && respondError && respond.variables?.inviteId === inv.id && (
            <p role="alert" className="mt-2 text-sm text-crimson">
              {respondError}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
