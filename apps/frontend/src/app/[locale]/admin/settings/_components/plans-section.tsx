'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PLAN_CODE_RE } from '@marketplace/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { type AdminPlan, useCreatePlan } from '@/hooks/use-admin';
import { ApiError } from '@/lib/api';
import { planDisplayName } from '@/lib/plan-label';
import { cn } from '@/lib/utils';
import { BigSwitch, ValueBox } from './setting-controls';
import { FIELD, boolValue, textValue, useSettingText, useSettingsDraft, type PlanProp } from './settings-drafts';

const GRID = 'grid gap-x-4 gap-y-3 grid-cols-[repeat(auto-fit,minmax(min(190px,100%),1fr))]';

// E-admin-platform-58: planul ca date — nume RO/EN, pret >= 0 (0 = gratuit, nu se cumpara online),
// acces la marketplace (functia MARKETPLACE_ACCESS), activ. Codul e identitatea (nu se schimba).
export function PlanCard({ plan }: { plan: AdminPlan }) {
  const t = useTranslations('Admin.settings');
  const locale = useLocale();
  const text = useSettingText();
  const { drafts, setField, problems, failures, busy } = useSettingsDraft();
  const f = (prop: PlanProp) => FIELD.plan(plan.id, prop);

  const server = {
    nameRo: plan.nameRo ?? '',
    nameEn: plan.nameEn ?? '',
    priceRon: String(plan.priceRon),
    includedCredits: String(plan.includedCredits),
    gating: String(plan.marketplaceGatingDelayMin),
  };
  const value = (prop: keyof typeof server) => textValue(drafts, f(prop), server[prop]);
  const access = boolValue(drafts, f('access'), plan.features.MARKETPLACE_ACCESS.enabled);
  const active = boolValue(drafts, f('isActive'), plan.isActive);
  const failure = failures[`plan.${plan.id}`];

  // camp text / numeric; valoarea salvata apare dedesubt cat timp campul e modificat
  const box = (prop: keyof typeof server, label: string, opts: { unit?: string; text?: boolean; hint?: string } = {}) => {
    const raw = value(prop);
    const changed = (opts.text ? raw : raw.trim()) !== server[prop];
    return (
      <Field
        label={label}
        error={problems[f(prop)]}
        hint={changed ? t('was', { value: text.shown(server[prop]) }) : opts.hint}
      >
        <ValueBox
          value={raw}
          onChange={(v) => setField(f(prop), v, server[prop])}
          unit={opts.unit}
          changed={changed}
          invalid={!!problems[f(prop)]}
          disabled={busy}
          maxLength={opts.text ? 60 : undefined}
          inputMode={opts.text ? 'text' : 'numeric'}
          variant={opts.text ? 'fill' : 'fillNumber'}
        />
      </Field>
    );
  };

  const toggle = (prop: 'access' | 'isActive', label: string, checked: boolean, saved: boolean) => (
    <div className="flex items-center gap-2.5">
      <BigSwitch checked={checked} onChange={(v) => setField(f(prop), v, saved)} label={label} disabled={busy} />
      <span className={cn('text-sm', checked !== saved && 'font-medium text-amber')}>{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 border-b border-background py-5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{planDisplayName(plan, locale)}</span>
        {(plan.nameRo || plan.nameEn) && <span className="font-mono text-meta text-muted-foreground">{plan.code}</span>}
        {plan.isFree && <Badge tone="sage">{t('freeBadge')}</Badge>}
        {!plan.isActive && <Badge tone="muted">{t('inactiveBadge')}</Badge>}
      </div>
      {failure && (
        <p role="alert" className="text-xs text-crimson">
          {failure}
        </p>
      )}
      <div className={GRID}>
        {box('nameRo', t('fields.nameRo'), { text: true })}
        {box('nameEn', t('fields.nameEn'), { text: true })}
        {box('priceRon', t('fields.planPrice'), { unit: text.unit('ron'), hint: t('fields.planPriceHint') })}
        {box('includedCredits', t('fields.planCredits'), { unit: text.unit('credits') })}
        {box('gating', t('fields.planGating'), { unit: text.unit('minutes'), hint: t('fields.planGatingHint') })}
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {toggle('access', t('fields.marketplaceAccess'), access, plan.features.MARKETPLACE_ACCESS.enabled)}
        {toggle('isActive', t('fields.active'), active, plan.isActive)}
      </div>
      {value('priceRon').trim() === '0' && <p className="text-xs text-muted-foreground">{t('freeHint')}</p>}
    </div>
  );
}

// E-admin-platform-58: plan nou. Accesul la marketplace e o alegere explicita (implicit oprit).
// Crearea e o actiune de sine statatoare (nu intra in „modificari nesalvate”).
export function NewPlanForm() {
  const t = useTranslations('Admin');
  const text = useSettingText();
  const create = useCreatePlan();
  const empty = { code: '', nameRo: '', nameEn: '', price: 0, credits: 0, gating: 60, access: false };
  const [v, setV] = useState(empty);
  const codeValid = PLAN_CODE_RE.test(v.code);
  const submit = () => {
    if (!codeValid) return;
    create.mutate(
      {
        code: v.code,
        nameRo: v.nameRo.trim() || undefined,
        nameEn: v.nameEn.trim() || undefined,
        priceRon: v.price,
        includedCredits: v.credits,
        marketplaceGatingDelayMin: v.gating,
        features: { MARKETPLACE_ACCESS: { enabled: v.access } },
      },
      {
        onSuccess: () => {
          toast.success(t('settings.newPlan.created'));
          setV(empty);
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
          toast.error(t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('settings.saveError'));
        },
      },
    );
  };
  const number = (key: 'price' | 'credits' | 'gating', label: string, unit: string) => (
    <Field label={`${label} (${unit})`}>
      <Input
        type="number"
        min={0}
        value={v[key]}
        onChange={(e) => setV({ ...v, [key]: Number(e.target.value) })}
        className="h-11 text-right font-mono"
      />
    </Field>
  );
  return (
    <div className="mb-3 mt-4 flex flex-col gap-4 rounded-lg border border-dashed border-muted-2 bg-surface-2 p-4">
      <h3 className="heading-card">{t('settings.newPlan.title')}</h3>
      <div className={GRID}>
        <Field label={t('settings.fields.code')} hint={t('settings.fields.codeHint')}>
          <Input
            value={v.code}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={v.code !== '' && !codeValid}
            onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })}
            className="h-11 font-mono"
          />
        </Field>
        <Field label={t('settings.fields.nameRo')}>
          <Input value={v.nameRo} maxLength={60} onChange={(e) => setV({ ...v, nameRo: e.target.value })} className="h-11" />
        </Field>
        <Field label={t('settings.fields.nameEn')}>
          <Input value={v.nameEn} maxLength={60} onChange={(e) => setV({ ...v, nameEn: e.target.value })} className="h-11" />
        </Field>
        {number('price', t('settings.fields.planPrice'), text.unit('ron'))}
        {number('credits', t('settings.fields.planCredits'), text.unit('credits'))}
        {number('gating', t('settings.fields.planGating'), text.unit('minutes'))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-2.5">
          <BigSwitch
            checked={v.access}
            onChange={(access) => setV({ ...v, access })}
            label={t('settings.fields.marketplaceAccess')}
          />
          <span className="text-sm">{t('settings.fields.marketplaceAccess')}</span>
        </div>
        <Button type="button" size="lg" className="h-11" onClick={submit} disabled={!codeValid || create.isPending}>
          {t('settings.newPlan.submit')}
        </Button>
      </div>
    </div>
  );
}
