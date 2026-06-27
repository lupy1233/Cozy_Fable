'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { WITHDRAWAL_REASON_TYPES, type ClaimQuoteContextDto } from '@marketplace/shared';
import { ApiError } from '@/lib/api';
import {
  useClaimClarifications,
  useClaimWithdrawals,
  useRequestClarification,
  useWithdrawClaim,
} from '@/hooks/use-claims-lifecycle';

export function ClaimLifecyclePanel({ ctx }: { ctx: ClaimQuoteContextDto }) {
  const t = useTranslations('Lifecycle');
  const claimSlotId = ctx.claimSlotId;
  const clarifications = useClaimClarifications(claimSlotId);
  const withdrawals = useClaimWithdrawals(claimSlotId);
  const requestClarification = useRequestClarification(claimSlotId);
  const withdraw = useWithdrawClaim(claimSlotId);
  const [question, setQuestion] = useState('');
  const [reason, setReason] = useState<(typeof WITHDRAWAL_REASON_TYPES)[number]>('VOLUNTARY_NO_REASON');
  const [customReason, setCustomReason] = useState('');

  const terminal = !['ACTIVE', 'OFFER_SENT'].includes(ctx.claimStatus);
  const wErr = withdraw.error instanceof ApiError ? withdraw.error.code : null;
  const cErr = requestClarification.error instanceof ApiError ? requestClarification.error.code : null;
  const mapErr = (code: string | null) =>
    code ? (t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR')) : null;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h2 className="font-serif text-xl">{t('slaTitle')}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-surface-2 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
            {t(`claimStatus.${ctx.claimStatus}`)}
          </span>
          {ctx.slaDeadlineAt && (
            <span className={ctx.slaPaused ? 'text-amber' : 'text-muted-foreground'}>
              {t('slaDeadline', { date: new Date(ctx.slaDeadlineAt).toLocaleString() })}
              {ctx.slaPaused ? ` · ${t('slaPaused')}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Clarificari */}
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <h3 className="label">{t('clarifications')}</h3>
        {clarifications.data?.map((c) => (
          <div key={c.id} className="rounded-md bg-surface-2 px-3 py-2 text-sm">
            <p className="font-medium">{c.questionText}</p>
            <p className="text-xs text-muted-foreground">
              {c.status === 'ANSWERED' ? `${t('answered')}: ${c.answerText}` : t('awaitingClient')}
            </p>
          </div>
        ))}
        {ctx.claimStatus === 'ACTIVE' && (
          <div className="flex flex-col gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={2}
              placeholder={t('clarificationPlaceholder')}
              className="rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
            />
            <button
              onClick={() => requestClarification.mutate({ questionText: question.trim() }, { onSuccess: () => setQuestion('') })}
              disabled={question.trim().length < 3 || requestClarification.isPending}
              className="self-start rounded-md border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {t('askClarification')}
            </button>
            {mapErr(cErr) && <p className="text-sm text-crimson">{mapErr(cErr)}</p>}
          </div>
        )}
      </div>

      {/* Retragere claim */}
      {!terminal ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="label">{t('withdrawTitle')}</h3>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
            className="rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
          >
            {WITHDRAWAL_REASON_TYPES.map((r) => (
              <option key={r} value={r}>
                {t(`reason.${r}`)}
              </option>
            ))}
          </select>
          {reason === 'CUSTOM' && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              rows={2}
              placeholder={t('customReasonPlaceholder')}
              className="rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
            />
          )}
          <button
            onClick={() =>
              withdraw.mutate({ reasonType: reason, customReason: reason === 'CUSTOM' ? customReason : undefined })
            }
            disabled={withdraw.isPending || (reason === 'CUSTOM' && customReason.trim().length < 3)}
            className="self-start rounded-md border border-crimson/40 px-4 py-2 text-sm text-crimson transition-colors hover:bg-crimson-soft disabled:opacity-50"
          >
            {t('withdrawClaim')}
          </button>
          {mapErr(wErr) && <p className="text-sm text-crimson">{mapErr(wErr)}</p>}
        </div>
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          {t('claimClosed', { status: t(`claimStatus.${ctx.claimStatus}`) })}
        </p>
      )}

      {withdrawals.data && withdrawals.data.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {withdrawals.data.map((w) => (
            <p key={w.id}>
              {t(`reason.${w.reasonType}`)} → {t(`withdrawalStatus.${w.status}`)}
              {w.refunded ? ` · ${t('refunded')}` : ''}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
