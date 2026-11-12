'use client';

import { isValidRoCui, type CompanyRiskFlag } from '@marketplace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, ImageOff } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { useAdminCompany, useApproveCompany, useRejectCompany, useUnsuspendCompany } from '@/hooks/use-company';
import { useRelativeTime } from '@/lib/relative-time';
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
import { SkeletonPage } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CompanyStatusBadge, RiskFlagPills } from '../../_components/company-status';
import { Pill, type PillTone } from '../../_components/core-list-parts';

const REJECT_REASON_MIN = 3;

type Decision = 'approve' | 'reject' | 'unsuspend';

const MEMBER_ROLE_TONE: Record<string, PillTone> = {
  OWNER: 'walnut',
  MANAGER: 'sage',
};

// Verificarea unei firme (design 2026-11): dovezile in stanga (date, membri, locatii,
// portofoliu), decizia in dreapta. Orice decizie cere o confirmare care spune ce urmeaza.
export default function AdminCompanyDetailPage() {
  const t = useTranslations('AdminCompanies');
  const tc = useTranslations('Company');
  const format = useFormatter();
  const relative = useRelativeTime();
  const qc = useQueryClient();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useAdminCompany(id);
  const approve = useApproveCompany();
  const reject = useRejectCompany();
  const unsuspend = useUnsuspendCompany();
  const [reason, setReason] = useState('');
  // `decision` ramane setat si dupa inchidere, ca textul dialogului sa nu dispara in animatia de iesire
  const [decision, setDecision] = useState<Decision>('approve');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reasonId = useId();
  const reasonHintId = useId();
  const decisionTitleId = useId();

  if (detail.isPending) {
    return <SkeletonPage variant="detail" />;
  }
  if (detail.isError || !detail.data) {
    return (
      <EmptyState
        variant="card"
        title={t('empty')}
        action={
          <Link href="/admin/companies" className="text-sm text-walnut hover:underline">
            ← {t('back')}
          </Link>
        }
      />
    );
  }

  const c = detail.data;
  const riskFlags = (c.riskFlags ?? []) as CompanyRiskFlag[];
  const pending = c.status === 'PENDING_VERIFICATION';
  const suspended = c.status === 'SUSPENDED';
  const busy = approve.isPending || reject.isPending || unsuspend.isPending;
  // dupa o decizie reusita starea se reincarca; pana atunci butoanele raman oprite (fara dubla trimitere)
  const decided = approve.isSuccess || reject.isSuccess;
  const reasonOk = reason.trim().length >= REJECT_REASON_MIN;

  const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;
  const identityComplete = [c.name, c.cui, c.regComNumber, c.addressText, c.city, c.county].every(filled);
  // cifra de control a CUI-ului (acelasi algoritm ca la datele fiscale ale platformei)
  const cuiOk = isValidRoCui(c.cui);
  const teamOk = c.members.length > 0 && c.locations.length > 0;
  const portfolioOk = c.portfolio.length > 0;

  const dateTime = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  const openDecision = (kind: Decision) => {
    approve.reset();
    reject.reset();
    unsuspend.reset();
    setDecision(kind);
    setConfirmOpen(true);
  };
  const onDecided = () => {
    setConfirmOpen(false);
    // contorul „firme de verificat” din meniu si din tabloul de bord vine din KPI
    void qc.invalidateQueries({ queryKey: ['admin', 'kpi'] });
  };
  const runDecision = () => {
    if (decision === 'approve') approve.mutate(id, { onSuccess: onDecided });
    else if (decision === 'reject') reject.mutate({ id, reason }, { onSuccess: onDecided });
    else unsuspend.mutate(id, { onSuccess: onDecided });
  };
  const dialogError =
    decision === 'approve' ? approve.isError : decision === 'reject' ? reject.isError : unsuspend.isError;

  return (
    <div className="flex w-full max-w-[1180px] flex-col gap-6">
      <header className="flex flex-col gap-2.5">
        <Link
          href="/admin/companies"
          className="inline-flex min-h-11 items-center self-start text-sm text-walnut hover:underline"
        >
          ← {t('back')}
        </Link>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="page-title min-w-0 break-words">{c.name}</h1>
          <CompanyStatusBadge status={c.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {t('registeredWhen', { when: relative(c.createdAt) })}
          {pending && ` ${t('decisionIntro')}`}
        </p>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        {/* dovezile */}
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-6">
          <EvidenceSection title={t('identity.title')}>
            <dl className="px-6 pb-3.5 pt-1.5 text-sm">
              <DataRow label={t('cui')}>
                <span className="font-mono text-ui">{c.cui}</span>
                <Pill tone={cuiOk ? 'sage' : 'amber'} className="ml-2">
                  {cuiOk ? t('identity.cuiValid') : t('identity.cuiInvalid')}
                </Pill>
              </DataRow>
              <DataRow label={tc('regComNumber')}>
                <span className="font-mono text-ui">{c.regComNumber}</span>
              </DataRow>
              <DataRow label={tc('addressText')}>
                {c.addressText}, {c.city}, {c.county}
              </DataRow>
              <DataRow label={tc('vatPayer')}>{c.isVatPayer ? t('yes') : t('no')}</DataRow>
              <DataRow label={t('registered')}>
                <time dateTime={c.createdAt}>{dateTime(c.createdAt)}</time>
              </DataRow>
              <DataRow label={t('riskFlags')} last>
                <RiskFlagPills flags={riskFlags} />
              </DataRow>
            </dl>
          </EvidenceSection>

          <EvidenceSection title={t('membersAndLocations')}>
            <ul className="px-6 pb-3.5 pt-1.5 text-sm">
              {c.members.length === 0 && <ListRow muted>{t('noMembers')}</ListRow>}
              {c.members.map((m) => (
                <ListRow key={m.id}>
                  <span className="min-w-0 break-words">
                    <span className="font-medium">{m.name}</span> ·{' '}
                    <a href={`mailto:${m.email}`} className="text-walnut hover:underline">
                      {m.email}
                    </a>
                  </span>
                  <Pill tone={MEMBER_ROLE_TONE[m.role] ?? 'muted'}>{tc(`roleValue.${m.role}`)}</Pill>
                </ListRow>
              ))}
              {c.locations.length === 0 && <ListRow muted>{t('noLocations')}</ListRow>}
              {c.locations.map((l) => (
                <ListRow key={l.id}>
                  <span className="min-w-0 break-words">
                    {l.addressText}, {l.city}, {l.county}
                  </span>
                  <span className="data-mono text-muted-foreground">
                    {tc('coverageRadiusLabel', { km: l.coverageRadiusKm })}
                  </span>
                </ListRow>
              ))}
            </ul>
          </EvidenceSection>

          <PortfolioSection
            title={t('portfolio')}
            emptyTitle={t('portfolioEmptyTitle')}
            emptyHint={t('portfolioEmptyHint')}
            items={c.portfolio}
            formatDate={(iso) => format.dateTime(new Date(iso), { dateStyle: 'medium' })}
          />
        </div>

        {/* decizia */}
        <Card
          as="aside"
          padding="lg"
          aria-labelledby={decisionTitleId}
          className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 border-brass shadow xl:sticky xl:top-24"
        >
          <h2 id={decisionTitleId} className="heading-section">
            {pending ? t('decision.title') : t('decision.titleDone')}
          </h2>

          <ul className="flex flex-col gap-2 text-ui">
            <CheckItem ok={identityComplete && cuiOk} okLabel={t('check.ok')} attentionLabel={t('check.attention')}>
              {!identityComplete
                ? t('check.identityMissing')
                : cuiOk
                  ? t('check.identityOk')
                  : t('check.cuiInvalid')}
            </CheckItem>
            <CheckItem ok={teamOk} okLabel={t('check.ok')} attentionLabel={t('check.attention')}>
              {t('check.team', { members: c.members.length, locations: c.locations.length })}
            </CheckItem>
            <CheckItem ok={portfolioOk} okLabel={t('check.ok')} attentionLabel={t('check.attention')}>
              {t('check.portfolio', { count: c.portfolio.length })}
            </CheckItem>
          </ul>

          {approve.isSuccess && (
            <Alert tone="sage" role="status">
              {t('approved')}
            </Alert>
          )}
          {reject.isSuccess && (
            <Alert tone="neutral" role="status">
              {t('rejected')}
            </Alert>
          )}
          {unsuspend.isSuccess && (
            <Alert tone="sage" role="status">
              {t('unsuspended')}
            </Alert>
          )}

          {pending && (
            <>
              <Button
                variant="walnut"
                size="xl"
                className="w-full"
                disabled={busy || decided}
                onClick={() => openDecision('approve')}
              >
                {t('approveOpen')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('approveNote')}</p>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <label htmlFor={reasonId} className="text-ui font-medium">
                  {t('rejectReason')}
                </label>
                <Textarea
                  id={reasonId}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  aria-describedby={reasonHintId}
                  disabled={busy || decided}
                />
                <p id={reasonHintId} className="text-xs text-muted-foreground">
                  {t('rejectHint', { min: REJECT_REASON_MIN })}
                </p>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 border-crimson text-crimson hover:border-crimson hover:bg-crimson-soft"
                  disabled={busy || decided || !reasonOk}
                  onClick={() => openDecision('reject')}
                >
                  {t('rejectOpen')}
                </Button>
              </div>
            </>
          )}

          {c.status === 'APPROVED' && <p className="text-sm text-muted-foreground">{t('decision.approvedNote')}</p>}

          {c.status === 'REJECTED' && (
            <>
              <dl className="flex flex-col gap-3 text-sm">
                {c.rejectedAt && (
                  <div className="flex flex-col gap-1">
                    <dt className="label">{t('decision.rejectedAt')}</dt>
                    <dd>
                      <time dateTime={c.rejectedAt}>{dateTime(c.rejectedAt)}</time>
                    </dd>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <dt className="label">{t('rejectReason')}</dt>
                  <dd className="whitespace-pre-wrap break-words">{c.rejectionReason || '—'}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">{t('decision.rejectedNote')}</p>
            </>
          )}

          {/* Pasul 5 (F2): ridicarea suspendarii — inainte nu exista nicio cale in produs */}
          {suspended && (
            <>
              <p className="text-sm text-muted-foreground">{t('suspendedNote')}</p>
              {c.suspendedUntil && (
                <p className="text-sm">
                  {tc('suspendedNotice', {
                    until: format.dateTime(new Date(c.suspendedUntil), { dateStyle: 'medium' }),
                  })}
                </p>
              )}
              <Button
                variant="walnut"
                size="lg"
                className="h-11 w-full"
                disabled={busy || unsuspend.isSuccess}
                onClick={() => openDecision('unsuspend')}
              >
                {t('unsuspendOpen')}
              </Button>
            </>
          )}
        </Card>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(`confirm.${decision}.title`, { name: c.name })}</DialogTitle>
            <DialogDescription>{t(`confirm.${decision}.body`)}</DialogDescription>
          </DialogHeader>
          {decision === 'reject' && (
            <div className="flex flex-col gap-1.5">
              <p className="label">{t('rejectReason')}</p>
              <p className="whitespace-pre-wrap break-words rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
                {reason.trim()}
              </p>
            </div>
          )}
          {dialogError && (
            <p role="alert" className="mt-3 text-sm text-crimson">
              {decision === 'unsuspend' ? t('unsuspendError') : t('actionError')}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setConfirmOpen(false)} disabled={busy}>
              {t('confirm.cancel')}
            </Button>
            <Button
              variant={decision === 'reject' ? 'destructive' : 'default'}
              size="lg"
              disabled={busy}
              onClick={runDecision}
            >
              {t(`confirm.${decision}.cta`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EvidenceSection({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <Card as="section" padding="none" aria-labelledby={titleId}>
      <div className="border-b border-border px-6 py-[18px]">
        <h2 id={titleId} className="heading-section">
          {title}
        </h2>
      </div>
      {children}
    </Card>
  );
}

function DataRow({ label, last, children }: { label: string; last?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex flex-wrap gap-x-6 gap-y-1 py-[11px]', !last && 'border-b border-background')}>
      <dt className="w-44 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function ListRow({ muted, children }: { muted?: boolean; children: ReactNode }) {
  return (
    <li
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-background py-[11px] last:border-0',
        muted && 'text-muted-foreground',
      )}
    >
      {children}
    </li>
  );
}

function CheckItem({
  ok,
  okLabel,
  attentionLabel,
  children,
}: {
  ok: boolean;
  okLabel: string;
  attentionLabel: string;
  children: ReactNode;
}) {
  return (
    <li className={cn('flex items-start gap-2.5', !ok && 'font-medium text-crimson')}>
      {ok ? (
        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-sage" />
      ) : (
        <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      )}
      <span>
        <span className="sr-only">{ok ? okLabel : attentionLabel}: </span>
        {children}
      </span>
    </li>
  );
}

function PortfolioSection({
  title,
  emptyTitle,
  emptyHint,
  items,
  formatDate,
}: {
  title: string;
  emptyTitle: string;
  emptyHint: string;
  items: { id: string; title: string; description: string | null; imageUrl: string | null; createdAt: string }[];
  formatDate: (iso: string) => string;
}) {
  const titleId = useId();
  const empty = items.length === 0;
  // fara portofoliu = semnal de risc → chenar carmin, ca pastila din lista
  return (
    <Card
      as="section"
      padding="none"
      aria-labelledby={titleId}
      className={cn('flex flex-col gap-3.5 px-6 pb-6 pt-[18px]', empty && 'border-crimson/40')}
    >
      <h2 id={titleId} className="heading-section">
        {title}
        {!empty && <span className="ml-2 font-mono text-xs text-muted-foreground">{items.length}</span>}
      </h2>
      {empty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-2 px-5 py-7 text-center">
          <p className="heading-card">{emptyTitle}</p>
          <p className="max-w-[420px] text-ui text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
          {items.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface-2">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center border-b border-dashed border-border-2 text-muted-2">
                  <ImageOff aria-hidden className="size-5" />
                </div>
              )}
              <div className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium">{p.title}</p>
                {p.description && <p className="text-ui text-muted-foreground">{p.description}</p>}
                <p className="data-mono text-muted-foreground">{formatDate(p.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
