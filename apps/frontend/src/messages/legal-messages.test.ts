import { describe, expect, it } from 'vitest';
import en from './en.json';
import ro from './ro.json';
import { FIRM_RULES_SECTIONS, PRIVACY_SECTIONS, TERMS_SECTIONS } from '../app/[locale]/_components/legal-sections';

// E-admin-platform-2: textele juridice nu mai au placeholdere, ambele limbi au aceleasi chei
// si singurele argumente ICU din corpul Termenilor/Politicii sunt {operator} si {contactEmail}.
type Tree = { [k: string]: string | Tree };

const flatten = (o: Tree, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : flatten(v, `${prefix}${k}.`)));

const strings = (o: Tree): string[] =>
  Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : strings(v)));

const locales = { ro: ro as unknown as Record<string, Tree>, en: en as unknown as Record<string, Tree> };

describe('texte juridice', () => {
  it.each(Object.entries(locales))('%s: niciun placeholder [CUI]/[ADRESA]/[DENUMIRE]/[EMAIL]', (_l, messages) => {
    const bad = strings(messages as unknown as Tree).filter((s) => /\[(CUI|ADRES|DENUMIRE|EMAIL)[^\]]*\]/.test(s));
    expect(bad).toEqual([]);
  });

  it.each(Object.entries(locales))('%s: fiecare sectiune are h si b', (_l, messages) => {
    const legal = messages.Legal as unknown as { terms: { sections: Tree }; privacy: { sections: Tree } };
    for (const key of TERMS_SECTIONS) {
      expect(typeof (legal.terms.sections[key] as Tree)?.h).toBe('string');
      expect(typeof (legal.terms.sections[key] as Tree)?.b).toBe('string');
    }
    for (const key of PRIVACY_SECTIONS) {
      expect(typeof (legal.privacy.sections[key] as Tree)?.h).toBe('string');
      expect(typeof (legal.privacy.sections[key] as Tree)?.b).toBe('string');
    }
    expect(Object.keys(legal.terms.sections)).toHaveLength(TERMS_SECTIONS.length);
    expect(Object.keys(legal.privacy.sections)).toHaveLength(PRIVACY_SECTIONS.length);
  });

  it('Legal si LegalAcceptance au aceleasi chei in RO si EN', () => {
    for (const ns of ['Legal', 'LegalAcceptance'] as const) {
      expect(flatten(locales.ro[ns]).sort()).toEqual(flatten(locales.en[ns]).sort());
    }
  });

  it.each(Object.entries(locales))('%s: argumentele ICU din corpul Termenilor/Politicii sunt doar operator/contactEmail', (_l, messages) => {
    const legal = messages.Legal as unknown as { terms: Tree; privacy: Tree };
    const allowed = new Set(['operator', 'contactEmail']);
    for (const text of [...strings(legal.terms), ...strings(legal.privacy)]) {
      for (const m of text.matchAll(/\{(\w+)\}/g)) expect(allowed.has(m[1])).toBe(true);
    }
  });

  // E-company-9: "Reguli pentru firme" — aceleasi garantii ca Termenii + argumente ICU pe allowlist.
  it.each(Object.entries(locales))('%s: Legal.firmRules are fiecare sectiune cu h si b (+ cazurile speciale)', (_l, messages) => {
    const rules = (messages.Legal as unknown as { firmRules: { sections: Tree } }).firmRules;
    for (const key of FIRM_RULES_SECTIONS) {
      const sec = rules.sections[key] as Tree;
      expect(typeof sec?.h).toBe('string');
      expect(typeof sec?.b).toBe('string');
    }
    const pen = rules.sections.penalties as Tree;
    expect(typeof (pen.items as Tree).SLA_MISS).toBe('string');
    expect(typeof (pen.items as Tree).VOLUNTARY_WITHDRAWAL).toBe('string');
    expect(typeof pen.after).toBe('string');
    expect(typeof (rules.sections.trial as Tree).bOff).toBe('string');
    // E-admin-platform-10: regula de preluare dupa prima oferta, in ambele variante
    expect(typeof (rules.sections.credits as Tree).afterOfferClosed).toBe('string');
    expect(typeof (rules.sections.credits as Tree).afterOfferOpen).toBe('string');
    // E-company-3: cand se vad contactele clientului, ambele politici + pragul dupa livrare
    const wd = rules.sections.withdrawals as Tree;
    expect(typeof wd.contactsOnClaim).toBe('string');
    expect(typeof wd.contactsAfterGrace).toBe('string');
    expect(typeof wd.contactsRetention).toBe('string');
    expect(Object.keys(rules.sections)).toHaveLength(FIRM_RULES_SECTIONS.length);
  });

  it.each(Object.entries(locales))('%s: argumentele ICU din Legal.firmRules sunt pe allowlist', (_l, messages) => {
    const allowed = new Set([
      'reapplyMonths', 'plan', 'durationDays', 'bonusCredits', 'maxClaims', 'assignMinutes', 'autoCompleteDays',
      'small', 'medium', 'large', 'clarificationDays', 'graceHours', 'slaMissPoints', 'graceMinutes',
      'withdrawalPoints', 'unresponsiveHours', 'points', 'windowDays', 'threshold', 'months', 'contactEmail',
      // E-company-3: pragul de retentie dupa livrare (sections.withdrawals.contactsRetention)
      'days',
      // E-company-21: intervalul costului unei preluari (sections.credits.costRange / costMin)
      'min', 'max',
      // unitatile de plural primesc doar {n}
      'n',
    ]);
    const rules = (messages.Legal as unknown as { firmRules: Tree }).firmRules;
    for (const text of strings(rules)) {
      // doar argumentele de nivel superior: `{nume}` sau `{nume,` (in interiorul cazurilor de plural nu exista alte argumente)
      for (const m of text.matchAll(/(?:^|[^{])\{(\w+)\s*[},]/g)) expect(allowed.has(m[1])).toBe(true);
    }
  });
});
