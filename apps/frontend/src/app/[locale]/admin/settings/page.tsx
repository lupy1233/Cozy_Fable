'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonText } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { Link } from '@/i18n/routing';
import { useBillingReadiness } from '@/hooks/use-billing';
import {
  useAdminPackages,
  useAdminPlans,
  useAdminThresholds,
  usePenaltyRules,
  useSettings,
} from '@/hooks/use-admin';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ClaimCostNote } from '../_components/claim-cost-note';
import { PackageRow, ThresholdRow } from './_components/catalog-rows';
import { FiscalDataSection } from './_components/fiscal-section';
import { NewPlanForm, PlanCard } from './_components/plans-section';
import { SaveBar, SaveDialog, type RunState } from './_components/save-bar';
import { PenaltyRuleRow, SettingRow, SettingsSection } from './_components/setting-controls';
import {
  SettingsDraftProvider,
  opIdOfField,
  type DraftValue,
  type Drafts,
  type SectionId,
} from './_components/settings-drafts';
import { ToolsSection } from './_components/tools-section';
import { SECTION_ORDER, listedSettings, usePendingOps } from './_components/use-pending-ops';

// Setari (design 2026-11): regulile platformei pe teme. Fiecare valoare are nume, unitate si
// explicatie; codul tehnic ramane mic. API-ul salveaza valoare cu valoare, asa ca „o singura
// salvare” = bara de jos trimite pe rand DOAR ce s-a schimbat si arata ce a reusit si ce nu.

// Sectiunea de sus din zona vizibila (pentru meniul din stanga).
function useActiveSection(ids: readonly string[]): [string | null, (id: string) => void] {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join('|');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const order = key.split('|');
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = order.find((id) => visible.has(id));
        if (first) setActive(first);
      },
      // banda de sub bara de sus a consolei pana spre mijlocul ecranului
      { rootMargin: '-96px 0px -50% 0px' },
    );
    for (const id of order) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);
  return [active, setActive];
}

export default function AdminSettingsPage() {
  const t = useTranslations('Admin');
  const settings = useSettings();
  const rules = usePenaltyRules();
  const plans = useAdminPlans();
  const packages = useAdminPackages();
  const thresholds = useAdminThresholds();
  const readiness = useBillingReadiness();

  const [drafts, setDrafts] = useState<Drafts>({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);
  const busy = !!run && !run.done;

  const { ops, problems } = usePendingOps(
    { settings: settings.data, rules: rules.data, plans: plans.data, packages: packages.data, thresholds: thresholds.data },
    drafts,
  );

  const setField = useCallback((field: string, value: DraftValue, server: DraftValue) => {
    setDrafts((d) => {
      const next = { ...d };
      if (value === server) delete next[field];
      else next[field] = value;
      return next;
    });
    // o valoare editata din nou nu mai poarta eroarea de la salvarea trecuta
    setFailures((f) => {
      const op = opIdOfField(field);
      if (!(op in f)) return f;
      const next = { ...f };
      delete next[op];
      return next;
    });
  }, []);

  // pagina inchisa cu modificari nesalvate: browserul cere confirmare
  const dirty = ops.length > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const describeError = (err: unknown): string => {
    if (err instanceof ApiError) {
      const first: unknown = Array.isArray(err.details) ? err.details[0] : undefined;
      const reason =
        typeof first === 'object' && first !== null && 'reason' in first && typeof first.reason === 'string' ? first.reason : null;
      if (reason && t.has(`settings.errors.${reason}`)) return t(`settings.errors.${reason}`);
      if (t.has(`settings.errors.${err.code}`)) return t(`settings.errors.${err.code}`);
    }
    return t('settings.saveError');
  };

  // Trimite pe rand modificarile; cele reusite ies din lista, cele esuate raman marcate.
  const runSave = async () => {
    if (ops.length === 0 || ops.some((op) => op.invalid)) return;
    const queue = ops;
    setFailures({});
    setRun({
      ops: queue,
      status: Object.fromEntries(queue.map((op) => [op.id, 'queued'] as const)),
      messages: {},
      done: false,
    });
    const failed: Record<string, string> = {};
    let saved = 0;
    for (const op of queue) {
      setRun((r) => r && { ...r, status: { ...r.status, [op.id]: 'saving' } });
      try {
        // mutatia se incheie dupa reincarcarea listei ei (invalidateQueries), deci valoarea
        // de pe server e deja cea noua cand golim campurile de lucru
        await op.run();
        saved += 1;
        setDrafts((d) => {
          const next = { ...d };
          for (const field of op.fields) delete next[field];
          return next;
        });
        setRun((r) => r && { ...r, status: { ...r.status, [op.id]: 'saved' } });
      } catch (err) {
        const message = describeError(err);
        failed[op.id] = message;
        setRun((r) => r && { ...r, status: { ...r.status, [op.id]: 'failed' }, messages: { ...r.messages, [op.id]: message } });
      }
    }
    setFailures(failed);
    setRun((r) => r && { ...r, done: true });
    const failedCount = Object.keys(failed).length;
    if (failedCount === 0) toast.success(t('settings.savedCount', { count: saved }));
    else toast.error(t('settings.savedPartial', { saved, failed: failedCount }));
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setRun(null);
  };

  const discard = () => {
    setDrafts({});
    setFailures({});
  };

  const listed = listedSettings(settings.data);
  const rowsOf = (section: SectionId) => listed.filter((s) => s.section === section);
  // o tema fara nicio cheie in baza de date nu apare (dupa ce setarile s-au incarcat sau au esuat)
  const hasRows = (section: SectionId) => settings.isPending || rowsOf(section).length > 0;
  const shown: Record<SectionId, boolean> = {
    fiscal: true,
    billing: hasRows('billing'),
    claims: hasRows('claims'),
    quotes: hasRows('quotes'),
    trial: hasRows('trial'),
    penalties: true,
    plans: true,
    packages: true,
    thresholds: true,
    contact: hasRows('contact'),
    legal: hasRows('legal'),
    other: rowsOf('other').length > 0,
    tools: true,
  };
  const sections = SECTION_ORDER.filter((id) => shown[id]);
  const [active, setActive] = useActiveSection(sections);
  const pendingIn = (section: SectionId) => ops.filter((op) => op.section === section).length;

  const sectionText = (id: SectionId) => ({
    title: t(`settings.sections.${id}.title`),
    description: t.has(`settings.sections.${id}.description`) ? t(`settings.sections.${id}.description`) : undefined,
  });

  // randurile unei teme din system_settings (+ continut suplimentar, ex. regulile de penalizare)
  const settingsGroup = (id: SectionId, extra?: ReactNode) =>
    shown[id] && (
      <SettingsSection id={id} {...sectionText(id)}>
        {settings.isPending && <SkeletonText lines={3} className="py-4" />}
        {rowsOf(id).map((s) => (
          <SettingRow key={s.key} settingKey={s.key} server={s.value} />
        ))}
        {extra}
      </SettingsSection>
    );

  return (
    <SettingsDraftProvider value={{ drafts, setField, problems, failures, busy }}>
      <div className="flex max-w-[1180px] flex-col gap-6">
        <PageHeader title={t('nav.settings')} subtitle={t('settings.subtitle')} />

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
          <nav
            aria-label={t('settings.navLabel')}
            className="flex flex-row flex-wrap gap-0.5 lg:sticky lg:top-24 lg:w-60 lg:shrink-0 lg:flex-col"
          >
            {sections.map((id) => {
              const pending = pendingIn(id);
              return (
                <Fragment key={id}>
                  {id === 'tools' && <div aria-hidden className="mx-3 mb-1.5 mt-2.5 hidden h-px bg-border-2 lg:block" />}
                  <a
                    href={`#${id}`}
                    aria-current={active === id ? 'location' : undefined}
                    onClick={() => setActive(id)}
                    className={cn(
                      'flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      active === id ? 'bg-walnut-soft font-medium text-walnut-deep' : 'text-ink-2 hover:bg-surface-3',
                    )}
                  >
                    <span>{sectionText(id).title}</span>
                    {id === 'fiscal' && readiness.data?.ready && (
                      <>
                        <Check aria-hidden className="size-4 text-sage" />
                        <span className="sr-only">{t('settings.fiscal.ready')}</span>
                      </>
                    )}
                    {pending > 0 && (
                      <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-amber-soft px-1.5 font-mono text-meta leading-none text-amber">
                        <span aria-hidden>{pending}</span>
                        <span className="sr-only">{t('settings.unsaved', { count: pending })}</span>
                      </span>
                    )}
                  </a>
                </Fragment>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <FiscalDataSection />

            {/* setarile de sistem n-au putut fi incarcate: o singura eroare, nu una pe fiecare tema */}
            {settings.isError && <LoadError onRetry={() => void settings.refetch()} />}

            {settingsGroup('billing')}
            {settingsGroup('claims')}
            {settingsGroup('quotes')}
            {settingsGroup('trial')}

            {settingsGroup(
              'penalties',
              <>
                {rules.isPending && <SkeletonText lines={3} className="py-4" />}
                {rules.isError && <LoadError onRetry={() => void rules.refetch()} className="my-3" />}
                {rules.data?.map((r) => <PenaltyRuleRow key={r.id} rule={r} />)}
              </>,
            )}

            <SettingsSection id="plans" {...sectionText('plans')}>
              {plans.isPending && <SkeletonText lines={3} className="py-4" />}
              {plans.isError && <LoadError onRetry={() => void plans.refetch()} className="my-3" />}
              {/* E-admin-platform-58: planurile sunt date (cod, nume, pret >= 0, acces marketplace) */}
              {plans.data?.map((p) => <PlanCard key={p.id} plan={p} />)}
              <NewPlanForm />
            </SettingsSection>

            <SettingsSection id="packages" {...sectionText('packages')}>
              {packages.isPending && <SkeletonText lines={3} className="py-4" />}
              {packages.isError && <LoadError onRetry={() => void packages.refetch()} className="my-3" />}
              {packages.data?.map((p) => <PackageRow key={p.id} pkg={p} />)}
            </SettingsSection>

            <SettingsSection id="thresholds" {...sectionText('thresholds')}>
              {/* costul nu se mai seteaza pe prag (PO r5): 1 credit = credit_value_ron lei din
                  bugetul minim estimat, limitat la [claim_cost_min, claim_cost_max] (E-company-21);
                  pragurile decid doar marimea S/M/L (SLA) */}
              <div className="flex flex-col gap-1.5 border-b border-background py-4">
                <ClaimCostNote />
                <Link href="/admin/sizing" className="text-xs text-walnut underline underline-offset-2 hover:text-walnut-deep">
                  {t('settings.weightsLink')}
                </Link>
              </div>
              {thresholds.isPending && <SkeletonText lines={3} className="py-4" />}
              {thresholds.isError && <LoadError onRetry={() => void thresholds.refetch()} className="my-3" />}
              {[...(thresholds.data ?? [])]
                .sort((a, b) => a.minScore - b.minScore)
                .map((th) => (
                  <ThresholdRow key={th.id} threshold={th} />
                ))}
            </SettingsSection>

            {settingsGroup('contact')}
            {settingsGroup('legal')}
            {settingsGroup('other')}

            <ToolsSection />

            {dirty && <SaveBar ops={ops} onDiscard={discard} onSave={() => setDialogOpen(true)} />}
          </div>
        </div>

        <SaveDialog open={dialogOpen} ops={ops} run={run} onClose={closeDialog} onConfirm={() => void runSave()} />
      </div>
    </SettingsDraftProvider>
  );
}
