'use client';

import type { AdminWithdrawalItemDto } from '@marketplace/shared';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useMe } from '@/hooks/use-auth';
import { useAdminWithdrawals, useReviewWithdrawal } from '@/hooks/use-claims-lifecycle';
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

type Decision = { item: AdminWithdrawalItemDto; approve: boolean };

// Retragerile CUSTOM („Alt motiv”) in asteptarea deciziei adminului (4.15). Fiecare decizie
// trece printr-un dialog care spune ce urmeaza; decizia se ia o singura data.
export default function AdminWithdrawalsPage() {
  const t = useTranslations('AdminWithdrawals');
  const tl = useTranslations('Lifecycle');
  const format = useFormatter();
  const router = useRouter();
  const me = useMe();
  const list = useAdminWithdrawals();
  const review = useReviewWithdrawal();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<Decision | null>(null);
  // E-company-1: aprobarea refuzata (ex. slotul a castigat intre timp) → mesajul mapat, ca adminul sa respinga
  const errCode = review.error ? (review.error instanceof ApiError ? review.error.code : 'INTERNAL_ERROR') : null;
  const errText = errCode
    ? tl.has(`apiErrors.${errCode}`)
      ? tl(`apiErrors.${errCode}`)
      : tl('apiErrors.INTERNAL_ERROR')
    : null;

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (me.isPending) {
    return <SkeletonPage variant="list" />;
  }

  const decisionNote = decision ? (notes[decision.item.id] ?? '').trim() : '';
  // dialog nou → fara eroarea ramasa de la incercarea anterioara
  const openDecision = (next: Decision) => {
    review.reset();
    setDecision(next);
  };
  const runDecision = () => {
    if (!decision) return;
    const { item, approve } = decision;
    review.mutate(
      { id: item.id, approve, adminNote: notes[item.id] },
      {
        onSuccess: () => {
          toast.success(approve ? t('approvedToast') : t('rejectedToast'));
          setDecision(null);
        },
      },
    );
  };

  return (
    <div className="flex w-full max-w-[920px] flex-col gap-6">
      <PageHeader title={t('title')} subtitle={<span className="block text-lead">{t('subtitle')}</span>} />

      {/* API-ul da doar retragerile in asteptare → o singura lista, cu antetul din macheta (fara istoric) */}
      <div className="flex border-b border-border-2">
        <h2 className="-mb-px inline-flex min-h-12 items-center gap-2 border-b-2 border-foreground px-4 text-sm font-semibold">
          {t('pending')}
          {list.data && <span className="font-mono text-xs font-normal">{list.data.length}</span>}
        </h2>
      </div>

      {list.isPending && <SkeletonList rows={3} variant="cards" />}
      {list.isError && <LoadError onRetry={() => void list.refetch()} />}
      {list.isSuccess && list.data.length === 0 && (
        <EmptyState variant="dashed" title={t('empty')} hint={t('emptyHint')} />
      )}

      {list.data?.map((w) => (
        <Card key={w.id} as="article" padding="none" className="flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border px-6 py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h3 className="heading-section">{w.companyName}</h3>
              {w.requestTitle && <p className="text-sm text-muted-foreground">{w.requestTitle}</p>}
            </div>
            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {format.dateTime(new Date(w.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>

          <div className="flex flex-col gap-3.5 px-6 py-4">
            <div>
              <div className="label">{tl(`reason.${w.reasonType}`)}</div>
              {w.customReason && <p className="mt-1 italic text-ink-2">„{w.customReason}”</p>}
            </div>

            {/* ce urmeaza dupa fiecare decizie (regulile din 4.15, doar afisate) */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-2.5">
              <div className="rounded-lg bg-sage-soft px-3 py-2.5 text-sage">
                <div className="text-xs">{t('ifApprove')}</div>
                <div className="text-sm font-semibold">{t('ifApproveBody')}</div>
              </div>
              <div className="rounded-lg bg-crimson-soft px-3 py-2.5 text-crimson">
                <div className="text-xs">{t('ifReject')}</div>
                <div className="text-sm font-semibold">{t('ifRejectBody')}</div>
              </div>
            </div>

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
                value={notes[w.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [w.id]: e.target.value }))}
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2.5">
              <Button
                variant="outline"
                className="h-11 px-5"
                onClick={() => openDecision({ item: w, approve: false })}
                disabled={review.isPending}
              >
                {t('reject')}
              </Button>
              <Button
                className="h-11 px-5"
                onClick={() => openDecision({ item: w, approve: true })}
                disabled={review.isPending}
              >
                {t('approve')}
              </Button>
            </div>
            {errText && review.variables?.id === w.id && (
              <p role="alert" className="text-sm text-crimson">
                {errText}
              </p>
            )}
          </div>
        </Card>
      ))}

      <Dialog open={decision !== null} onOpenChange={(open) => !open && !review.isPending && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision?.approve ? t('confirm.approveTitle') : t('confirm.rejectTitle')}</DialogTitle>
            <DialogDescription>
              {decision &&
                (decision.item.requestTitle
                  ? `${decision.item.companyName} · ${decision.item.requestTitle}`
                  : decision.item.companyName)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm">
            <p>{decision?.approve ? t('confirm.approveBody') : t('confirm.rejectBody')}</p>
            <p className="text-muted-foreground">
              {decisionNote ? t('confirm.note', { note: decisionNote }) : t('confirm.noNote')}
            </p>
            <p className="font-medium">{t('confirm.final')}</p>
            {decision && errText && review.variables?.id === decision.item.id && (
              <Alert tone="crimson" role="alert">
                {errText}
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={review.isPending} onClick={() => setDecision(null)}>
              {t('confirm.back')}
            </Button>
            <Button disabled={review.isPending} onClick={runDecision}>
              {decision?.approve ? t('confirm.approveCta') : t('confirm.rejectCta')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
