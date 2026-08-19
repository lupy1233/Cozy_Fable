'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from '@/components/ui/toaster';
import {
  type AdminCreditPackage,
  type AdminPlan,
  type AdminThreshold,
  useAdminPackages,
  useAdminPlans,
  useAdminThresholds,
  usePenaltyRules,
  useSettings,
  useUpdatePackage,
  useUpdatePenaltyRule,
  useUpdatePlan,
  useUpdateSetting,
  useUpdateThreshold,
} from '@/hooks/use-admin';
import type { PenaltyRuleDto, SettingDto } from '@marketplace/shared';

// Feedback la salvare (L0-B): toast succes / eroare — inainte adminul nu afla ca a picat.
function useSaveFeedback() {
  const t = useTranslations('Admin');
  return {
    onSuccess: () => toast.success(t('settings.saved')),
    onError: () => toast.error(t('settings.saveError')),
  };
}

export default function AdminSettingsPage() {
  const t = useTranslations('Admin');
  const settings = useSettings();
  const rules = usePenaltyRules();
  const plans = useAdminPlans();
  const packages = useAdminPackages();
  const thresholds = useAdminThresholds();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">{t('nav.settings')}</h1>

      <Section title={t('settings.system')}>
        {settings.data?.map((s) => <SettingRow key={s.key} s={s} />)}
      </Section>

      <Section title={t('settings.penaltyRules')}>
        {rules.data?.map((r) => <PenaltyRow key={r.id} r={r} />)}
      </Section>

      <Section title={t('settings.plans')}>
        {plans.data?.map((p) => <PlanRow key={p.id} p={p} />)}
      </Section>

      <Section title={t('settings.packages')}>
        {packages.data?.map((p) => <PackageRow key={p.id} p={p} />)}
      </Section>

      <Section title={t('settings.thresholds')}>
        {/* costul nu se mai seteaza pe prag (PO r5): 1 credit = 1.000 lei din
            bugetul minim estimat; pragurile decid doar marimea S/M/L (SLA) */}
        <p className="text-xs text-muted-foreground">{t('settings.creditCostNote')}</p>
        {thresholds.data?.map((th) => <ThresholdRow key={th.id} th={th} />)}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="mb-3 font-serif text-lg">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function SaveBtn({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  const t = useTranslations('Admin');
  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
    >
      {t('settings.save')}
    </button>
  );
}
const inp = 'rounded-md border border-border-2 bg-surface px-2 py-1 text-sm focus-visible:outline-none focus-visible:border-foreground';

function SettingRow({ s }: { s: SettingDto }) {
  const [v, setV] = useState(s.value);
  const m = useUpdateSetting();
  const fb = useSaveFeedback();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-72 shrink-0 font-mono text-xs text-muted-foreground">{s.key}</span>
      <input value={v} onChange={(e) => setV(e.target.value)} className={`${inp} flex-1`} />
      <SaveBtn pending={m.isPending} onClick={() => m.mutate({ key: s.key, value: v }, fb)} />
    </div>
  );
}

function PenaltyRow({ r }: { r: PenaltyRuleDto }) {
  const [points, setPoints] = useState(r.points);
  const [active, setActive] = useState(r.isActive);
  const m = useUpdatePenaltyRule();
  const fb = useSaveFeedback();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-56 shrink-0 font-mono text-xs">{r.ruleKey}</span>
      <input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} className={`${inp} w-20`} />
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> activ
      </label>
      <SaveBtn pending={m.isPending} onClick={() => m.mutate({ id: r.id, points, isActive: active }, fb)} />
    </div>
  );
}

function PlanRow({ p }: { p: AdminPlan }) {
  const [price, setPrice] = useState(p.priceRon);
  const [credits, setCredits] = useState(p.includedCredits);
  const [gating, setGating] = useState(p.marketplaceGatingDelayMin);
  const m = useUpdatePlan();
  const fb = useSaveFeedback();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium">{p.tier}</span>
      <label className="text-xs">RON <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={`${inp} w-24`} /></label>
      <label className="text-xs">credite <input type="number" value={credits} onChange={(e) => setCredits(Number(e.target.value))} className={`${inp} w-20`} /></label>
      <label className="text-xs">gating <input type="number" value={gating} onChange={(e) => setGating(Number(e.target.value))} className={`${inp} w-16`} /></label>
      <SaveBtn pending={m.isPending} onClick={() => m.mutate({ id: p.id, priceRon: price, includedCredits: credits, marketplaceGatingDelayMin: gating }, fb)} />
    </div>
  );
}

function PackageRow({ p }: { p: AdminCreditPackage }) {
  const [credits, setCredits] = useState(p.credits);
  const [price, setPrice] = useState(p.priceRon);
  const [active, setActive] = useState(p.isActive);
  const m = useUpdatePackage();
  const fb = useSaveFeedback();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="text-xs">credite <input type="number" value={credits} onChange={(e) => setCredits(Number(e.target.value))} className={`${inp} w-20`} /></label>
      <label className="text-xs">RON <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={`${inp} w-24`} /></label>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> activ</label>
      <SaveBtn pending={m.isPending} onClick={() => m.mutate({ id: p.id, credits, priceRon: price, isActive: active }, fb)} />
    </div>
  );
}

function ThresholdRow({ th }: { th: AdminThreshold }) {
  const t = useTranslations('Admin');
  const [min, setMin] = useState(th.minScore);
  // max gol = fara limita superioara (pragul LARGE are maxScore null) → trimitem null, nu 0
  const [max, setMax] = useState<string>(th.maxScore === null ? '' : String(th.maxScore));
  const m = useUpdateThreshold();
  const fb = useSaveFeedback();
  const maxValue = max.trim() === '' ? null : Number(max);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium">{th.size}</span>
      <label className="text-xs">min <input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} className={`${inp} w-16`} /></label>
      <label className="text-xs">
        max{' '}
        <input
          type="number"
          value={max}
          placeholder={t('settings.noMax')}
          onChange={(e) => setMax(e.target.value)}
          className={`${inp} w-24`}
        />
      </label>
      <SaveBtn pending={m.isPending} onClick={() => m.mutate({ id: th.id, minScore: min, maxScore: maxValue }, fb)} />
    </div>
  );
}
