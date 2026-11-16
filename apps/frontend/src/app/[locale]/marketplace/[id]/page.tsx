'use client';

import type { MarketplaceDetailDto } from '@marketplace/shared';
import { ArrowRight, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { ApiError } from '@/lib/api';
import { useClaim, useMarketplaceDetail, useWallet } from '@/hooks/use-marketplace';
import { isFirmRules, useFirmRules } from '@/hooks/use-legal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonPage } from '@/components/ui/skeleton';
import { ContactSafeText } from '@/components/ui/contact-safe-text';
import { FirmRulesLink, firmRulesChunk } from '../../_components/firm-rules-link';
import { ActionConfirmDialog } from '../../_components/action-confirm-dialog';
import { RoomSpecCard, RoomSpecNav } from '@/components/configurator/room-spec-card';
import { RequestInspirationByRoom } from '@/components/configurator/request-inspiration-by-room';
import { StudioScenesButton } from '@/components/studio/scene-button';
import { useRelativeTime } from '@/lib/relative-time';
import { distanceLabel } from '@/lib/marketplace-distance';
import { cn } from '@/lib/utils';
import { AccessBlocked, isAccessBlocked } from '../_components/access-blocked';
import { RequestTag } from '../_components/request-tag';
import { SlotBars } from '../_components/slot-bars';
import { WorksheetButton } from '../_components/worksheet-button';

// Design 2026-11 (canvas): continutul cererii in stanga, preluarea intr-un panou alaturat
// (coloana din dreapta pe desktop, sub continut pe ecrane inguste), cu regulile pe trei
// randuri scurte. Confirmarea ramane dialogul cu costul si regulile de retragere.
export default function MarketplaceDetailPage() {
  const t = useTranslations('Marketplace');
  const tr = useTranslations('Requests');
  const params = useParams<{ id: string }>();
  const id = params.id;
  const detail = useMarketplaceDetail(id);
  const relTime = useRelativeTime();

  if (detail.isPending) {
    return <SkeletonPage variant="detail" />;
  }
  if (detail.isError || !detail.data) {
    // firma neverificata / suspendata / fara abonament → acelasi ecran de blocaj ca in lista
    if (isAccessBlocked(detail.error)) {
      return <AccessBlocked error={detail.error} onRetry={() => void detail.refetch()} />;
    }
    return (
      <EmptyState
        tone="error"
        variant="card"
        title={t('empty')}
        action={
          <Link href="/marketplace" className="text-sm text-walnut hover:underline">
            ← {t('back')}
          </Link>
        }
      />
    );
  }

  const r = detail.data;
  const hasNotes = r.includesPaidDesign || r.hasOwnProject;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: '/marketplace', label: t('back') }}
        title={<ContactSafeText text={r.title} />}
        subtitle={<span className="data-mono">{t('detailMeta', { when: relTime(r.publishedAt) })}</span>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {/* rezumat: mesajul clientului + cele patru repere ale cererii */}
          <Card as="section" padding="none" aria-label={t('summaryLabel')}>
            {r.description && (
              <p className="px-6 py-5 font-serif text-lg italic leading-relaxed text-ink-2">
                <q>
                  <ContactSafeText text={r.description} />
                </q>
              </p>
            )}
            {hasNotes && (
              <div className={cn('flex flex-wrap gap-2 px-6', r.description ? 'pb-5' : 'py-5')}>
                {r.includesPaidDesign && <RequestTag tone="sage">{t('includesPaidDesign')}</RequestTag>}
                {r.hasOwnProject && <RequestTag tone="info">{t('hasOwnProject')}</RequestTag>}
              </div>
            )}
            <dl
              className={cn(
                'grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))]',
                (r.description || hasNotes) && 'border-t border-border',
              )}
            >
              {r.size && <Fact label={t('size')}>{tr(`sizeValue.${r.size}`)}</Fact>}
              <Fact label={tr('field.budgetRange')}>{tr(`budget.${r.budgetRange}`)}</Fact>
              <Fact label={t('desiredDeadline')}>
                {r.deadlineBucket ? tr(`deadline.${r.deadlineBucket}`) : tr('deadline.none')}
              </Fact>
              <Fact label={t('location')} title={t('distanceHint')}>
                {r.city}, {r.county} · {distanceLabel(r, t)}
              </Fact>
            </dl>
          </Card>

          {/* Camere (fara date de contact pre-claim, invarianta 4.2) — prezentare
              structurata per camera, cu navigare cand sunt multe (item 6).
              Atasamentele (PO r6) aduc schitele + snapshotul PNG al pieselor 3D. */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 className="font-serif text-2xl">{t('sectionRooms')}</h2>
              {/* camera 3D din Studio (feedback PO r3): amplasarea exacta, read-only */}
              <StudioScenesButton scenes={r.studioScenes} />
            </div>
            <RoomSpecNav rooms={r.rooms} />
            {r.rooms.map((room, i) => (
              <RoomSpecCard key={room.id} room={room} index={i + 1} attachments={r.attachments} />
            ))}
          </section>

          {/* inspiratia aleasa de client din galerie (F6), grupata pe camere; notitele sunt mascate pre-claim */}
          <RequestInspirationByRoom photos={r.inspirationPhotos} rooms={r.rooms} />
        </div>

        <ClaimPanel request={r} />
      </div>
    </div>
  );
}

function Fact({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-6 py-4" title={title}>
      <dt className="label">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

// Un rand din regulile preluarii: bifa = ce primesti, semnul exclamarii = ce risti.
function RuleRow({ tone, children }: { tone: 'ok' | 'warn'; children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className={cn(
          'mt-px grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold leading-none',
          tone === 'ok' ? 'bg-sage-soft text-sage' : 'bg-amber-soft text-amber',
        )}
      >
        {tone === 'ok' ? <Check className="size-3" strokeWidth={3} /> : '!'}
      </span>
      <span>{children}</span>
    </li>
  );
}

function ClaimPanel({ request }: { request: MarketplaceDetailDto }) {
  const t = useTranslations('Marketplace');
  const router = useRouter();
  const claim = useClaim();
  const wallet = useWallet();
  const tu = useTranslations('Legal.firmRules.units');
  // E-company-6: preluarea rezerva credite → dialog cu costul, soldul ramas si regulile de retragere
  const [confirmOpen, setConfirmOpen] = useState(false);
  const firmRules = useFirmRules();
  const rules = isFirmRules(firmRules.data) ? firmRules.data : null;

  const full = request.activeClaims >= request.maxClaims;
  const insufficient =
    wallet.data != null &&
    request.creditCost != null &&
    wallet.data.available < request.creditCost;
  const apiErr = claim.error instanceof ApiError ? claim.error.code : null;
  const apiErrText = apiErr
    ? t.has(`apiErrors.${apiErr}`)
      ? t(`apiErrors.${apiErr}`)
      : t('apiErrors.INTERNAL_ERROR')
    : null;

  // deja preluata de firma: pasul urmator e fisa de lucru (oferta, chat, termen)
  if (request.alreadyClaimedByMyCompany) {
    return (
      <Card
        as="aside"
        padding="lg"
        aria-label={t('claimPanel.label')}
        className="flex flex-col gap-4 lg:sticky lg:top-24"
      >
        <Badge tone="sage" dot className="self-start">
          {t('alreadyClaimed')}
        </Badge>
        <p className="text-sm text-muted-foreground">{t('claimPanel.mineHint')}</p>
        <WorksheetButton requestId={request.id} variant="default" className="w-full" />
      </Card>
    );
  }

  return (
    <Card
      as="aside"
      padding="lg"
      aria-label={t('claimPanel.label')}
      className="flex flex-col gap-4 border-brass shadow lg:sticky lg:top-24"
    >
      <h2 className="font-serif text-2xl leading-tight">{t('claimPanel.title')}</h2>

      <div className="flex flex-col gap-2 text-sm">
        <dl className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{t('claimPanel.cost')}</dt>
            <dd className="font-mono text-xl font-medium">
              {request.creditCost != null ? t('availableCredits', { n: request.creditCost }) : '—'}
            </dd>
          </div>
          {wallet.data && request.creditCost != null && (
            <div className="flex items-baseline justify-between gap-3 text-ui">
              <dt className="text-muted-foreground">
                {insufficient ? t('balanceLabel') : t('claimPanel.remaining')}
              </dt>
              <dd className={cn('font-mono', insufficient && 'text-crimson')}>
                {t('availableCredits', {
                  n: insufficient ? wallet.data.available : wallet.data.available - request.creditCost,
                })}
              </dd>
            </div>
          )}
        </dl>
        <div className="flex items-center justify-between gap-3 text-ui">
          <span className="text-muted-foreground">
            {t('slots', { active: request.activeClaims, max: request.maxClaims })}
          </span>
          <SlotBars filled={request.activeClaims} total={request.maxClaims} />
        </div>
      </div>

      <Button
        variant="walnut"
        size="xl"
        className="h-[52px] w-full"
        onClick={() => {
          claim.reset();
          setConfirmOpen(true);
        }}
        disabled={claim.isPending || full || insufficient}
      >
        {claim.isPending ? t('claiming') : full ? t('full') : t('claimPanel.cta')}
      </Button>

      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('claimConfirmTitle', { title: request.title })}
        confirmLabel={t('claimConfirmCta')}
        cancelLabel={t('claimConfirmCancel')}
        pendingLabel={t('claiming')}
        pending={claim.isPending}
        error={apiErrText}
        confirmDisabled={full || insufficient}
        onConfirm={() =>
          claim.mutate(
            { requestId: request.id },
            // dupa preluare aterizezi direct in fisa de lucru (PO r6):
            // acolo atribui cererea unui angajat si vezi contactul clientului
            {
              onSuccess: (slot) => {
                setConfirmOpen(false);
                router.push(`/marketplace/claims/${slot.id}`);
              },
            },
          )
        }
      >
        {request.creditCost != null && (
          <p className="font-medium">
            {wallet.data
              ? t('claimConfirmCost', {
                  credits: tu('credit', { n: request.creditCost }),
                  after: tu('credit', { n: wallet.data.available - request.creditCost }),
                })
              : t('claimConfirmCostNoWallet', { credits: tu('credit', { n: request.creditCost }) })}
          </p>
        )}
        {rules && (
          <p>
            {t('claimConfirmGrace', {
              minutes: tu('minute', { n: rules.withdrawals.voluntaryGraceMinutes }),
              points: tu('point', { n: rules.penalties.points.VOLUNTARY_WITHDRAWAL }),
            })}
          </p>
        )}
        <p>{t('claimConfirmPayToPlay')}</p>
        <p className="text-xs text-muted-foreground">{t.rich('claimRulesNote', { rules: firmRulesChunk('sla') })}</p>
      </ActionConfirmDialog>

      {/* credite insuficiente: pasul urmator e portofelul, nu butonul de preluare */}
      {insufficient && !apiErr && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-crimson">{t('apiErrors.INSUFFICIENT_CREDITS')}</p>
          <Button asChild variant="outline" size="lg">
            <Link href="/marketplace/wallet">{t('buyCredits')}</Link>
          </Button>
        </div>
      )}
      {apiErrText && !confirmOpen && (
        <p role="alert" className="text-sm text-crimson">
          {apiErrText}
        </p>
      )}
      {claim.isSuccess && <p className="text-sm text-sage">{t('claimSuccess')}</p>}

      {/* E-company-9: ce se intampla cu creditele, pe trei randuri (cost, termen, ce urmeaza),
          fara numere fixe: minutele de retragere gratuita vin din regulile in vigoare */}
      <ul className="flex flex-col gap-2.5 border-t border-border pt-4 text-ui">
        <RuleRow tone="ok">
          {t.rich('claimPanel.ruleReserve', {
            b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
          })}
          {rules && (
            <>
              {' '}
              {t('claimPanel.ruleGrace', {
                minutes: tu('minute', { n: rules.withdrawals.voluntaryGraceMinutes }),
              })}
            </>
          )}
        </RuleRow>
        <RuleRow tone="warn">{t('claimPanel.ruleSla')}</RuleRow>
        <RuleRow tone="warn">{t('claimConfirmPayToPlay')}</RuleRow>
      </ul>
      <FirmRulesLink
        anchor="sla"
        className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-medium text-walnut hover:text-walnut-deep hover:underline"
      >
        {t('claimPanel.rulesLink')}
        <ArrowRight className="size-3.5" aria-hidden />
      </FirmRulesLink>
    </Card>
  );
}
