'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Link, useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { useClaimContext } from '@/hooks/use-quotes';
import { useMarkDelivered } from '@/hooks/use-fulfillment';
import { useRealtimeSync } from '@/hooks/use-socket';
import { ChatPanel } from '../../../_components/chat-panel';
import { ClaimLifecyclePanel } from '../../../_components/claim-lifecycle-panel';
import { OfferBuilder } from '../../../_components/offer-builder';
import { OfferCard } from '../../../_components/offer-card';
import { Button } from '@/components/ui/button';

export default function CompanyClaimPage() {
  const t = useTranslations('Quotes');
  const params = useParams<{ claimSlotId: string }>();
  const claimSlotId = params.claimSlotId;
  const router = useRouter();
  const me = useMe();
  const ctx = useClaimContext(claimSlotId);
  useRealtimeSync();

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'COMPANY_USER') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  if (ctx.isPending) {
    return <p className="py-20 text-center text-muted-foreground">{t('loading')}</p>;
  }
  if (ctx.isError || !ctx.data) {
    return <p className="py-20 text-center text-muted-foreground">{t('notFound')}</p>;
  }

  const c = ctx.data;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href="/marketplace/wallet" className="text-sm text-walnut hover:underline">
        ← {t('backToClaims')}
      </Link>
      <h1 className="page-title">{c.requestTitle}</h1>

      <ClaimLifecyclePanel ctx={c} />

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl">{t('offerSection')}</h2>
        {c.quote ? (
          <OfferCard quote={c.quote} mode="company" includesPaidDesign={c.includesPaidDesign} rooms={c.rooms} />
        ) : (
          <OfferBuilder kind="create" claimSlotId={c.claimSlotId} includesPaidDesign={c.includesPaidDesign} rooms={c.rooms} />
        )}
        {c.quote?.status === 'ACCEPTED' && <DeliverButton requestId={c.requestId} />}
      </section>

      {c.threadId && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-xl">{t('chatSection')}</h2>
          <ChatPanel threadId={c.threadId} mode="company" />
        </section>
      )}
    </div>
  );
}

function DeliverButton({ requestId }: { requestId: string }) {
  const t = useTranslations('Fulfillment');
  const deliver = useMarkDelivered();
  return (
    <Button
      variant="walnut"
      className="self-start"
      onClick={() => deliver.mutate(requestId)}
      disabled={deliver.isPending || deliver.isSuccess}
    >
      {deliver.isSuccess ? t('markedDelivered') : t('markDelivered')}
    </Button>
  );
}
