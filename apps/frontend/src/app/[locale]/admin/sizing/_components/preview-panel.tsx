'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { SizingPreviewDto } from '@marketplace/shared';
import { SkeletonText } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { ClaimCostNote } from '../../_components/claim-cost-note';

const SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;

export type PreviewState = 'idle' | 'stale' | 'loading' | 'ready';

// Panoul din dreapta: efectul modificarilor asupra cererilor recente (previzualizarea de pe server).
export function PreviewPanel({ state, data }: { state: PreviewState; data: SizingPreviewDto | undefined }) {
  const t = useTranslations('Admin.sizing');
  const tr = useTranslations('Requests');
  const format = useFormatter();
  const credits = (n: number) => format.number(n, { maximumFractionDigits: 2 });
  const size = (s: string) => (tr.has(`sizeValue.${s}`) ? tr(`sizeValue.${s}`) : s);

  return (
    <aside
      aria-labelledby="sizing-preview-title"
      className="order-first flex min-w-0 flex-col gap-4 rounded-xl border border-border-2 bg-surface-2 p-6 lg:sticky lg:top-44 lg:order-none lg:max-h-[calc(100vh-12rem)] lg:w-[360px] lg:shrink-0 lg:overflow-y-auto"
    >
      <h2 id="sizing-preview-title" className="heading-section">
        {t('previewTitle')}
      </h2>

      {state === 'idle' && <p className="text-ui text-muted-foreground">{t('previewIdle')}</p>}
      {state === 'stale' && <p className="text-ui text-amber">{t('previewRequired')}</p>}
      {state === 'loading' && <SkeletonText lines={5} />}

      {state === 'ready' && data && (
        <div className="flex flex-col gap-4" aria-live="polite">
          <p className="text-ui text-muted-foreground">
            {t('sampleSize', { count: data.sampleSize })}
            {data.skipped > 0 && ` · ${t('skipped', { count: data.skipped })}`}
          </p>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <Table>
              <THead>
                <TR>
                  <TH scope="col" className="bg-surface-2">
                    {t('sizeCol')}
                  </TH>
                  <TH scope="col" className="bg-surface-2 text-right">
                    {t('current')}
                  </TH>
                  <TH scope="col" className="bg-surface-2 text-right">
                    {t('proposed')}
                  </TH>
                </TR>
              </THead>
              <TBody>
                {SIZES.map((s) => (
                  <TR key={s}>
                    <TD className="py-2.5">{size(s)}</TD>
                    <TD className="py-2.5 text-right font-mono">{data.current[s]}</TD>
                    <TD
                      className={cn(
                        'py-2.5 text-right font-mono',
                        data.proposed[s] !== data.current[s] && 'font-semibold text-amber',
                      )}
                    >
                      {data.proposed[s]}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-2.5">
              <dt>{t('changedSizeLabel')}</dt>
              <dd className="font-mono font-semibold">{data.changedSize}</dd>
            </div>
            <div className="flex justify-between gap-2.5">
              <dt>{t('changedCostLabel')}</dt>
              <dd className="font-mono font-semibold">{data.changedCreditCost}</dd>
            </div>
            <div className="flex justify-between gap-2.5">
              <dt>{t('avgCostLabel')}</dt>
              <dd className="font-mono font-semibold">
                {t('avgCostValue', {
                  current: credits(data.avgCreditCostCurrent),
                  proposed: credits(data.avgCreditCostProposed),
                })}
              </dd>
            </div>
          </dl>
          {data.examples.length > 0 && (
            <div>
              <h3 className="label mb-1.5">{t('examples')}</h3>
              <ul className="flex flex-col gap-0.5 font-mono text-meta text-muted-foreground">
                {data.examples.map((e) => (
                  <li key={e.requestId}>
                    {e.requestId.slice(0, 8)} · {size(e.currentSize)} → {size(e.proposedSize)} · {e.currentCreditCost} →{' '}
                    {e.proposedCreditCost}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* E-company-21: ponderile si setarile de cost (valoare credit + interval) impreuna */}
      <div className="flex flex-col gap-1.5 border-t border-dashed border-muted-2 pt-3.5">
        <ClaimCostNote />
        <Link href="/admin/settings#thresholds" className="text-xs text-walnut underline underline-offset-2 hover:text-walnut-deep">
          {t('thresholdsLink')}
        </Link>
      </div>
    </aside>
  );
}
