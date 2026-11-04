'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  CLIENT_CASE_REASONS,
  COMPANY_CASE_REASONS,
  type ProjectCaseDto,
  type ProjectCaseReason,
} from '@marketplace/shared';
import { ApiError } from '@/lib/api';
import { useOpenProjectCase, useRespondProjectCase } from '@/hooks/use-fulfillment';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// E-admin-platform-3 — "Proiectul s-a blocat?": oricare parte a unui proiect acceptat
// raporteaza (firma nu/clientul nu mai raspunde, anulare de comun acord, alt motiv);
// cealalta parte confirma anularea sau contesta; echipa Cozy Home inchide proiectul.
// Panoul NU inchide nimic singur si nu atinge creditele.
export function ProjectCasePanel({
  requestId,
  mode,
  projectCase,
  canAct,
}: {
  requestId: string;
  mode: 'client' | 'company';
  projectCase: ProjectCaseDto | null;
  // firma: doar OWNER/MANAGER; clientul: mereu
  canAct: boolean;
}) {
  const t = useTranslations('Fulfillment.projectCase');
  const tf = useTranslations('Fulfillment');
  const side = mode === 'client' ? 'client' : 'company';
  const open = useOpenProjectCase(requestId, side);
  const respond = useRespondProjectCase(requestId, side);
  const reasons: readonly ProjectCaseReason[] = mode === 'client' ? CLIENT_CASE_REASONS : COMPANY_CASE_REASONS;
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState<ProjectCaseReason | null>(null);
  const [note, setNote] = useState('');
  const [responseNote, setResponseNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const errText = (m: { error: unknown }) =>
    m.error instanceof ApiError
      ? tf.has(`apiErrors.${m.error.code}`)
        ? tf(`apiErrors.${m.error.code}`)
        : tf('apiErrors.INTERNAL_ERROR')
      : m.error
        ? tf('apiErrors.INTERNAL_ERROR')
        : null;
  const mySide = mode === 'client' ? 'CLIENT' : 'COMPANY';
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString();

  if (projectCase?.status === 'OPEN') {
    const openedByMe = projectCase.openedBy === mySide;
    return (
      <section className="flex flex-col gap-2 rounded-xl border border-amber/30 bg-amber-soft p-4">
        <h2 className="font-serif text-lg text-amber">{openedByMe ? t('reportTitle') : t('respondTitle')}</h2>
        <p className="text-sm">
          <span className="font-medium">{t(`reason.${projectCase.reason}`)}</span>
          {projectCase.note ? ` — “${projectCase.note}”` : ''}
        </p>
        {openedByMe ? (
          <>
            <p className="text-sm">{t('openBody', { date: fmtDate(projectCase.createdAt) })}</p>
            {projectCase.response && (
              <p className="text-sm font-medium">
                {projectCase.response === 'CONFIRMED_CANCEL' ? t('responseConfirmed') : t('responseContested')}
              </p>
            )}
          </>
        ) : projectCase.response ? (
          <p className="text-sm font-medium">
            {projectCase.response === 'CONFIRMED_CANCEL' ? t('youConfirmed') : t('youContested')}
          </p>
        ) : canAct ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={responseNote}
              onChange={(e) => setResponseNote(e.target.value)}
              rows={2}
              maxLength={1000}
              aria-label={t('responseNotePlaceholder')}
              placeholder={t('responseNotePlaceholder')}
              className="rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => respond.mutate({ confirmCancel: true, note: responseNote.trim() || undefined })}
                disabled={respond.isPending}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
              >
                {t('confirmCancel')}
              </button>
              <button
                onClick={() => respond.mutate({ confirmCancel: false, note: responseNote.trim() || undefined })}
                disabled={respond.isPending}
                className="rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {t('contest')}
              </button>
            </div>
            {errText(respond) && <p className="text-sm text-crimson">{errText(respond)}</p>}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('managersOnly')}</p>
        )}
      </section>
    );
  }

  if (projectCase?.status === 'CLOSED_PROJECT_CANCELLED') {
    return (
      <section className="rounded-xl border border-border bg-surface p-4 text-sm">
        <h2 className="font-serif text-lg">{t('cancelledTitle')}</h2>
        {projectCase.resolvedAt && <p className="mt-1">{t('cancelledBody', { date: fmtDate(projectCase.resolvedAt) })}</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      {projectCase?.status === 'DISMISSED' && (
        <p className="text-sm text-muted-foreground">{t('dismissedBody')}</p>
      )}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="self-start text-left font-serif text-lg hover:underline"
      >
        {t('reportTitle')}
      </button>
      {expanded && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t('reportIntro')}</p>
          {canAct ? (
            <>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="label mb-1">{t('reasonLabel')}</legend>
                {reasons.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`project-case-reason-${requestId}`}
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                    />
                    {t(`reason.${r}`)}
                  </label>
                ))}
              </fieldset>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={1000}
                aria-label={t('notePlaceholder')}
                placeholder={t('notePlaceholder')}
                className="rounded-md border border-border-2 bg-surface px-3 py-2 text-sm focus-visible:border-foreground focus-visible:outline-none"
              />
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={!reason || open.isPending}
                className="self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
              >
                {t('submit')}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('managersOnly')}</p>
          )}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!open.isPending) setConfirmOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmTitle')}</DialogTitle>
            <DialogDescription>{t('reportIntro')}</DialogDescription>
          </DialogHeader>
          {reason && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{t(`reason.${reason}`)}</p>}
          {errText(open) && <p className="mt-2 text-sm text-crimson">{errText(open)}</p>}
          <DialogFooter>
            <button
              onClick={() => setConfirmOpen(false)}
              disabled={open.isPending}
              className="rounded-lg border border-border-2 bg-surface px-4 py-2 text-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              onClick={() =>
                reason &&
                open.mutate(
                  { reason, note: note.trim() || undefined },
                  {
                    onSuccess: () => {
                      setConfirmOpen(false);
                      setExpanded(false);
                      setNote('');
                      setReason(null);
                    },
                  },
                )
              }
              disabled={!reason || open.isPending}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
            >
              {t('submit')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
