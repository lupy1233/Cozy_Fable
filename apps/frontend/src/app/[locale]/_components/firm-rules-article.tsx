'use client';

import { useTranslations } from 'next-intl';
import { LEGAL_TERMS_VERSION, type FirmRulesDto } from '@marketplace/shared';
import { Link } from '@/i18n/routing';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { isFirmRules, isPublishedOperator, useFirmRules, useLegalOperator } from '@/hooks/use-legal';
import { FIRM_RULES_SECTIONS } from './legal-sections';

const PENALTY_ITEMS = ['SLA_MISS', 'VOLUNTARY_WITHDRAWAL'] as const;

// E-company-9: "Reguli pentru firme". Textul vine din i18n, TOATE numerele din GET /legal/firm-rules
// (setari + penalty_rules + constantele de enforcement). Fara valori de rezerva in UI: cat timp datele
// lipsesc arata stare de incarcare/eroare, niciodata numere inventate.
export function FirmRulesArticle() {
  const t = useTranslations('Legal.firmRules');
  const tl = useTranslations('Legal');
  const rules = useFirmRules();
  const operator = useLegalOperator();

  const contactEmail = isPublishedOperator(operator.data) ? operator.data.contactEmail : tl('operator.contactPending');
  const data = isFirmRules(rules.data) ? rules.data : null;

  // raspuns de la un backend mai vechi (blue/green) poate sa nu aiba claimCost
  const claimCost = data?.claims.claimCost as FirmRulesDto['claims']['claimCost'] | undefined;

  const unit = (kind: 'month' | 'day' | 'workingDay' | 'hour' | 'minute' | 'point' | 'credit', n: number) =>
    t(`units.${kind}`, { n });

  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="page-title">{t('title')}</h1>
      <p className="label mt-3">
        {tl('lastUpdated')} · {tl('versionLabel', { version: LEGAL_TERMS_VERSION })}
      </p>

      {rules.isPending ? (
        <p className="mt-8 text-sm text-muted-foreground">{t('loading')}</p>
      ) : !data ? (
        <Alert
          tone="crimson"
          className="mt-8"
          action={
            <Button variant="outline" size="sm" onClick={() => void rules.refetch()}>
              {t('retry')}
            </Button>
          }
        >
          {t('loadError')}
        </Alert>
      ) : (
        <>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            {t.rich('intro', {
              terms: (chunks) => (
                <Link href="/terms" className="text-walnut underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <div className="mt-8 flex flex-col gap-8">
            {FIRM_RULES_SECTIONS.map((key) => {
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
              const bodyKey = key === 'trial' && !data.trial.enabled ? 'bOff' : 'b';
              return (
                <section key={key} id={key} className="scroll-mt-24">
                  <h2 className="font-serif text-xl">{t(`sections.${key}.h`)}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {t(`sections.${key}.${bodyKey}`, args)}
                  </p>
                  {key === 'credits' && (
                    <>
                      {/* E-admin-platform-10: regula in vigoare pentru preluare dupa prima oferta */}
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {t(
                          data.claims.contactRevealPolicy === 'AFTER_GRACE'
                            ? 'sections.withdrawals.contactsAfterGrace'
                            : 'sections.withdrawals.contactsOnClaim',
                          args,
                        )}
                      </p>
                      {data.claims.completedContactRetentionDays > 0 && (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {t('sections.withdrawals.contactsRetention', {
                            days: unit('day', data.claims.completedContactRetentionDays),
                          })}
                        </p>
                      )}
                    </>
                  )}
                  {key === 'penalties' && (
                    <>
                      <ul className="mt-2 list-disc pl-5 text-sm leading-relaxed text-muted-foreground">
                        {PENALTY_ITEMS.filter((r) => data.penalties.points[r] > 0).map((r) => (
                          <li key={r}>
                            {t(`sections.penalties.items.${r}`, { points: unit('point', data.penalties.points[r]) })}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {t('sections.penalties.after', args)}
                      </p>
                    </>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}
