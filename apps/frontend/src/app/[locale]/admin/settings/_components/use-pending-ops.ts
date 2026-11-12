'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CLAIM_COST_SETTING_KEYS, type PenaltyRuleDto, type SettingDto } from '@marketplace/shared';
import {
  type AdminCreditPackage,
  type AdminPlan,
  type AdminThreshold,
  useUpdatePackage,
  useUpdatePenaltyRule,
  useUpdatePlan,
  useUpdateSetting,
  useUpdateThreshold,
} from '@/hooks/use-admin';
import { planDisplayName } from '@/lib/plan-label';
import { SETTING_CATALOG, checkInt, checkSetting, settingDef, type SettingDef, type SettingUnit } from './setting-catalog';
import {
  FIELD,
  boolValue,
  normalizeSetting,
  textValue,
  useSettingText,
  type ChangeItem,
  type Drafts,
  type PendingOp,
  type PlanProp,
  type SectionId,
} from './settings-drafts';

export interface SettingsData {
  settings: SettingDto[] | undefined;
  rules: PenaltyRuleDto[] | undefined;
  plans: AdminPlan[] | undefined;
  packages: AdminCreditPackage[] | undefined;
  thresholds: AdminThreshold[] | undefined;
}

export const SECTION_ORDER: readonly SectionId[] = [
  'fiscal',
  'billing',
  'claims',
  'quotes',
  'trial',
  'penalties',
  'plans',
  'packages',
  'thresholds',
  'contact',
  'legal',
  'other',
  'tools',
];

// limitele din contractele comune (packages/shared, admin.schemas.ts)
const INT4_MAX = 2_147_483_647;
const PLAN_PRICE_MAX = 10_000_000;
const PACKAGE_CREDITS_MAX = 100_000;
const PACKAGE_PRICE_MAX = 10_000_000;
const RULE_POINTS_MAX = 100;

// Setarile afisate, in ordinea catalogului; cheile necunoscute merg la „Alte setari”.
// seller_* se editeaza DOAR din formularul „Date fiscale” (validare CUI/IBAN + audit dedicat).
export function listedSettings(settings: SettingDto[] | undefined): { key: string; value: string; section: SectionId }[] {
  const byKey = new Map((settings ?? []).map((s) => [s.key, s.value]));
  const known = SETTING_CATALOG.filter((d) => byKey.has(d.key)).map((d) => ({
    key: d.key,
    value: byKey.get(d.key) ?? '',
    section: d.group,
  }));
  const other = (settings ?? [])
    .filter((s) => !s.key.startsWith('seller_') && !settingDef(s.key))
    .map((s) => ({ key: s.key, value: s.value, section: 'other' as const }));
  return [...known, ...other];
}

// Din valorile de lucru + datele de pe server: lista operatiilor de trimis (un apel pe
// setare / regula / plan / pachet / prag) si problemele de validare, pe camp.
export function usePendingOps(data: SettingsData, drafts: Drafts): { ops: PendingOp[]; problems: Record<string, string> } {
  const t = useTranslations('Admin.settings');
  const tp = useTranslations('Penalties');
  const tr = useTranslations('Requests');
  const locale = useLocale();
  const text = useSettingText();
  const updateSetting = useUpdateSetting();
  const updateRule = useUpdatePenaltyRule();
  const updatePlan = useUpdatePlan();
  const updatePackage = useUpdatePackage();
  const updateThreshold = useUpdateThreshold();

  const ops: PendingOp[] = [];
  const problems: Record<string, string> = {};

  const withUnit = (value: string, unit: SettingUnit | null) =>
    unit ? `${text.shown(value)} ${text.unit(unit)}` : text.shown(value);

  // --- setari de sistem ---
  const planLabel = (code: string) => {
    const plan = data.plans?.find((p) => p.code === code);
    return plan ? planDisplayName(plan, locale) : text.shown(code);
  };
  const display = (def: SettingDef | undefined, key: string, value: string, side: 'from' | 'to'): string => {
    const spec = def?.spec;
    if (spec?.kind === 'int' || spec?.kind === 'decimal') return side === 'to' ? withUnit(value, spec.unit) : text.shown(value);
    if (spec?.kind === 'bool') return text.onOff(value === 'true');
    if (spec?.kind === 'enum') return text.option(key, value);
    if (spec?.kind === 'plan') return planLabel(value);
    return text.shown(value);
  };

  const listed = listedSettings(data.settings);
  const serverOf = new Map(listed.map((s) => [s.key, s.value]));
  for (const s of listed) {
    const field = FIELD.setting(s.key);
    const draft = drafts[field];
    if (typeof draft !== 'string') continue;
    const def = settingDef(s.key);
    const value = normalizeSetting(def, draft);
    if (value === s.value) continue;
    const problem = def ? checkSetting(def.spec, value) : null;
    if (problem) problems[field] = text.problem(problem);
    const label = text.label(s.key);
    ops.push({
      id: field,
      section: s.section,
      title: label,
      code: text.hasLabel(s.key) ? s.key : null,
      items: [{ label, from: display(def, s.key, s.value, 'from'), to: display(def, s.key, value, 'to') }],
      fields: [field],
      invalid: !!problem,
      run: () => updateSetting.mutateAsync({ key: s.key, value }),
    });
  }

  // costul unei preluari: plafonul e 0 (fara plafon) sau cel putin cat minimul (aceeasi regula ca pe server)
  const minField = FIELD.setting(CLAIM_COST_SETTING_KEYS.min);
  const maxField = FIELD.setting(CLAIM_COST_SETTING_KEYS.max);
  const effective = (key: string) => {
    const draft = drafts[FIELD.setting(key)];
    return typeof draft === 'string' ? draft.trim() : (serverOf.get(key) ?? '');
  };
  const minOp = ops.find((o) => o.id === minField);
  const maxOp = ops.find((o) => o.id === maxField);
  const newMin = Number(effective(CLAIM_COST_SETTING_KEYS.min));
  const newMax = Number(effective(CLAIM_COST_SETTING_KEYS.max));
  if ((minOp || maxOp) && !problems[minField] && !problems[maxField] && newMax > 0 && newMax < newMin) {
    for (const op of [minOp, maxOp]) {
      if (!op) continue;
      problems[op.id] = text.problem({ code: 'costRange' });
      op.invalid = true;
    }
  }

  // --- reguli de penalizare ---
  for (const r of data.rules ?? []) {
    const pointsField = FIELD.rule(r.id, 'points');
    const activeField = FIELD.rule(r.id, 'isActive');
    const points = textValue(drafts, pointsField, String(r.points)).trim();
    const active = boolValue(drafts, activeField, r.isActive);
    const name = tp.has(`rule.${r.ruleKey}`) ? tp(`rule.${r.ruleKey}`) : r.ruleKey;
    const items: ChangeItem[] = [];
    let invalid = false;
    if (points !== String(r.points)) {
      const problem = checkInt(points, 0, RULE_POINTS_MAX);
      if (problem) {
        problems[pointsField] = text.problem(problem);
        invalid = true;
      }
      items.push({ label: name, from: String(r.points), to: withUnit(points, 'points') });
    }
    if (active !== r.isActive) {
      items.push({ label: `${name} · ${t('ruleActive')}`, from: text.onOff(r.isActive), to: text.onOff(active) });
    }
    if (items.length === 0) continue;
    ops.push({
      id: `rule.${r.id}`,
      section: 'penalties',
      title: name,
      code: r.ruleKey,
      items,
      fields: [pointsField, activeField],
      invalid,
      run: () => updateRule.mutateAsync({ id: r.id, points: Number(points), isActive: active }),
    });
  }

  // camp numeric al unei entitati (plan / pachet / prag): adauga diferenta si problema, daca e cazul
  const numeric = (
    items: ChangeItem[],
    field: string,
    label: string,
    raw: string,
    server: string,
    min: number,
    max: number | null,
    unit: SettingUnit | null,
  ): boolean => {
    if (raw === server) return true;
    const problem = checkInt(raw, min, max);
    if (problem) problems[field] = text.problem(problem);
    items.push({ label, from: text.shown(server), to: withUnit(raw, unit) });
    return !problem;
  };

  // --- planuri de abonament ---
  for (const p of data.plans ?? []) {
    const f = (prop: PlanProp) => FIELD.plan(p.id, prop);
    const name = planDisplayName(p, locale);
    const nameRo = textValue(drafts, f('nameRo'), p.nameRo ?? '');
    const nameEn = textValue(drafts, f('nameEn'), p.nameEn ?? '');
    const price = textValue(drafts, f('priceRon'), String(p.priceRon)).trim();
    const credits = textValue(drafts, f('includedCredits'), String(p.includedCredits)).trim();
    const gating = textValue(drafts, f('gating'), String(p.marketplaceGatingDelayMin)).trim();
    const access = boolValue(drafts, f('access'), p.features.MARKETPLACE_ACCESS.enabled);
    const active = boolValue(drafts, f('isActive'), p.isActive);
    const items: ChangeItem[] = [];
    const tag = (label: string) => `${name} · ${label}`;
    if (nameRo !== (p.nameRo ?? '')) items.push({ label: tag(t('fields.nameRo')), from: text.shown(p.nameRo ?? ''), to: text.shown(nameRo) });
    if (nameEn !== (p.nameEn ?? '')) items.push({ label: tag(t('fields.nameEn')), from: text.shown(p.nameEn ?? ''), to: text.shown(nameEn) });
    const okPrice = numeric(items, f('priceRon'), tag(t('fields.planPrice')), price, String(p.priceRon), 0, PLAN_PRICE_MAX, 'ron');
    const okCredits = numeric(items, f('includedCredits'), tag(t('fields.planCredits')), credits, String(p.includedCredits), 0, INT4_MAX, 'credits');
    const okGating = numeric(items, f('gating'), tag(t('fields.planGating')), gating, String(p.marketplaceGatingDelayMin), 0, INT4_MAX, 'minutes');
    if (access !== p.features.MARKETPLACE_ACCESS.enabled) {
      items.push({ label: tag(t('fields.marketplaceAccess')), from: text.onOff(p.features.MARKETPLACE_ACCESS.enabled), to: text.onOff(access) });
    }
    if (active !== p.isActive) items.push({ label: tag(t('fields.active')), from: text.onOff(p.isActive), to: text.onOff(active) });
    if (items.length === 0) continue;
    ops.push({
      id: `plan.${p.id}`,
      section: 'plans',
      title: name,
      code: p.code,
      items,
      fields: (['nameRo', 'nameEn', 'priceRon', 'includedCredits', 'gating', 'access', 'isActive'] as const).map(f),
      invalid: !(okPrice && okCredits && okGating),
      // acelasi corp ca inainte: planul intreg, numele gol = fara nume (se afiseaza codul)
      run: () =>
        updatePlan.mutateAsync({
          id: p.id,
          nameRo: nameRo.trim() || null,
          nameEn: nameEn.trim() || null,
          priceRon: Number(price),
          includedCredits: Number(credits),
          marketplaceGatingDelayMin: Number(gating),
          isActive: active,
          features: { MARKETPLACE_ACCESS: { enabled: access } },
        }),
    });
  }

  // --- pachete de credite ---
  for (const p of data.packages ?? []) {
    const creditsField = FIELD.pkg(p.id, 'credits');
    const priceField = FIELD.pkg(p.id, 'priceRon');
    const activeField = FIELD.pkg(p.id, 'isActive');
    const credits = textValue(drafts, creditsField, String(p.credits)).trim();
    const price = textValue(drafts, priceField, String(p.priceRon)).trim();
    const active = boolValue(drafts, activeField, p.isActive);
    const name = t('packageTitle', { credits: p.credits });
    const tag = (label: string) => `${name} · ${label}`;
    const items: ChangeItem[] = [];
    const okCredits = numeric(items, creditsField, tag(t('fields.packageCredits')), credits, String(p.credits), 1, PACKAGE_CREDITS_MAX, 'credits');
    const okPrice = numeric(items, priceField, tag(t('fields.packagePrice')), price, String(p.priceRon), 1, PACKAGE_PRICE_MAX, 'ron');
    if (active !== p.isActive) items.push({ label: tag(t('fields.active')), from: text.onOff(p.isActive), to: text.onOff(active) });
    if (items.length === 0) continue;
    ops.push({
      id: `package.${p.id}`,
      section: 'packages',
      title: name,
      code: null,
      items,
      fields: [creditsField, priceField, activeField],
      invalid: !(okCredits && okPrice),
      run: () => updatePackage.mutateAsync({ id: p.id, credits: Number(credits), priceRon: Number(price), isActive: active }),
    });
  }

  // --- praguri de marime ---
  for (const th of data.thresholds ?? []) {
    const minScoreField = FIELD.threshold(th.id, 'minScore');
    const maxScoreField = FIELD.threshold(th.id, 'maxScore');
    const serverMax = th.maxScore === null ? '' : String(th.maxScore);
    const min = textValue(drafts, minScoreField, String(th.minScore)).trim();
    // max gol = fara limita superioara (pragul LARGE are maxScore null) → se trimite null, nu 0
    const max = textValue(drafts, maxScoreField, serverMax).trim();
    const name = tr.has(`sizeValue.${th.size}`) ? tr(`sizeValue.${th.size}`) : th.size;
    const tag = (label: string) => `${name} · ${label}`;
    const items: ChangeItem[] = [];
    const okMin = numeric(items, minScoreField, tag(t('fields.thresholdMin')), min, String(th.minScore), 0, null, 'points');
    let okMax = true;
    if (max !== serverMax) {
      if (max !== '') {
        const problem = checkInt(max, 0, null);
        if (problem) {
          problems[maxScoreField] = text.problem(problem);
          okMax = false;
        }
      }
      items.push({
        label: tag(t('fields.thresholdMax')),
        from: serverMax === '' ? t('noMax') : serverMax,
        to: max === '' ? t('noMax') : withUnit(max, 'points'),
      });
    }
    if (items.length === 0) continue;
    ops.push({
      id: `threshold.${th.id}`,
      section: 'thresholds',
      title: name,
      code: th.size,
      items,
      fields: [minScoreField, maxScoreField],
      invalid: !(okMin && okMax),
      run: () => updateThreshold.mutateAsync({ id: th.id, minScore: Number(min), maxScore: max === '' ? null : Number(max) }),
    });
  }

  ops.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section));

  // Serverul verifica fiecare capat al costului fata de celalalt, asa cum e SALVAT in acel moment.
  // Cand se schimba amandoua, ordinea conteaza: plafonul pleaca primul daca incape peste minimul
  // vechi (sau e 0); altfel minimul pleaca primul. Una dintre ordini e mereu valida.
  if (minOp && maxOp) {
    const storedMin = Number(serverOf.get(CLAIM_COST_SETTING_KEYS.min) ?? '1');
    const maxFirst = newMax === 0 || newMax >= storedMin;
    const iMin = ops.indexOf(minOp);
    const iMax = ops.indexOf(maxOp);
    const maxIsFirst = iMax < iMin;
    if (maxFirst !== maxIsFirst) {
      ops[iMin] = maxOp;
      ops[iMax] = minOp;
    }
  }

  return { ops, problems };
}
