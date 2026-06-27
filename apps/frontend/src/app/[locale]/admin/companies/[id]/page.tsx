'use client';

import type { CompanyRiskFlag } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { useAdminCompany, useApproveCompany, useRejectCompany } from '@/hooks/use-company';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export default function AdminCompanyDetailPage() {
  const t = useTranslations('AdminCompanies');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useAdminCompany(id);
  const approve = useApproveCompany();
  const reject = useRejectCompany();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  if (detail.isPending) {
    return <p className="py-20 text-center text-muted-foreground">…</p>;
  }
  if (detail.isError || !detail.data) {
    return <p className="py-20 text-center text-muted-foreground">{t('empty')}</p>;
  }

  const c = detail.data;
  const riskFlags = (c.riskFlags ?? []) as CompanyRiskFlag[];
  const pending = c.status === 'PENDING_VERIFICATION';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/admin/companies" className="text-sm text-walnut hover:underline">
        ← {t('back')}
      </Link>
      <h1 className="page-title">{t('detailTitle')}</h1>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <p className="font-serif text-xl">{c.name}</p>
        <p className="text-sm text-muted-foreground">
          {t('cui')}: {c.cui} · {c.regComNumber}
        </p>
        <p className="text-sm text-muted-foreground">
          {c.addressText}, {c.city}, {c.county}
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm">
          {t('status')}: <Badge tone={pending ? 'amber' : 'sage'} dot>{c.status}</Badge>
        </p>
        <p className="mt-1 text-sm">
          {t('riskFlags')}:{' '}
          {riskFlags.length === 0
            ? t('noRisk')
            : riskFlags.map((f) => t(`riskFlagValue.${f}`)).join(', ')}
        </p>
        <p className="text-sm">
          {t('members')}: {c.members.length} · {t('locations')}: {c.locations.length} ·{' '}
          {t('portfolio')}: {c.portfolio.length}
        </p>
      </div>

      {pending && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
          {!rejecting ? (
            <div className="flex gap-3">
              <Button
                onClick={() => approve.mutate(id)}
                disabled={approve.isPending}
                className="bg-sage text-white hover:brightness-110"
              >
                {t('approve')}
              </Button>
              <Button variant="destructive" onClick={() => setRejecting(true)}>
                {t('reject')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Textarea
                placeholder={t('rejectReason')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                variant="destructive"
                className="self-start"
                onClick={() => reject.mutate({ id, reason })}
                disabled={reject.isPending || reason.trim().length < 3}
              >
                {t('rejectConfirm')}
              </Button>
            </div>
          )}
          {approve.isSuccess && <p className="text-sm text-sage">{t('approved')}</p>}
          {reject.isSuccess && <p className="text-sm text-crimson">{t('rejected')}</p>}
        </div>
      )}
    </div>
  );
}
