'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { SizingPreviewDto, SizingWeightDto } from '@marketplace/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardSection } from '@/components/ui/card';
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
import { ClaimCostNote } from '../_components/claim-cost-note';

// E-admin-platform-25: punctele optiunilor din chestionar (project_sizing_config). Scorul
// decide marimea S/M/L (termenul firmei) si costul in credite al cererilor publicate de acum
// inainte; preluarile existente isi pastreaza costul (snapshot). Salvarea cere o previzualizare
// reusita a exact acelorasi modificari.

const inp =
  'rounded-md border border-border-2 bg-surface px-2 py-1 text-sm focus-visible:outline-none focus-visible:border-foreground';
const SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;

function useErrorMessage() {
  const t = useTranslations('Admin.sizing');
  return (err: unknown) => {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    return t.has(`apiErrors.${code}`) ? t(`apiErrors.${code}`) : t('apiErrors.INTERNAL_ERROR');
  };
}

export default function AdminSizingPage() {
  const t = useTranslations('Admin');
  const weights = useSizingWeights();
  const preview = usePreviewSizing();
  const save = useUpdateSizingWeights();
  const errorMessage = useErrorMessage();
  // draft: id -> valoarea din input (text, ca sa permita campul gol in timpul editarii)
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [previewedKey, setPreviewedKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const rows = useMemo(() => weights.data ?? [], [weights.data]);
  const groups = useMemo(() => {
    const map = new Map<string, SizingWeightDto[]>();
    for (const r of rows) map.set(r.key, [...(map.get(r.key) ?? []), r]);
    return [...map.entries()];
  }, [rows]);

  const invalid = Object.values(draft).some((v) => !/^\d{1,3}$/.test(v) || Number(v) > 100);
  const changes = useMemo(
    () =>
      rows
        .filter((r) => draft[r.id] !== undefined && /^\d{1,3}$/.test(draft[r.id]) && Number(draft[r.id]) !== r.weight)
        .map((r) => ({ id: r.id, weight: Number(draft[r.id]) })),
    [rows, draft],
  );
  const changesKey = JSON.stringify(changes);
  const canSave = changes.length > 0 && !invalid && previewedKey === changesKey && preview.isSuccess && !save.isPending;

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader title={t('sizing.title')} subtitle={t('sizing.hint')} />
        {/* E-company-21: ponderile si setarile de cost (valoare credit + interval) impreuna */}
        <div className="mt-2 max-w-3xl">
          <ClaimCostNote />
        </div>
      </div>

      {weights.isLoading && (
        <div className="flex flex-col gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {weights.isError && <Alert tone="crimson">{errorMessage(weights.error)}</Alert>}

      {/* sub bara sticky a layout-ului admin (57px) */}
      <div className="sticky top-[57px] z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 shadow-sm">
        <span className="text-sm text-muted-foreground">
          {changes.length === 0 ? t('sizing.noChanges') : t('sizing.dirty', { count: changes.length })}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={changes.length === 0 || invalid || preview.isPending} onClick={runPreview}>
            {preview.isPending ? t('sizing.previewing') : t('sizing.preview')}
          </Button>
          <Button size="sm" disabled={!canSave} onClick={() => setConfirm(true)}>
            {t('sizing.save')}
          </Button>
        </div>
      </div>

      {changes.length > 0 && previewedKey !== changesKey && (
        <p className="-mt-3 text-xs text-muted-foreground">{t('sizing.previewRequired')}</p>
      )}

      {preview.data && previewedKey === changesKey && <PreviewPanel data={preview.data} />}

      {groups.map(([key, items]) => (
        <CardSection key={key} title={<span className="data-mono">{key}</span>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((r) => {
              const value = draft[r.id] ?? String(r.weight);
              const changed = draft[r.id] !== undefined && draft[r.id] !== String(r.weight);
              const bad = !/^\d{1,3}$/.test(value) || Number(value) > 100;
              return (
                <label key={r.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-mono text-xs text-muted-foreground" title={r.option}>
                    {r.option}
                  </span>
                  <span className="flex items-center gap-2">
                    {changed && <span className="text-xs text-muted-2 line-through">{r.weight}</span>}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      aria-label={`${r.key} ${r.option}`}
                      value={value}
                      onChange={(e) => {
                        const next = e.target.value;
                        setDraft((d) => {
                          const copy = { ...d };
                          if (next === String(r.weight)) delete copy[r.id];
                          else copy[r.id] = next;
                          return copy;
                        });
                      }}
                      className={`${inp} w-20 text-right ${bad ? 'border-crimson' : changed ? 'border-amber' : ''}`}
                    />
                  </span>
                </label>
              );
            })}
          </div>
        </CardSection>
      ))}

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

function PreviewPanel({ data }: { data: SizingPreviewDto }) {
  const t = useTranslations('Admin.sizing');
  const format = useFormatter();
  const credits = (n: number) => format.number(n, { maximumFractionDigits: 2 });
  return (
    <Card as="section">
      <h2 className="heading-card mb-1">{t('previewTitle')}</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {t('sampleSize', { count: data.sampleSize })}
        {data.skipped > 0 && ` · ${t('skipped', { count: data.skipped })}`}
      </p>
      <table className="mb-3 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-1 pr-6 font-medium" />
            <th className="py-1 pr-6 font-medium">{t('current')}</th>
            <th className="py-1 pr-6 font-medium">{t('proposed')}</th>
          </tr>
        </thead>
        <tbody>
          {SIZES.map((s) => (
            <tr key={s}>
              <td className="py-1 pr-6 font-medium">{s}</td>
              <td className="py-1 pr-6">{data.current[s]}</td>
              <td className={`py-1 pr-6 ${data.proposed[s] !== data.current[s] ? 'font-semibold' : ''}`}>{data.proposed[s]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mb-3 flex flex-col gap-1 text-sm">
        <li>{t('changedSize', { count: data.changedSize })}</li>
        <li>{t('changedCost', { count: data.changedCreditCost })}</li>
        <li>{t('avgCost', { current: credits(data.avgCreditCostCurrent), proposed: credits(data.avgCreditCostProposed) })}</li>
      </ul>
      {data.examples.length > 0 && (
        <>
          <h3 className="mb-1 text-sm font-medium">{t('examples')}</h3>
          <ul className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
            {data.examples.map((e) => (
              <li key={e.requestId}>
                {e.requestId.slice(0, 8)} · {e.currentSize} → {e.proposedSize} · {e.currentCreditCost} → {e.proposedCreditCost}
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
