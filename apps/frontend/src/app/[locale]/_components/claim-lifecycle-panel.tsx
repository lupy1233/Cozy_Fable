'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  WITHDRAWAL_REASON_TYPES,
  type ClaimQuoteContextDto,
  type ClaimWithdrawalPreviewDto,
  type ClaimWithdrawalReasonPreviewDto,
  type FirmRulesDto,
  type WithdrawalOutcome,
  type WithdrawalReasonType,
} from '@marketplace/shared';
import { ApiError } from '@/lib/api';
import { useSlaDateFormat } from '@/lib/sla-deadline';
import { useMe } from '@/hooks/use-auth';
import { useMyCompany } from '@/hooks/use-company';
import { isFirmRules, useFirmRules } from '@/hooks/use-legal';
import { useNow } from '@/hooks/use-now';
import {
  useClaimClarifications,
  useClaimWithdrawPreview,
  useClaimWithdrawals,
  useRequestClarification,
  useWithdrawClaim,
} from '@/hooks/use-claims-lifecycle';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CardSection } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { firmRulesChunk } from './firm-rules-link';
import { ActionConfirmDialog } from './action-confirm-dialog';

// E-company-1: cerere atribuita/livrata (oglinda REQUEST_SETTLED_STATUSES din backend) —
// castigatorul nu mai poate retrage preluarea.
const SETTLED_REQUEST_STATUSES: string[] = ['ACCEPTED', 'IN_EXECUTION', 'DELIVERED_BY_COMPANY', 'COMPLETED', 'DISPUTED', 'CANCELLED'];
const GRACE_30_MIN_MS = 30 * 60 * 1000;
// oglinda ADMIN_REVIEW_REASONS din withdrawals.service (decizie admin, slotul ramane ocupat)
const ADMIN_REVIEW_REASONS: WithdrawalReasonType[] = ['CUSTOM', 'CLIENT_CONTACT_INVALID', 'CLIENT_REQUESTED_CANCELLATION'];

// Tabul "Clarificari si retragere" al fisei de lucru (design 2026-11): doua carduri — intrebarile
// catre client si retragerea preluarii. Starea preluarii si termenul SLA stau in bara de sus a fisei.
export function ClaimLifecyclePanel({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Lifecycle');
  const tu = useTranslations('Legal.firmRules.units');
  const me = useMe();
  const company = useMyCompany();
  // E-company-9: valorile regulilor (perioada de gratie, praguri) vin din backend; fara date nu afisam indiciul
  const firmRules = useFirmRules();
  const rules = isFirmRules(firmRules.data) ? firmRules.data : null;
  const claimSlotId = ctx.claimSlotId;
  const clarifications = useClaimClarifications(claimSlotId);
  const withdrawals = useClaimWithdrawals(claimSlotId);
  const requestClarification = useRequestClarification(claimSlotId);
  const withdraw = useWithdrawClaim(claimSlotId);
  const format = useFormatter();
  // E-company-6: "acum" reimprospatat — gratia de 30 min comuta fara reload
  const now = useNow();
  const [question, setQuestion] = useState('');
  // E-company-6: niciun motiv preselectat — firma alege explicit
  const [reason, setReason] = useState<WithdrawalReasonType | ''>('');
  const [customReason, setCustomReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fmtDate = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  // E-company-13: termenul SLA in ora Bucurestiului (ca in emailuri si pe bara de lucru)
  const fmtSla = useSlaDateFormat();

  const terminal = !['ACTIVE', 'OFFER_SENT'].includes(ctx.claimStatus);
  // E-company-1: aceleasi reguli ca backendul (409/403) — formularul nu se arata degeaba.
  const isManager = company.data?.myRole === 'OWNER' || company.data?.myRole === 'MANAGER';
  const accepted = ctx.quote?.status === 'ACCEPTED' || SETTLED_REQUEST_STATUSES.includes(ctx.requestStatus);
  const own =
    !!me.data &&
    (ctx.assignment.claimedBy?.userId === me.data.id || ctx.assignment.assignedTo?.userId === me.data.id);
  const withinGrace = now - new Date(ctx.claimedAt).getTime() < GRACE_30_MIN_MS;
  const canWithdraw = !terminal && !accepted && (isManager || (own && withinGrace));
  // E-company-6: consecintele calculate de server (read-only), per motiv
  const preview = useClaimWithdrawPreview(claimSlotId, canWithdraw);
  const pendingWithdrawal =
    preview.data?.pendingWithdrawal ?? withdrawals.data?.find((w) => w.status === 'PENDING_ADMIN_REVIEW') ?? null;
  const reasonPreview = (r: WithdrawalReasonType) => preview.data?.reasons.find((p) => p.reasonType === r);
  // gratia se reevalueaza live fata de graceEndsAt din server (useNow)
  const liveWithinGrace = preview.data ? now < Date.parse(preview.data.graceEndsAt) : withinGrace;
  const outcomeFor = (r: WithdrawalReasonType): WithdrawalOutcome | null => {
    if (r === 'VOLUNTARY_NO_REASON') return liveWithinGrace ? 'REFUND' : 'CONSUME_AND_PENALTY';
    if (ADMIN_REVIEW_REASONS.includes(r)) return 'ADMIN_REVIEW';
    return reasonPreview(r)?.outcome ?? null;
  };
  const wErr = withdraw.error instanceof ApiError ? withdraw.error.code : null;
  const cErr = requestClarification.error instanceof ApiError ? requestClarification.error.code : null;
  const mapErr = (code: string | null) =>
    code ? (t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR')) : null;

  return (
    <div className="flex flex-col gap-5">
      {/* Clarificari */}
      <CardSection title={t('clarifications')} bodyClassName="flex flex-col gap-3">
        {/* pauza SLA apare si aici, langa clarificarea care a produs-o (termenul propriu-zis e in bara de sus) */}
        {ctx.claimStatus === 'ACTIVE' && ctx.slaDeadlineAt && ctx.slaPaused && (
          <Alert tone="info">
            {t('slaDeadline', { date: fmtSla(ctx.slaDeadlineAt) })} · {t('slaPaused')}
          </Alert>
        )}
        {clarifications.data && clarifications.data.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {clarifications.data.map((c) => (
              <li key={c.id} className="rounded-lg bg-surface-2 px-3.5 py-3 text-sm">
                <p className="font-medium">{c.questionText}</p>
                <p className={cn('mt-0.5 text-ui', c.status === 'ANSWERED' ? 'text-ink-2' : 'text-info')}>
                  {c.status === 'ANSWERED' ? `${t('answered')}: ${c.answerText}` : t('awaitingClient')}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          clarifications.isSuccess &&
          ctx.claimStatus !== 'ACTIVE' && <p className="text-sm text-muted-foreground">{t('noClarifications')}</p>
        )}
        {ctx.claimStatus === 'ACTIVE' && (
          <div className="flex flex-col gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              aria-label={t('clarificationPlaceholder')}
              placeholder={t('clarificationPlaceholder')}
            />
            <Button
              variant="outline"
              size="lg"
              className="self-start"
              onClick={() => requestClarification.mutate({ questionText: question.trim() }, { onSuccess: () => setQuestion('') })}
              disabled={question.trim().length < 3 || requestClarification.isPending}
            >
              {t('askClarification')}
            </Button>
            {mapErr(cErr) && <p className="text-sm text-crimson">{mapErr(cErr)}</p>}
          </div>
        )}
      </CardSection>

      {/* Retragere claim */}
      <CardSection title={t('withdrawTitle')} bodyClassName="flex flex-col gap-3">
      {pendingWithdrawal && !terminal ? (
        <Alert tone="amber">
          {t('pendingWithdrawal', {
            date: fmtDate(pendingWithdrawal.createdAt),
            reason: t(`reason.${pendingWithdrawal.reasonType}`),
          })}
        </Alert>
      ) : terminal ? (
        <p className="text-sm text-muted-foreground">
          {t('claimClosed', { status: t(`claimStatus.${ctx.claimStatus}`) })}
        </p>
      ) : accepted ? (
        <p className="text-sm text-muted-foreground">{t('withdrawLockedAccepted')}</p>
      ) : company.isPending || me.isPending ? null : !canWithdraw ? (
        <p className="text-sm text-muted-foreground">{t('withdrawManagersOnly')}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Select
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
            aria-label={t('reasonPlaceholder')}
          >
            <option value="" disabled>
              {t('reasonPlaceholder')}
            </option>
            {WITHDRAWAL_REASON_TYPES.map((r) => {
              const p = reasonPreview(r);
              const notEligible = p?.outcome === 'NOT_ELIGIBLE';
              const label = t(`reason.${r}`);
              return (
                <option key={r} value={r} disabled={notEligible}>
                  {notEligible ? notEligibleLabel(t, label, p, fmtDate) : label}
                </option>
              );
            })}
          </Select>
          {rules && reason !== '' && (
            <p className="text-xs text-muted-foreground">{withdrawOutcomeHint(t, tu, rules, reason, liveWithinGrace)}</p>
          )}
          <p className="text-xs text-muted-foreground">{t.rich('rulesWithdrawLink', { rules: firmRulesChunk('withdrawals') })}</p>
          {reason === 'CUSTOM' && (
            <Textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              rows={2}
              aria-label={t('customReasonPlaceholder')}
              placeholder={t('customReasonPlaceholder')}
            />
          )}
          <Button
            variant="outline"
            size="lg"
            className="self-start border-crimson/40 text-crimson hover:border-crimson/60 hover:bg-crimson-soft"
            onClick={() => {
              // E-company-6: niciodata dintr-un click — dialog cu consecintele recalculate de server
              withdraw.reset();
              setConfirmOpen(true);
              void preview.refetch();
            }}
            disabled={reason === '' || withdraw.isPending || (reason === 'CUSTOM' && customReason.trim().length < 3)}
          >
            {t('withdrawClaim')}
          </Button>
          {reason !== '' && (
            <ActionConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title={t('confirm.title')}
              confirmLabel={t('confirm.cta')}
              cancelLabel={t('confirm.cancel')}
              pendingLabel={t('confirm.pending')}
              pending={withdraw.isPending}
              tone="danger"
              error={mapErr(wErr)}
              confirmDisabled={
                preview.isFetching ||
                !!preview.data?.blockedCode ||
                outcomeFor(reason) === 'NOT_ELIGIBLE' ||
                // fara previzualizare confirmam doar motivele cu decizie admin (serverul ramane autoritar)
                (!preview.data && outcomeFor(reason) !== 'ADMIN_REVIEW')
              }
              onConfirm={() =>
                withdraw.mutate(
                  {
                    reasonType: reason,
                    customReason: reason === 'CUSTOM' ? customReason : undefined,
                    expectedOutcome:
                      reason === 'VOLUNTARY_NO_REASON' ? (liveWithinGrace ? 'REFUND' : 'CONSUME_AND_PENALTY') : undefined,
                  },
                  {
                    onSuccess: () => {
                      setConfirmOpen(false);
                      setReason('');
                      setCustomReason('');
                    },
                    onError: (e) => {
                      // gratia a expirat intre timp → dialogul ramane deschis cu consecintele noi
                      if (e instanceof ApiError && e.code === 'WITHDRAWAL_OUTCOME_CHANGED') void preview.refetch();
                    },
                  },
                )
              }
            >
              <p className="text-muted-foreground">{t('confirm.reason', { reason: t(`reason.${reason}`) })}</p>
              <WithdrawConsequences
                reason={reason}
                outcome={outcomeFor(reason)}
                preview={preview.data ?? null}
                fallbackCredits={ctx.firmActions.claimCostCredits}
                offerSent={ctx.claimStatus === 'OFFER_SENT'}
                claimedAt={ctx.claimedAt}
                loading={preview.isFetching}
                failed={preview.isError}
                withinGrace={liveWithinGrace}
                fmtTime={(iso) => format.dateTime(new Date(iso), { timeStyle: 'short' })}
              />
            </ActionConfirmDialog>
          )}
        </div>
      )}

      {withdrawals.data && withdrawals.data.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="label">{t('history.title')}</h3>
          <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            {withdrawals.data.map((w) => (
              <li key={w.id}>
                <p>
                  {t(`reason.${w.reasonType}`)} → {t(`withdrawalStatus.${w.status}`)}
                  {w.refunded ? ` · ${t('refunded')}` : ''}
                  {w.reviewedAt ? ` · ${t('history.decidedOn', { date: fmtDate(w.reviewedAt) })}` : ''}
                </p>
                {w.customReason && <p className="pl-3">{t('history.customReason', { text: w.customReason })}</p>}
                {w.adminNote && <p className="pl-3">{t('history.adminNote', { note: w.adminNote })}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      </CardSection>
    </div>
  );
}

// E-company-6: corpul dialogului de retragere — ce pierde firma pentru motivul ales. Numerele vin
// din previzualizarea serverului (GET /claims/:id/withdraw-preview), niciodata din UI.
function WithdrawConsequences({
  reason,
  outcome,
  preview,
  fallbackCredits,
  offerSent,
  claimedAt,
  loading,
  failed,
  withinGrace,
  fmtTime,
}: {
  reason: WithdrawalReasonType;
  outcome: WithdrawalOutcome | null;
  preview: ClaimWithdrawalPreviewDto | null;
  fallbackCredits: number;
  offerSent: boolean;
  claimedAt: string;
  loading: boolean;
  failed: boolean;
  withinGrace: boolean;
  fmtTime: (iso: string) => string;
}) {
  const t = useTranslations('Lifecycle');
  const tu = useTranslations('Legal.firmRules.units');
  if (loading && !preview) return <p className="text-muted-foreground">{t('previewLoading')}</p>;
  if (!preview) {
    // fara previzualizare: doar motivele cu decizie admin raman confirmabile
    return (
      <>
        {failed && <p className="text-crimson">{t('previewError')}</p>}
        {outcome === 'ADMIN_REVIEW' && <p>{t('confirm.adminReview', { credits: tu('credit', { n: fallbackCredits }) })}</p>}
        {outcome === 'ADMIN_REVIEW' && offerSent && <p>{t('confirm.offerWithdrawn')}</p>}
      </>
    );
  }
  const credits = tu('credit', { n: preview.claimCostCredits });
  const { lateWithdrawalPoints: points, activePoints, threshold, suspensionMonths } = preview.penalty;
  const graceMinutes = Math.round((Date.parse(preview.graceEndsAt) - Date.parse(claimedAt)) / 60_000);
  const blockedMsg =
    preview.blockedCode && t.has(`apiErrors.${preview.blockedCode}`) ? t(`apiErrors.${preview.blockedCode}`) : null;
  return (
    <>
      {loading && <p className="text-xs text-muted-foreground">{t('previewLoading')}</p>}
      {blockedMsg && <p className="text-crimson">{blockedMsg}</p>}
      {outcome === 'NOT_ELIGIBLE' && <p className="text-crimson">{t('apiErrors.WITHDRAWAL_REASON_NOT_VALIDATED')}</p>}
      {outcome === 'REFUND' && (
        <>
          <p className="font-medium">{t('confirm.refund', { credits })}</p>
          {reason === 'VOLUNTARY_NO_REASON' && withinGrace && (
            <p className="text-muted-foreground">{t('confirm.graceEndsIn', { time: fmtTime(preview.graceEndsAt) })}</p>
          )}
        </>
      )}
      {outcome === 'CONSUME_AND_PENALTY' && (
        <>
          <p className="font-serif text-xl text-crimson tabular-nums">
            {t('confirm.costLine', { credits, points: tu('point', { n: points }) })}
          </p>
          <p>{t('confirm.lateBody', { minutes: tu('minute', { n: graceMinutes }) })}</p>
          <p className="text-muted-foreground">
            {t('confirm.pointsStatus', {
              current: activePoints,
              threshold,
              months: tu('month', { n: suspensionMonths }),
            })}
          </p>
          {activePoints + points >= threshold && (
            <p className="font-medium text-crimson">
              {t('confirm.suspendWarning', { after: activePoints + points, months: tu('month', { n: suspensionMonths }) })}
            </p>
          )}
        </>
      )}
      {outcome === 'ADMIN_REVIEW' && <p>{t('confirm.adminReview', { credits })}</p>}
      {preview.offerWillBeWithdrawn && <p>{t('confirm.offerWithdrawn')}</p>}
      {(outcome === 'REFUND' || outcome === 'CONSUME_AND_PENALTY') && (
        <p className="text-muted-foreground">{t('confirm.slotReleased')}</p>
      )}
    </>
  );
}

// E-company-9: ce se intampla cu creditele si penalizarea pentru motivul ales (oglinda regulilor din
// withdrawals.service; numerele vin din GET /legal/firm-rules). Doar informativ, nu schimba trimiterea.
// E-company-3: eticheta optiunii dezactivate spune ce are de facut firma (sau pana cand asteapta).
function notEligibleLabel(
  t: ReturnType<typeof useTranslations<'Lifecycle'>>,
  reason: string,
  p: ClaimWithdrawalReasonPreviewDto | undefined,
  fmtDate: (iso: string) => string,
): string {
  switch (p?.notEligibleReason) {
    case 'FIRM_MESSAGE_REQUIRED':
      return t('reasonNeedsFirmMessage', { reason });
    case 'OFFER_SENT_AFTER_EDIT':
      return t('reasonOfferAfterEdit', { reason });
    case 'WAITING_48H':
    default:
      // raspuns vechi (fara notEligibleReason) → comportamentul anterior
      return p?.eligibleFrom
        ? t('reasonNotEligibleUntil', { reason, date: fmtDate(p.eligibleFrom) })
        : t('reasonNotEligible', { reason });
  }
}

function withdrawOutcomeHint(
  t: ReturnType<typeof useTranslations<'Lifecycle'>>,
  tu: ReturnType<typeof useTranslations<'Legal.firmRules.units'>>,
  rules: FirmRulesDto,
  reason: WithdrawalReasonType,
  withinGrace: boolean,
) {
  const minutesText = (n: number) => tu('minute', { n });
  switch (reason) {
    case 'VOLUNTARY_NO_REASON':
      return withinGrace
        ? t('withdrawOutcome.voluntaryInGrace', { minutes: minutesText(rules.withdrawals.voluntaryGraceMinutes) })
        : t('withdrawOutcome.voluntaryLate', {
            minutes: minutesText(rules.withdrawals.voluntaryGraceMinutes),
            points: tu('point', { n: rules.penalties.points.VOLUNTARY_WITHDRAWAL }),
          });
    case 'CLIENT_UNRESPONSIVE_48H':
      return t('withdrawOutcome.clientUnresponsive', {
        hours: tu('hour', { n: rules.withdrawals.clientUnresponsiveHours }),
      });
    case 'REQUEST_MODIFIED_POST_CLAIM':
      return t('withdrawOutcome.requestModified');
    default:
      return t('withdrawOutcome.adminReview');
  }
}
