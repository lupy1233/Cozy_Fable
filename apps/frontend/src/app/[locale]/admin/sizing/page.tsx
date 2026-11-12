'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import type { SizingWeightDto } from '@marketplace/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { usePreviewSizing, useSizingWeights, useUpdateSizingWeights } from '@/hooks/use-admin';
import { ApiError } from '@/lib/api';
import { OldValue, ValueBox } from '../settings/_components/setting-controls';
import { PreviewPanel, type PreviewState } from './_components/preview-panel';

// E-admin-platform-25: punctele optiunilor din chestionar (project_sizing_config). Scorul
// decide marimea S/M/L (termenul firmei) si costul in credite al cererilor publicate de acum
// inainte; preluarile existente isi pastreaza costul (snapshot). Salvarea cere o previzualizare
// reusita a exact acelorasi modificari.

const isBad = (value: string) => !/^\d{1,3}$/.test(value) || Number(value) > 100;

// cautare fara diacritice si fara majuscule
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function useErrorMessage() {
  const t = useTranslations('Admin.sizing');
  return (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    return t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR');
  };
}

// Numele omenesti ale intrebarilor si optiunilor: cele din formular unde exista deja
// (camere, materiale, sisteme, buget), altfel textele paginii; null = ramane doar codul tehnic.
function useSizingLabels() {
  const t = useTranslations('Admin.sizing');
  const tc = useTranslations('Configurator');
  const tr = useTranslations('Requests');
  return {
    group: (key: string): string | null => (t.has(`groups.${key}.title`) ? t(`groups.${key}.title`) : null),
    groupHelp: (key: string): string | null => (t.has(`groups.${key}.help`) ? t(`groups.${key}.help`) : null),
    option: (key: string, option: string): string | null => {
      if (key === 'ROOM_TYPE' && tc.has(`rooms.type.${option}`)) return tc(`rooms.type.${option}`);
      if (key === 'MATERIAL' && tc.has(`common.materials.${option}.label`)) return tc(`common.materials.${option}.label`);
      if (key === 'SYSTEM' && tc.has(`common.systems.${option}.label`)) return tc(`common.systems.${option}.label`);
      if (key === 'BUDGET' && tr.has(`budget.${option}`)) return tr(`budget.${option}`);
      if (t.has(`options.${key}.${option}`)) return t(`options.${key}.${option}`);
      if (option === 'YES') return tc('common.boolean.yes');
      return null;
    },
  };
}

export default function AdminSizingPage() {
  const t = useTranslations('Admin');
  const labels = useSizingLabels();
  const weights = useSizingWeights();
  const preview = usePreviewSizing();
  const save = useUpdateSizingWeights();
  const errorMessage = useErrorMessage();
  // draft: id -> valoarea din input (text, ca sa permita campul gol in timpul editarii)
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [previewedKey, setPreviewedKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [query, setQuery] = useState('');
  const searchId = useId();

  const rows = useMemo(() => weights.data ?? [], [weights.data]);
  const groups = useMemo(() => {
    const map = new Map<string, SizingWeightDto[]>();
    for (const r of rows) map.set(r.key, [...(map.get(r.key) ?? []), r]);
    return [...map.entries()];
  }, [rows]);

  const invalid = Object.values(draft).some(isBad);
  const changes = useMemo(
    () =>
      rows
        .filter((r) => draft[r.id] !== undefined && /^\d{1,3}$/.test(draft[r.id]) && Number(draft[r.id]) !== r.weight)
        .map((r) => ({ id: r.id, weight: Number(draft[r.id]) })),
    [rows, draft],
  );
  const changesKey = JSON.stringify(changes);
  const previewed = previewedKey === changesKey && preview.isSuccess;
  const canSave = changes.length > 0 && !invalid && previewed && !save.isPending;
  const dirty = Object.keys(draft).length > 0;

  const setWeight = (r: SizingWeightDto, next: string) =>
    setDraft((d) => {
      const copy = { ...d };
      if (next === String(r.weight)) delete copy[r.id];
      else copy[r.id] = next;
      return copy;
    });

  const runPreview = () => {
    const key = changesKey;
    preview.mutate(
      { changes },
      {
        onSuccess: () => setPreviewedKey(key),
        onError: (err) => {
          setPreviewedKey(null);
          toast.error(errorMessage(err));
        },
      },
    );
  };

  const runSave = () => {
    save.mutate(
      { changes },
      {
        onSuccess: () => {
          toast.success(t('sizing.saved'));
          setConfirm(false);
          setDraft({});
          setPreviewedKey(null);
          preview.reset();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  const discardAll = () => {
    setDraft({});
    setPreviewedKey(null);
    preview.reset();
  };

  // filtrare pe client: dupa numele intrebarii / codul ei sau dupa numele / codul optiunii
  const q = norm(query.trim());
  const visibleGroups = groups
    .map(([key, items]) => {
      const title = labels.group(key);
      if (!q || norm(`${title ?? ''} ${key}`).includes(q)) return { key, title, items };
      return { key, title, items: items.filter((r) => norm(`${labels.option(key, r.option) ?? ''} ${r.option}`).includes(q)) };
    })
    .filter((g) => g.items.length > 0);

  const previewState: PreviewState = preview.isPending ? 'loading' : changes.length === 0 ? 'idle' : previewed ? 'ready' : 'stale';

  return (
    <div className="flex max-w-[1180px] flex-col gap-6">
      <PageHeader title={t('sizing.title')} subtitle={<span className="block max-w-[780px]">{t('sizing.hint')}</span>} />

      {/* sub bara sticky a layout-ului admin (65px) */}
      {dirty && (
        <div
          role="status"
          className="sticky top-[73px] z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5 rounded-xl border border-brass bg-surface px-5 py-3.5 shadow-sheet"
        >
          <div className="min-w-0 flex-[1_1_280px] text-sm">
            <span className="font-semibold">
              {changes.length === 0 ? t('sizing.noChanges') : `${t('sizing.dirty', { count: changes.length })}.`}
            </span>{' '}
            {invalid ? (
              <span className="text-crimson">{t('sizing.invalidValues')}</span>
            ) : changes.length > 0 ? (
              <span className="text-muted-foreground">{previewed ? t('sizing.previewMatches') : t('sizing.previewRequired')}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button type="button" variant="ghost" size="lg" className="h-11" onClick={discardAll}>
              {t('sizing.discardAll')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11"
              disabled={changes.length === 0 || invalid || preview.isPending}
              onClick={runPreview}
            >
              {preview.isPending ? t('sizing.previewing') : previewed ? t('sizing.previewAgain') : t('sizing.preview')}
            </Button>
            <Button type="button" variant="walnut" size="lg" className="h-11" disabled={!canSave} onClick={() => setConfirm(true)}>
              {t('sizing.savePoints')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <label
            htmlFor={searchId}
            className="flex h-11 items-center gap-2 rounded-md border border-border-2 bg-surface px-3 transition-colors focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/5"
          >
            <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="sr-only">{t('sizing.search')}</span>
            <input
              id={searchId}
              type="search"
              value={query}
              placeholder={t('sizing.search')}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-2"
            />
          </label>

          {weights.isLoading && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}
          {weights.isError && <Alert tone="crimson">{errorMessage(weights.error)}</Alert>}

          {visibleGroups.map((g) => (
            <WeightGroup
              key={g.key}
              groupKey={g.key}
              title={g.title}
              help={labels.groupHelp(g.key)}
              items={g.items}
              draft={draft}
              disabled={save.isPending}
              optionLabel={(option) => labels.option(g.key, option)}
              onChange={setWeight}
            />
          ))}

          {weights.data && visibleGroups.length === 0 && (
            <EmptyState
              variant="dashed"
              size="sm"
              title={t('sizing.noMatch')}
              action={
                q ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setQuery('')}>
                    {t('sizing.clearSearch')}
                  </Button>
                ) : undefined
              }
            />
          )}

          {weights.data && <p className="text-ui text-muted-foreground">{t('sizing.rangeNote')}</p>}
        </div>

        <PreviewPanel state={previewState} data={preview.data} />
      </div>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sizing.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('sizing.confirmBody', { count: changes.length })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              {t('sizing.cancel')}
            </Button>
            <Button disabled={!canSave} onClick={runSave}>
              {t('sizing.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// O intrebare din chestionar cu optiunile ei: numele din formular, codul tehnic in dreapta.
function WeightGroup({
  groupKey,
  title,
  help,
  items,
  draft,
  disabled,
  optionLabel,
  onChange,
}: {
  groupKey: string;
  title: string | null;
  help: string | null;
  items: SizingWeightDto[];
  draft: Record<string, string>;
  disabled: boolean;
  optionLabel: (option: string) => string | null;
  onChange: (row: SizingWeightDto, next: string) => void;
}) {
  const t = useTranslations('Admin.sizing');
  const titleId = useId();
  return (
    <Card as="section" padding="none" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h2 id={titleId} className={title ? 'heading-section' : 'data-mono'}>
            {title ?? groupKey}
          </h2>
          {help && <p className="mt-1 text-ui text-muted-foreground">{help}</p>}
        </div>
        {title && <span className="font-mono text-meta text-muted-foreground">{groupKey}</span>}
      </div>
      <div className="px-6 pb-3 pt-1.5">
        {items.map((r) => {
          const value = draft[r.id] ?? String(r.weight);
          const changed = draft[r.id] !== undefined && draft[r.id] !== String(r.weight);
          const label = optionLabel(r.option);
          const inputId = `sz-${r.id}`;
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-background py-2.5 last:border-b-0"
            >
              <label htmlFor={inputId} className="min-w-0 flex-[1_1_200px]">
                {label ? (
                  <>
                    {label} <span className="ml-1 font-mono text-meta text-muted-foreground">{r.option}</span>
                  </>
                ) : (
                  <span className="font-mono text-ui">{r.option}</span>
                )}
              </label>
              <div className="flex items-center gap-3">
                {changed && <OldValue>{r.weight}</OldValue>}
                <ValueBox
                  id={inputId}
                  value={value}
                  onChange={(next) => onChange(r, next)}
                  unit={t('pointsUnit')}
                  changed={changed}
                  invalid={isBad(value)}
                  disabled={disabled}
                  maxLength={3}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
