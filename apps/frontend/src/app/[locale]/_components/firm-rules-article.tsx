'use client';

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LEGAL_TERMS_VERSION, type FirmRulesDto } from '@marketplace/shared';
import { Link } from '@/i18n/routing';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isFirmRules, isPublishedOperator, useFirmRules, useLegalOperator } from '@/hooks/use-legal';
import { cn } from '@/lib/utils';
import { LEGAL_SUMMARY_ID, LegalBody, LegalLayout, type LegalTocItem } from './legal-layout';
import { FIRM_RULES_SECTIONS, FIRM_RULES_SUMMARY } from './legal-sections';

const PENALTY_ITEMS = ['SLA_MISS', 'VOLUNTARY_WITHDRAWAL'] as const;

const BODY_CLS = 'text-lead leading-relaxed text-ink-2';

// E-company-9: "Reguli pentru firme". Textul vine din i18n, TOATE numerele din GET /legal/firm-rules
// (setari + penalty_rules + constantele de enforcement). Fara valori de rezerva in UI: cat timp datele
// lipsesc arata stare de incarcare/eroare, niciodata numere inventate.
// Design 2026-11: cuprins in stanga, cardul „Pe scurt” (valorile vin din ACELEASI argumente ca textul)
// si sectiunile numerotate; `children` = ce urmeaza dupa sectiuni (indemnul de inscriere).
export function FirmRulesArticle({ children }: { children?: ReactNode }) {
  const t = useTranslations('Legal.firmRules');
  const tl = useTranslations('Legal');
  const rules = useFirmRules();
  const operator = useLegalOperator();
  const summaryTitleId = useId();

  const contactEmail = isPublishedOperator(operator.data) ? operator.data.contactEmail : tl('operator.contactPending');
  const data = isFirmRules(rules.data) ? rules.data : null;

  const title = (
    <>
      <h1 className="page-title">{t('title')}</h1>
      <p className="label">
        {tl('lastUpdated')} · {tl('versionLabel', { version: LEGAL_TERMS_VERSION })}
      </p>
    </>
  );

  if (!data) {
    return (
      <LegalLayout header={title} toc={null}>
        {rules.isPending ? (
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        ) : (
          <Alert
            tone="crimson"
            action={
              <Button variant="outline" size="sm" onClick={() => void rules.refetch()}>
                {t('retry')}
              </Button>
            }
          >
            {t('loadError')}
          </Alert>
        )}
      </LegalLayout>
    );
  }

  // raspuns de la un backend mai vechi (blue/green) poate sa nu aiba claimCost
  const claimCost = data.claims.claimCost as FirmRulesDto['claims']['claimCost'] | undefined;

  const unit = (kind: 'month' | 'day' | 'workingDay' | 'hour' | 'minute' | 'point' | 'credit', n: number) =>
    t(`units.${kind}`, { n });

  const args = {
    reapplyMonths: unit('month', data.verification.reapplyBlockMonths),
    plan: data.trial.plan,
    durationDays: unit('day', data.trial.durationDays),
    bonusCredits: unit('credit', data.trial.bonusCredits),
    maxClaims: data.claims.maxClaimsPerRequest,
    assignMinutes: unit('minute', data.claims.assignDeadlineMinutes),
    autoCompleteDays: unit('day', data.delivery.autoCompleteDays),
    small: unit('workingDay', data.sla.workingDays.SMALL),
    medium: unit('workingDay', data.sla.workingDays.MEDIUM),
    large: unit('workingDay', data.sla.workingDays.LARGE),
    clarificationDays: unit('workingDay', data.sla.clarificationExtensionWorkingDays),
    graceHours: unit('hour', data.sla.graceHours),
    slaMissPoints: unit('point', data.penalties.points.SLA_MISS),
    graceMinutes: unit('minute', data.withdrawals.voluntaryGraceMinutes),
    withdrawalPoints: unit('point', data.penalties.points.VOLUNTARY_WITHDRAWAL),
    unresponsiveHours: unit('hour', data.withdrawals.clientUnresponsiveHours),
    windowDays: unit('day', data.penalties.windowDays),
    threshold: unit('point', data.penalties.companyThreshold),
    months: unit('month', data.penalties.suspensionMonths),
    contactEmail,
  };

  // „Pe scurt”: aceleasi argumente ca textul sectiunilor. O regula cu 0 puncte nu afiseaza
  // „0 puncte” (ca in lista de penalizari), ramane doar consumul creditelor.
  const penaltyValue = (rule: (typeof PENALTY_ITEMS)[number], points: string) =>
    data.penalties.points[rule] > 0
      ? t('summary.values.pointsAndCredits', { points })
      : t('summary.values.creditsConsumed');
  const summaryValues: Record<(typeof FIRM_RULES_SUMMARY)[number], string> = {
    freeWithdrawal: t('summary.values.freeWithdrawal', args),
    slaMiss: penaltyValue('SLA_MISS', args.slaMissPoints),
    voluntaryWithdrawal: penaltyValue('VOLUNTARY_WITHDRAWAL', args.withdrawalPoints),
    suspension: t('summary.values.suspension', args),
    reapply: t('summary.values.reapply', args),
  };

  const toc: LegalTocItem[] = [
    { id: LEGAL_SUMMARY_ID, label: tl('summary.title') },
    ...FIRM_RULES_SECTIONS.map((key) => ({ id: key, label: t(`sections.${key}.h`) })),
  ];

  return (
    <LegalLayout
      toc={toc}
      header={
        <>
          {title}
          <p className={BODY_CLS}>
            {t.rich('intro', {
              terms: (chunks) => (
                <Link href="/terms" className="text-walnut underline underline-offset-2 hover:text-walnut-deep">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </>
      }
    >
      <Card
        as="section"
        id={LEGAL_SUMMARY_ID}
        padding="none"
        aria-labelledby={summaryTitleId}
        className="scroll-mt-24 overflow-hidden"
      >
        <h2 id={summaryTitleId} className="heading-section border-b border-border px-5 py-4">
          {t('summary.title')}
        </h2>
        <dl>
          {FIRM_RULES_SUMMARY.map((key) => (
            <div key={key} className="grid gap-1 border-b border-border px-5 py-3 text-sm sm:grid-cols-2 sm:gap-6">
              <dt className="text-muted-foreground">{t(`summary.rows.${key}`, args)}</dt>
              <dd className="font-mono text-ui font-medium">{summaryValues[key]}</dd>
            </div>
          ))}
        </dl>
        <p className="px-5 py-3 text-ui text-muted-foreground">{tl('summary.note')}</p>
      </Card>

      {FIRM_RULES_SECTIONS.map((key) => {
        const bodyKey = key === 'trial' && !data.trial.enabled ? 'bOff' : 'b';
        return (
          <section key={key} id={key} className="flex scroll-mt-24 flex-col gap-2.5">
            <h2 className="font-serif text-2xl leading-tight">{t(`sections.${key}.h`)}</h2>
            <div className="flex flex-col gap-3">
              <LegalBody text={t(`sections.${key}.${bodyKey}`, args)} className={BODY_CLS} />
              {key === 'credits' && (
                <>
                  {/* E-admin-platform-10: regula in vigoare pentru preluare dupa prima oferta */}
                  <p className={BODY_CLS}>
                    {t(
                      data.claims.openAfterFirstOffer
                        ? 'sections.credits.afterOfferOpen'
                        : 'sections.credits.afterOfferClosed',
                      args,
                    )}
                  </p>
                  {/* E-company-21: intervalul costului apare doar cand exista o limita reala
                      (claim_cost_max > 0 sau claim_cost_min > 1); cu implicitele pagina nu se schimba */}
                  {claimCost && (claimCost.max !== null || claimCost.min > 1) && (
                    <p className={BODY_CLS}>
                      {claimCost.max !== null
                        ? t('sections.credits.costRange', {
                            min: unit('credit', claimCost.min),
                            max: unit('credit', claimCost.max),
                          })
                        : t('sections.credits.costMin', { min: unit('credit', claimCost.min) })}
                    </p>
                  )}
                </>
              )}
              {key === 'withdrawals' && (
                // E-company-3: cand vede firma datele de contact (setare in vigoare, DECIZIE NECESARA PO)
                <>
                  <p className={BODY_CLS}>
                    {t(
                      data.claims.contactRevealPolicy === 'AFTER_GRACE'
                        ? 'sections.withdrawals.contactsAfterGrace'
                        : 'sections.withdrawals.contactsOnClaim',
                      args,
                    )}
                  </p>
                  {data.claims.completedContactRetentionDays > 0 && (
                    <p className={BODY_CLS}>
                      {t('sections.withdrawals.contactsRetention', {
                        days: unit('day', data.claims.completedContactRetentionDays),
                      })}
                    </p>
                  )}
                </>
              )}
              {key === 'penalties' && (
                <>
                  <ul className={cn('flex list-disc flex-col gap-2 pl-5', BODY_CLS)}>
                    {PENALTY_ITEMS.filter((r) => data.penalties.points[r] > 0).map((r) => (
                      <li key={r}>
                        {t(`sections.penalties.items.${r}`, { points: unit('point', data.penalties.points[r]) })}
                      </li>
                    ))}
                  </ul>
                  <p className={BODY_CLS}>{t('sections.penalties.after', args)}</p>
                </>
              )}
            </div>
          </section>
        );
      })}

      {children}
    </LegalLayout>
  );
}
