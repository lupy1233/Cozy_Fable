'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { CardSection } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonText } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/routing';
import { useBillingReadiness, useSellerDetails, useUpdateSellerDetails } from '@/hooks/use-billing';
import { ApiError } from '@/lib/api';
import { SENTRY_DSN } from '@/lib/monitoring';
import { planDisplayName } from '@/lib/plan-label';
import { Badge } from '@/components/ui/badge';
import { ClaimCostNote } from '../_components/claim-cost-note';
import {
  type AdminCreditPackage,
  type AdminPlan,
  type AdminThreshold,
  useAdminPackages,
  useAdminPlans,
  useAdminThresholds,
  useCreatePlan,
  usePenaltyRules,
  useMonitoringTestError,
  useSendTestEmail,
  useSettings,
  useUpdatePackage,
  useUpdatePenaltyRule,
  useUpdatePlan,
  useUpdateSetting,
  useUpdateThreshold,
} from '@/hooks/use-admin';
import {
  PLAN_CODE_RE,
  SELLER_FIELDS,
  isValidIban,
  isValidRoCui,
  normalizeIban,
  type AdminMailTestResultDto,
  type PenaltyRuleDto,
  type SellerDetailsDto,
  type SellerField,
  type SellerProblemReason,
  type SettingDto,
} from '@marketplace/shared';

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
      <PageHeader title={t('nav.settings')} />

      <FiscalDataSection />

      <MailTestSection />

      <MonitoringTestSection />

      {/* seller_* se editeaza DOAR din formularul "Date fiscale" (validare CUI/IBAN + audit dedicat) */}
      <CardSection title={t('settings.system')}>
        {settings.isPending && <SkeletonText lines={3} />}
        {settings.data?.filter((s) => !s.key.startsWith('seller_')).map((s) => <SettingRow key={s.key} s={s} />)}
      </CardSection>

      <CardSection title={t('settings.penaltyRules')}>
        {rules.isPending && <SkeletonText lines={3} />}
        {rules.data?.map((r) => <PenaltyRow key={r.id} r={r} />)}
      </CardSection>

      <CardSection title={t('settings.plans')}>
        {plans.isPending && <SkeletonText lines={3} />}
        {/* E-admin-platform-58: planurile sunt date (cod, nume, pret >= 0, acces marketplace) */}
        <p className="text-xs text-muted-foreground">{t('settings.planHint')}</p>
        {plans.data?.map((p) => <PlanRow key={`${p.id}:${p.priceRon}:${p.isActive}:${p.features.MARKETPLACE_ACCESS.enabled}`} p={p} />)}
        <NewPlanForm />
      </CardSection>

      <CardSection title={t('settings.packages')}>
        {packages.isPending && <SkeletonText lines={3} />}
        {packages.data?.map((p) => <PackageRow key={p.id} p={p} />)}
      </CardSection>

      <CardSection title={t('settings.thresholds')}>
        {thresholds.isPending && <SkeletonText lines={3} />}
        {/* costul nu se mai seteaza pe prag (PO r5): 1 credit = credit_value_ron lei din
            bugetul minim estimat, limitat la [claim_cost_min, claim_cost_max] (E-company-21);
            pragurile decid doar marimea S/M/L (SLA) */}
        <ClaimCostNote />
        <Link href="/admin/sizing" className="text-xs text-ink-2 underline underline-offset-2 hover:text-foreground">
          {t('settings.weightsLink')}
        </Link>
        {thresholds.data?.map((th) => <ThresholdRow key={th.id} th={th} />)}
      </CardSection>
    </div>
  );
}

// E-admin-platform-4 — datele fiscale ale platformei (furnizor pe facturi). Pana sunt reale,
// cumpararile si confirmarile de plata raspund 503 BILLING_NOT_CONFIGURED.
const FISCAL_MAX: Record<SellerField, number> = { name: 200, cui: 14, regCom: 40, address: 300, iban: 42 };

function clientProblem(field: SellerField, value: string): SellerProblemReason | null {
  const v = value.trim();
  if (!v) return 'MISSING';
  if (field === 'cui' && !isValidRoCui(v)) return 'INVALID';
  if (field === 'iban' && !isValidIban(normalizeIban(v))) return 'INVALID';
  return null;
}

function FiscalDataSection() {
  const t = useTranslations('Admin');
  const seller = useSellerDetails();
  return (
    <CardSection
      id="fiscal"
      className="scroll-mt-24"
      title={t('settings.fiscal.title')}
      description={t('settings.fiscal.hint')}
    >
      {seller.isPending && <SkeletonText lines={3} />}
      {seller.data && <FiscalDataForm key={JSON.stringify(seller.data)} initial={seller.data} />}
    </CardSection>
  );
}

function FiscalDataForm({ initial }: { initial: SellerDetailsDto }) {
  const t = useTranslations('Admin');
  const readiness = useBillingReadiness();
  const save = useUpdateSellerDetails();
  const [values, setValues] = useState<SellerDetailsDto>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<SellerField, SellerProblemReason>>>({});

  const reasonText = (field: SellerField, reason: SellerProblemReason) =>
    reason === 'INVALID' ? t(`settings.fiscal.errors.INVALID_${field === 'iban' ? 'iban' : 'cui'}`) : t(`settings.fiscal.errors.${reason}`);

  // problemele curente (din readiness) raman afisate cat timp campul nu a fost modificat
  const storedProblem = (field: SellerField) =>
    values[field] === initial[field] ? readiness.data?.problems.find((p) => p.field === field)?.reason : undefined;

  const errorOf = (field: SellerField) => {
    const reason = serverErrors[field] ?? (submitted ? clientProblem(field, values[field]) : null) ?? storedProblem(field);
    return reason ? reasonText(field, reason) : undefined;
  };

  const submit = () => {
    setSubmitted(true);
    if (SELLER_FIELDS.some((f) => clientProblem(f, values[f]))) return;
    save.mutate(values, {
      onSuccess: () => {
        toast.success(t('settings.fiscal.saved'));
        setServerErrors({});
      },
      onError: (err) => {
        const details = err instanceof ApiError && Array.isArray(err.details) ? (err.details as { field: SellerField; reason: SellerProblemReason }[]) : [];
        setServerErrors(Object.fromEntries(details.map((d) => [d.field, d.reason])));
        toast.error(details.length ? reasonText(details[0].field, details[0].reason) : t('settings.saveError'));
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {readiness.data?.ready && (
        <Alert tone="sage">{t('settings.fiscal.ready')}</Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {SELLER_FIELDS.map((field) => (
          <Field
            key={field}
            label={t(`settings.fiscal.${field}`)}
            error={errorOf(field)}
            className={field === 'name' || field === 'address' ? 'sm:col-span-2' : undefined}
          >
            <Input
              value={values[field]}
              maxLength={FISCAL_MAX[field]}
              autoComplete="off"
              spellCheck={false}
              className={field === 'cui' || field === 'iban' ? 'font-mono' : undefined}
              aria-invalid={!!errorOf(field)}
              onChange={(e) => {
                const value = e.target.value;
                setValues((v) => ({ ...v, [field]: value }));
                setServerErrors((s) => ({ ...s, [field]: undefined }));
              }}
            />
          </Field>
        ))}
      </div>
      <div>
        <Button type="button" variant="walnut" onClick={submit} disabled={save.isPending}>
          {t('settings.fiscal.save')}
        </Button>
      </div>
    </div>
  );
}

// Email de test (E-admin-platform-1): merge doar catre adresa adminului; arata expeditorul
// si adresa de raspuns ca adminul sa verifice configuratia slotului activ.
function MailTestSection() {
  const t = useTranslations('Admin');
  const m = useSendTestEmail();
  const [result, setResult] = useState<AdminMailTestResultDto | null>(null);
  const send = () =>
    m.mutate(undefined, {
      onSuccess: (data) => {
        setResult(data);
        if (data.ok) toast.success(t('settings.mailTestSent', { email: data.to }));
        else toast.error(t('settings.mailTestFailed', { error: data.error ?? '' }));
      },
      onError: () => toast.error(t('settings.saveError')),
    });
  return (
    <CardSection title={t('settings.mailTitle')}>
      <p className="text-sm text-muted-foreground">{t('settings.mailHint')}</p>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={send} disabled={m.isPending}>
          {t('settings.mailTestButton')}
        </Button>
      </div>
      {result && (
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          <span>{t('settings.mailFrom', { from: result.from })}</span>
          <span>
            {result.replyTo ? t('settings.mailReplyTo', { replyTo: result.replyTo }) : t('settings.mailNoReplyTo')}
          </span>
        </div>
      )}
    </CardSection>
  );
}

// Tracker de erori (E-admin-platform-8): eroare de test pe server (500 capturat de filtru)
// si in browser (randare care arunca → ecranul error.tsx + raportare).
function MonitoringTestSection() {
  const t = useTranslations('Admin');
  const m = useMonitoringTestError();
  const [crash, setCrash] = useState(false);
  const sendServer = () =>
    m.mutate(undefined, {
      // 500 e rezultatul asteptat; 429 (3/min) sau alt status = eroarea nu a pornit
      onError: (error) =>
        error instanceof ApiError && error.status === 500
          ? toast.success(t('settings.monitoringServerSent'))
          : toast.error(t('settings.monitoringServerFailed')),
    });
  return (
    <CardSection title={t('settings.monitoringTitle')}>
      <p className="text-sm text-muted-foreground">{t('settings.monitoringHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={sendServer} disabled={m.isPending}>
          {t('settings.monitoringServerButton')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setCrash(true)}>
          {t('settings.monitoringClientButton')}
        </Button>
      </div>
      {!SENTRY_DSN && <p className="text-xs text-muted-foreground">{t('settings.monitoringClientDisabled')}</p>}
      {crash && <CrashNow />}
    </CardSection>
  );
}

function CrashNow(): never {
  throw new Error('monitoring client test');
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
  const t = useTranslations('Admin');
  const [points, setPoints] = useState(r.points);
  const [active, setActive] = useState(r.isActive);
  const m = useUpdatePenaltyRule();
  const fb = useSaveFeedback();
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-56 shrink-0 font-mono text-xs">{r.ruleKey}</span>
      <input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} className={`${inp} w-20`} />
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t('settings.fields.active')}
      </label>
      <SaveBtn pending={m.isPending} onClick={() => m.mutate({ id: r.id, points, isActive: active }, fb)} />
    </div>
  );
}

// E-admin-platform-58: planul ca date — nume RO/EN, pret >= 0 (0 = gratuit, nu se cumpara online),
// acces la marketplace (functia MARKETPLACE_ACCESS), activ. Codul e identitatea (nu se schimba).
function PlanRow({ p }: { p: AdminPlan }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [nameRo, setNameRo] = useState(p.nameRo ?? '');
  const [nameEn, setNameEn] = useState(p.nameEn ?? '');
  const [price, setPrice] = useState(p.priceRon);
  const [credits, setCredits] = useState(p.includedCredits);
  const [gating, setGating] = useState(p.marketplaceGatingDelayMin);
  const [access, setAccess] = useState(p.features.MARKETPLACE_ACCESS.enabled);
  const [active, setActive] = useState(p.isActive);
  const m = useUpdatePlan();
  const fb = useSaveFeedback();
  const save = () =>
    m.mutate(
      {
        id: p.id,
        nameRo: nameRo.trim() || null,
        nameEn: nameEn.trim() || null,
        priceRon: price,
        includedCredits: credits,
        marketplaceGatingDelayMin: gating,
        isActive: active,
        features: { MARKETPLACE_ACCESS: { enabled: access } },
      },
      fb,
    );
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-3 text-sm last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{planDisplayName(p, locale)}</span>
        {(p.nameRo || p.nameEn) && <span className="font-mono text-xs text-muted-foreground">{p.code}</span>}
        {p.isFree && <Badge tone="sage">{t('settings.freeBadge')}</Badge>}
        {!p.isActive && <Badge tone="muted">{t('settings.inactiveBadge')}</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">{t('settings.fields.nameRo')} <input value={nameRo} maxLength={60} onChange={(e) => setNameRo(e.target.value)} className={`${inp} w-36`} /></label>
        <label className="text-xs">{t('settings.fields.nameEn')} <input value={nameEn} maxLength={60} onChange={(e) => setNameEn(e.target.value)} className={`${inp} w-36`} /></label>
        <label className="text-xs">{t('settings.fields.price')} <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={`${inp} w-24`} /></label>
        <label className="text-xs">{t('settings.fields.credits')} <input type="number" min={0} value={credits} onChange={(e) => setCredits(Number(e.target.value))} className={`${inp} w-20`} /></label>
        <label className="text-xs">{t('settings.fields.gating')} <input type="number" min={0} value={gating} onChange={(e) => setGating(Number(e.target.value))} className={`${inp} w-16`} /></label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={access} onChange={(e) => setAccess(e.target.checked)} /> {t('settings.fields.marketplaceAccess')}
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t('settings.fields.active')}
        </label>
        <SaveBtn pending={m.isPending} onClick={save} />
      </div>
      {price === 0 && <p className="text-xs text-muted-foreground">{t('settings.freeHint')}</p>}
    </div>
  );
}

// E-admin-platform-58: plan nou. Accesul la marketplace e o alegere explicita (implicit nebifat).
function NewPlanForm() {
  const t = useTranslations('Admin');
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
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-dashed border-border-2 p-3 text-sm">
      <h3 className="font-medium">{t('settings.newPlan.title')}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">
          {t('settings.fields.code')}{' '}
          <input
            value={v.code}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={v.code !== '' && !codeValid}
            onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })}
            className={`${inp} w-32 font-mono`}
          />
        </label>
        <label className="text-xs">{t('settings.fields.nameRo')} <input value={v.nameRo} maxLength={60} onChange={(e) => setV({ ...v, nameRo: e.target.value })} className={`${inp} w-36`} /></label>
        <label className="text-xs">{t('settings.fields.nameEn')} <input value={v.nameEn} maxLength={60} onChange={(e) => setV({ ...v, nameEn: e.target.value })} className={`${inp} w-36`} /></label>
        <label className="text-xs">{t('settings.fields.price')} <input type="number" min={0} value={v.price} onChange={(e) => setV({ ...v, price: Number(e.target.value) })} className={`${inp} w-24`} /></label>
        <label className="text-xs">{t('settings.fields.credits')} <input type="number" min={0} value={v.credits} onChange={(e) => setV({ ...v, credits: Number(e.target.value) })} className={`${inp} w-20`} /></label>
        <label className="text-xs">{t('settings.fields.gating')} <input type="number" min={0} value={v.gating} onChange={(e) => setV({ ...v, gating: Number(e.target.value) })} className={`${inp} w-16`} /></label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={v.access} onChange={(e) => setV({ ...v, access: e.target.checked })} /> {t('settings.fields.marketplaceAccess')}
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={!codeValid || create.isPending}
          className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
        >
          {t('settings.newPlan.submit')}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t('settings.fields.codeHint')}</p>
    </div>
  );
}

function PackageRow({ p }: { p: AdminCreditPackage }) {
  const t = useTranslations('Admin');
  const [credits, setCredits] = useState(p.credits);
  const [price, setPrice] = useState(p.priceRon);
  const [active, setActive] = useState(p.isActive);
  const m = useUpdatePackage();
  const fb = useSaveFeedback();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="text-xs">{t('settings.fields.credits')} <input type="number" value={credits} onChange={(e) => setCredits(Number(e.target.value))} className={`${inp} w-20`} /></label>
      <label className="text-xs">{t('settings.fields.price')} <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className={`${inp} w-24`} /></label>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t('settings.fields.active')}</label>
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
