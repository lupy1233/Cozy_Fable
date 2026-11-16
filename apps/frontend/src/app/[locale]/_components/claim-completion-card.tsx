'use client';

import type { ExecutionStageDto } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { useCompanyCompletion, useMarkDelivered, useSetExecutionStage } from '@/hooks/use-fulfillment';
import { isFirmRules, useFirmRules } from '@/hooks/use-legal';
import { useNow } from '@/hooks/use-now';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { ActionConfirmDialog } from './action-confirm-dialog';
import { useLongDate } from './use-long-date';

const DAY_MS = 24 * 60 * 60 * 1000;

// m1 (revizie e5): pragul de livrare se deblocheaza la minut → data CU ora (ora Romaniei, limba aplicatiei)
function useDateTimeLong(): (iso: string) => string {
  const format = useFormatter();
  return (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'long', timeStyle: 'short', timeZone: APP_TIME_ZONE });
}

const SHOWN_STATUSES = ['DELIVERED_BY_COMPANY', 'COMPLETED', 'DISPUTED'];

// e1 (etapa 5): pe fisa firmei castigatoare conteaza starea PROIECTULUI (cererii), nu a
// preluarii (care ramane OFFER_SENT pana la final). null = proiectul nu e in lucru / anulat.
export type FirmProjectState = 'accepted' | 'delivered' | 'completed';

export function firmProjectState(requestStatus: string): FirmProjectState | null {
  if (requestStatus === 'ACCEPTED' || requestStatus === 'IN_EXECUTION') return 'accepted';
  if (requestStatus === 'DELIVERED_BY_COMPANY') return 'delivered';
  if (requestStatus === 'COMPLETED' || requestStatus === 'DISPUTED') return 'completed';
  return null;
}

// culoarea spune cine are mutarea: in lucru = in regula, livrata = asteapta clientul, finalizata = incheiat
export const FIRM_PROJECT_TONE = { accepted: 'sage', delivered: 'info', completed: 'ink' } as const;

// cine poate bifa etapele — oglinda regulii serverului (setExecutionStage foloseste accesul la fisa
// de lucru): fisa completa si nu angajat limitat pe preluarea altcuiva. OWNER / MANAGER / angajatul
// de incredere / cel atribuit sau care a preluat trec; restul cazurilor le prinde mesajul de la 403.
export function canEditExecutionStages(ctx: {
  visibility?: string | null;
  clientHiddenReason: string | null;
}): boolean {
  const full = !ctx.visibility || ctx.visibility === 'FULL';
  return full && ctx.clientHiddenReason !== 'NOT_ASSIGNED_TO_YOU';
}

// cat timp firma poate bifa etapele (aceeasi regula ca pe server)
export const STAGES_EDITABLE_STATUSES = ['ACCEPTED', 'IN_EXECUTION', 'DELIVERED_BY_COMPANY'];

// Insigna de langa titlul fisei, pe castigator: Acceptata / Livrata — asteapta clientul / Finalizata.
export function FirmProjectBadge({ state }: { state: FirmProjectState }) {
  const t = useTranslations('Fulfillment.firmProject');
  return (
    <Badge tone={FIRM_PROJECT_TONE[state]} dot>
      {t(`badge.${state}`)}
    </Badge>
  );
}

// Continutul celulei de termen din bara de lucru, pe castigator: starea proiectului si datele
// care conteaza (acceptarea, prima zi de livrare, finalizarea automata, finalizarea).
export function FirmProjectStatus({ requestId, state }: { requestId: string; state: FirmProjectState }) {
  const t = useTranslations('Fulfillment.firmProject');
  const fmtDate = useLongDate();
  const fmtDateTime = useDateTimeLong();
  const now = useNow(60_000);
  const completion = useCompanyCompletion(requestId);
  const c = completion.data;
  const earliest = c?.earliestDeliveryAt ?? null;
  return (
    <>
      <span className="label text-current">{t('cellLabel')}</span>
      <p className="font-serif text-2xl leading-tight">{t(`headline.${state}`)}</p>
      {state === 'accepted' && c?.acceptedAt && <p className="text-xs">{t('acceptedOn', { date: fmtDate(c.acceptedAt) })}</p>}
      {state === 'accepted' && earliest && Date.parse(earliest) > now && (
        <p className="text-xs font-medium">{t('deliverFrom', { date: fmtDateTime(earliest) })}</p>
      )}
      {state === 'delivered' &&
        (c?.autoCompleteAt ? (
          <p className="text-xs">{t('autoCompleteOn', { date: fmtDate(c.autoCompleteAt) })}</p>
        ) : c?.openCase ? (
          <p className="text-xs">{t('autoCompletePaused')}</p>
        ) : null)}
      {state === 'completed' && c?.completedAt && (
        <p className="text-xs">{t('completedOn', { date: fmtDate(c.completedAt) })}</p>
      )}
    </>
  );
}

// „Marcheaza ca livrata” (doar OWNER / MANAGER, pe castigator cu proiectul in lucru). e1-3:
// inainte de earliestDeliveryAt butonul e dezactivat, cu data; serverul verifica oricum
// (DELIVERY_TOO_EARLY). Dialogul spune ce urmeaza: clientul confirma sau proiectul se
// finalizeaza automat la data calculata din regulile firmelor.
export function DeliverProjectButton({ requestId }: { requestId: string }) {
  const t = useTranslations('Fulfillment');
  const tp = useTranslations('Fulfillment.firmProject');
  const tu = useTranslations('Legal.firmRules.units');
  const fmtDate = useLongDate();
  const fmtDateTime = useDateTimeLong();
  const now = useNow(60_000);
  const deliver = useMarkDelivered();
  const completion = useCompanyCompletion(requestId);
  // E-company-6: marcarea e ireversibila din aplicatie → dialog cu consecintele (D-L1-1)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const firmRules = useFirmRules();
  const rules = isFirmRules(firmRules.data) ? firmRules.data : null;
  const earliest = completion.data?.earliestDeliveryAt ?? null;
  const tooEarly = earliest != null && Date.parse(earliest) > now;
  const err = deliver.error instanceof ApiError ? deliver.error : null;
  const errDetails = err?.details as { earliestDeliveryAt?: unknown } | undefined;
  const errText = !err
    ? null
    : err.code === 'DELIVERY_TOO_EARLY' && typeof errDetails?.earliestDeliveryAt === 'string'
      ? tp('deliverFrom', { date: fmtDateTime(errDetails.earliestDeliveryAt) })
      : t.has(`apiErrors.${err.code}`)
        ? t(`apiErrors.${err.code}`)
        : t('apiErrors.INTERNAL_ERROR');
  const autoDays = rules?.delivery.autoCompleteDays ?? null;
  const autoCompleteAt = autoDays != null ? new Date(now + autoDays * DAY_MS).toISOString() : null;

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="walnut"
        size="lg"
        className="self-start"
        onClick={() => {
          deliver.reset();
          setConfirmOpen(true);
        }}
        disabled={deliver.isPending || deliver.isSuccess || completion.isPending || tooEarly}
      >
        {deliver.isSuccess ? t('markedDelivered') : t('markDelivered')}
      </Button>
      {tooEarly && earliest && (
        <p className="text-sm text-muted-foreground">{tp('deliverFrom', { date: fmtDateTime(earliest) })}</p>
      )}
      {errText && !confirmOpen && (
        <p role="alert" className="text-sm text-crimson">
          {errText}
        </p>
      )}
      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('deliverConfirmTitle')}
        confirmLabel={t('deliverConfirmCta')}
        cancelLabel={t('deliverConfirmCancel')}
        pendingLabel={t('deliverConfirmPending')}
        pending={deliver.isPending}
        error={errText}
        onConfirm={() => deliver.mutate(requestId, { onSuccess: () => setConfirmOpen(false) })}
      >
        <p>
          {autoCompleteAt && autoDays != null
            ? tp('deliverConfirmNext', { date: fmtDate(autoCompleteAt), days: tu('day', { n: autoDays }) })
            : t('deliverConfirmBodyNoDays')}
        </p>
        <p className="font-medium">{t('deliverConfirmIrreversible')}</p>
      </ActionConfirmDialog>
    </div>
  );
}

// e1-2: „Ce urmeaza” pentru firma — cele 4 etape informative (masuratori, contract, productie,
// montaj). Bifate de firma, vazute de client; nu blocheaza livrarea. Bifeaza doar OWNER /
// MANAGER sau persoana atribuita preluarii (canEdit); ceilalti le vad doar.
export function ExecutionStagesPanel({
  requestId,
  requestStatus,
  canEdit,
}: {
  requestId: string;
  requestStatus: string;
  canEdit: boolean;
}) {
  const t = useTranslations('Fulfillment.stages');
  const tf = useTranslations('Fulfillment');
  const fmtDate = useLongDate();
  const titleId = useId();
  const editable = STAGES_EDITABLE_STATUSES.includes(requestStatus);
  const completion = useCompanyCompletion(requestId, editable);
  const setStage = useSetExecutionStage(requestId);
  if (!editable || !completion.data) return null;
  const stages: ExecutionStageDto[] = completion.data.stages ?? [];
  if (stages.length === 0) return null;
  const err = setStage.error instanceof ApiError ? setStage.error.code : setStage.error ? 'INTERNAL_ERROR' : null;
  // permisiunea: spunem cine are voie, nu doar „nu ai permisiunea”
  const errText = !err
    ? null
    : err === 'FORBIDDEN'
      ? t('forbidden')
      : tf.has(`apiErrors.${err}`)
        ? tf(`apiErrors.${err}`)
        : tf('apiErrors.INTERNAL_ERROR');
  const busyStage = setStage.isPending ? setStage.variables?.stage : null;

  return (
    <Card as="section" aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="heading-card">
          {t('title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
      </div>
      <ul className="flex flex-col gap-1">
        {stages.map((s) => (
          <li key={s.stage}>
            <label className="flex min-h-11 items-start gap-3 py-1.5 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-[18px] shrink-0 accent-walnut disabled:cursor-not-allowed disabled:opacity-60"
                checked={s.done}
                disabled={!canEdit || setStage.isPending}
                aria-busy={busyStage === s.stage || undefined}
                onChange={(e) => setStage.mutate({ stage: s.stage, done: e.target.checked })}
              />
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{t(`name.${s.stage}`)}</span>
                {s.done && s.completedAt && (
                  <span className="text-xs text-muted-foreground">
                    {s.completedByName
                      ? t('doneBy', { date: fmtDate(s.completedAt), name: s.completedByName })
                      : t('doneOn', { date: fmtDate(s.completedAt) })}
                  </span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {!canEdit && <p className="text-xs text-muted-foreground">{t('readOnly')}</p>}
      {errText && (
        <p role="alert" className="text-sm text-crimson">
          {errText}
        </p>
      )}
    </Card>
  );
}

// e2 pasul 4 — pe fisa firmei castigatoare: "Livrare confirmata" + recenzia primita dupa
// finalizare; in starea livrata (sau in garantie) anunta raportul deschis al clientului.
// Componenta isi ia singura datele (GET /company/requests/:id/completion, doar castigatorul).
export function ClaimCompletionCard({ requestId, requestStatus }: { requestId: string; requestStatus: string }) {
  const t = useTranslations('Fulfillment.completion');
  // review m10: limba aplicatiei + ora Romaniei, luna in litere
  const fmtDate = useLongDate();
  const enabled = SHOWN_STATUSES.includes(requestStatus);
  const completion = useCompanyCompletion(requestId, enabled);
  if (!enabled || !completion.data) return null;
  const c = completion.data;
  const finished = c.requestStatus === 'COMPLETED' || c.requestStatus === 'DISPUTED';

  const caseNotice = c.openCase && (
    <div className="flex flex-col gap-1 text-sm">
      <p>
        {c.openCase.reason === 'WARRANTY_CLAIM'
          ? t('openCaseWarranty', { date: fmtDate(c.openCase.createdAt) })
          : t('openCaseDelivered', { date: fmtDate(c.openCase.createdAt) })}
      </p>
      {c.openCase.note && <p className="whitespace-pre-wrap break-words italic">{t('clientNote', { note: c.openCase.note })}</p>}
    </div>
  );

  if (!finished) {
    // starea livrata: cardul apare doar cand clientul a raportat o problema
    if (!c.openCase) return null;
    return (
      <Card as="section" tone="amber" className="flex flex-col gap-2">
        <h2 className="heading-card text-amber">{t('deliveredTitle')}</h2>
        {caseNotice}
      </Card>
    );
  }

  return (
    <Card as="section" tone="sage" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="heading-card text-sage">{t('title')}</h2>
        <p className="text-sm">{c.completedAt ? t('completedOn', { date: fmtDate(c.completedAt) }) : t('completed')}</p>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <h3 className="label">{t('reviewTitle')}</h3>
        {c.review ? (
          <>
            <p>
              <span className="text-brass" aria-label={`${c.review.rating}/5`}>
                {'★'.repeat(c.review.rating)}
                {'☆'.repeat(5 - c.review.rating)}
              </span>
              {c.review.comment ? ` · ${c.review.comment}` : ''}
            </p>
            {c.review.disputed && <p className="text-muted-foreground">{t('disputed')}</p>}
          </>
        ) : (
          <p className="text-muted-foreground">{t('noReview')}</p>
        )}
      </div>
      {caseNotice}
    </Card>
  );
}
