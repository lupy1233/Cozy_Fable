'use client';

import type { AdminDisputeItemDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useRelativeTime } from '@/lib/relative-time';
import { useMe } from '@/hooks/use-auth';
import { useAdminDisputes, useResolveDispute } from '@/hooks/use-fulfillment';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { LoadError } from '@/components/ui/query-state';
import { SkeletonList, SkeletonPage } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';

type Decision = { item: AdminDisputeItemDto; status: 'RESOLVED' | 'DISMISSED' };
const STARS = [1, 2, 3, 4, 5] as const;

// Disputele deschise pe recenzii (4.18). D-L1-3: RESOLVED = recenzia ramane inregistrata;
// DISMISSED = recenzia se sterge. Consecinta e scrisa pe fiecare decizie si in dialog.
export default function AdminDisputesPage() {
  const t = useTranslations('AdminDisputes');
  const router = useRouter();
  const relative = useRelativeTime();
  const me = useMe();
  const list = useAdminDisputes();
  const resolve = useResolveDispute();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<Decision | null>(null);
  const errCode = resolve.error ? (resolve.error instanceof ApiError ? resolve.error.code : 'INTERNAL_ERROR') : null;
  const errText = errCode
    ? t.has(`apiErrors.${errCode}`)
      ? t(`apiErrors.${errCode}`)
      : t('apiErrors.INTERNAL_ERROR')
    : null;

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) return <SkeletonPage variant="list" />;

  // dialog nou → fara eroarea ramasa de la incercarea anterioara
  const openDecision = (next: Decision) => {
    resolve.reset();
    setDecision(next);
  };
  const runDecision = () => {
    if (!decision) return;
    const { item, status } = decision;
    resolve.mutate(
      { id: item.id, status, resolutionNote: notes[item.id] },
      {
        onSuccess: () => {
          toast.success(status === 'RESOLVED' ? t('resolvedToast') : t('dismissedToast'));
          setDecision(null);
        },
      },
    );
  };

  return (
    <div className="flex w-full max-w-[920px] flex-col gap-6">
      <PageHeader title={t('title')} subtitle={<span className="block text-lead">{t('subtitle')}</span>} />

      {/* API-ul da doar disputele deschise → o singura lista, cu antetul din macheta (fara „Inchise”) */}
      <div className="flex border-b border-border-2">
        <h2 className="-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 border-foreground px-4 text-sm font-semibold">
          {t('open')}
          {list.data && <span className="font-mono text-xs font-normal">{list.data.length}</span>}
        </h2>
      </div>

      {list.isPending && <SkeletonList rows={3} variant="cards" />}
      {list.isError && <LoadError onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState variant="dashed" title={t('empty')} hint={t('emptyHint')} />
      )}

      {list.data?.map((d) => (
        <Card key={d.id} as="article" padding="none" className="flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-6 py-4">
            <h3 className="heading-section">{d.companyName}</h3>
            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {t('openedAgo', { when: relative(d.createdAt) })}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 border-b border-border px-6 py-4">
            <div className="label">{t('reviewLabel')}</div>
            <div role="img" aria-label={t('stars', { n: d.rating })} className="flex gap-0.5 text-xl leading-none">
              {STARS.map((n) => (
                <span key={n} aria-hidden className={n <= d.rating ? 'text-brass' : 'text-border-2'}>
                  ★
                </span>
              ))}
            </div>
            {d.comment ? (
              <p className="italic text-ink-2">„{d.comment}”</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noComment')}</p>
            )}
            <Link
              href={`/admin/requests/${d.requestId}`}
              className="inline-flex min-h-11 items-center self-start text-sm font-medium text-walnut underline-offset-4 hover:underline"
            >
              {t('timelineLink')} →
            </Link>
          </div>

          <div className="flex flex-col gap-3.5 px-6 py-4">
            <Field
              label={
                <>
                  {t('noteLabel')} <span className="font-normal text-muted-foreground">{t('noteOptional')}</span>
                </>
              }
            >
              <Input
                className="h-11"
                maxLength={2000}
                value={notes[d.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [d.id]: e.target.value }))}
              />
            </Field>

            {/* fiecare decizie spune explicit ce se intampla cu recenzia (D-L1-3) */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3">
              <div className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3.5">
                <div className="text-sm font-semibold">{t('dismissTitle')}</div>
                <p className="text-ui text-muted-foreground">{t('dismissBody')}</p>
                <Button
                  variant="outline"
                  className="mt-auto h-11 self-start px-5"
                  onClick={() => openDecision({ item: d, status: 'DISMISSED' })}
                  disabled={resolve.isPending}
                >
                  {t('dismiss')}
                </Button>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3.5">
                <div className="text-sm font-semibold">{t('resolveTitle')}</div>
                <p className="text-ui text-muted-foreground">{t('resolveBody')}</p>
                <Button
                  className="mt-auto h-11 self-start px-5"
                  onClick={() => openDecision({ item: d, status: 'RESOLVED' })}
                  disabled={resolve.isPending}
                >
                  {t('resolve')}
                </Button>
              </div>
            </div>
            {errText && resolve.variables?.id === d.id && (
              <p role="alert" className="text-sm text-crimson">
                {errText}
              </p>
            )}
          </div>
        </Card>
      ))}

      <Dialog open={decision !== null} onOpenChange={(open) => !open && !resolve.isPending && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.status === 'RESOLVED' ? t('confirm.resolveTitle') : t('confirm.dismissTitle')}
            </DialogTitle>
            <DialogDescription>
              {decision && `${decision.item.companyName} · ${t('stars', { n: decision.item.rating })}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p>{decision?.status === 'RESOLVED' ? t('confirm.resolveBody') : t('confirm.dismissBody')}</p>
            <p className="font-medium">{t('confirm.final')}</p>
            {decision && errText && resolve.variables?.id === decision.item.id && (
              <Alert tone="crimson" role="alert">
                {errText}
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={resolve.isPending} onClick={() => setDecision(null)}>
              {t('confirm.back')}
            </Button>
            <Button
              variant={decision?.status === 'DISMISSED' ? 'destructive' : 'default'}
              disabled={resolve.isPending}
              onClick={runDecision}
            >
              {decision?.status === 'RESOLVED' ? t('confirm.resolveCta') : t('confirm.dismissCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
