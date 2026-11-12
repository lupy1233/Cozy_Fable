'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { useMe } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { SkeletonPage } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { AccountingCards } from './_components/accounting-cards';
import { GrantZone } from './_components/grant-zone';
import { OrdersZone, type OrderStatusFilter } from './_components/orders-zone';
import { SubscriptionsZone } from './_components/subscriptions-zone';

// Cele patru zone ale paginii (design 2026-11): in loc de o pagina lunga, fiecare treaba are locul ei.
const ZONES = ['orders', 'subscriptions', 'grant', 'export'] as const;
type Zone = (typeof ZONES)[number];
const PANEL_ID = 'admin-payments-zone';

const isZone = (value: string): value is Zone => (ZONES as readonly string[]).includes(value);

// Plati + abonamente (consola admin). Platile Stripe se confirma automat prin webhook;
// confirmarea manuala e DOAR pentru transfer bancar (comenzi PENDING fara sesiune Stripe).
export default function AdminPaymentsPage() {
  const t = useTranslations('AdminPayments');
  const router = useRouter();
  const me = useMe();
  const [zone, setZone] = useState<Zone>('orders');
  // filtrele zonei „Comenzi” stau aici ca rezumatul e-Factura sa poata deschide lista „de raportat”
  const [status, setStatus] = useState<OrderStatusFilter>('PENDING');
  const [eInvoiceOnly, setEInvoiceOnly] = useState(false);

  useEffect(() => {
    if (me.isError) router.replace('/login');
    else if (me.data && me.data.role !== 'ADMIN') router.replace('/dashboard');
  }, [me.isError, me.data, router]);

  // zona curenta se tine si in #hash (link direct, ex. /admin/payments#subscriptions)
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      if (isZone(hash)) setZone(hash);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  if (me.isPending) return <SkeletonPage variant="table" />;

  const changeZone = (next: Zone) => {
    setZone(next);
    window.history.replaceState(null, '', `#${next}`);
  };
  // „De raportat” din rezumatul e-Factura → comenzile platite, filtrate, cu tabelul adus in vedere
  const showToReport = () => {
    setStatus('CONFIRMED');
    setEInvoiceOnly(true);
    changeZone('orders');
    requestAnimationFrame(() => document.getElementById(PANEL_ID)?.scrollIntoView({ block: 'start' }));
  };

  return (
    <div className="flex w-full max-w-[1180px] flex-col gap-6">
      <PageHeader title={t('title')} subtitle={<span className="block max-w-3xl text-lead">{t('stripeNote')}</span>} />

      <Tabs
        panelId={PANEL_ID}
        label={t('zones.label')}
        className="mb-0 flex-wrap border-border-2"
        current={zone}
        onChange={(v) => {
          if (isZone(v)) changeZone(v);
        }}
        tabs={ZONES.map((z) => ({ value: z, label: t(`zones.${z}`) }))}
      />

      <div
        id={PANEL_ID}
        role="tabpanel"
        aria-labelledby={`${PANEL_ID}-tab-${zone}`}
        tabIndex={0}
        className="flex scroll-mt-24 flex-col gap-6"
      >
        {zone === 'orders' && (
          <>
            <OrdersZone
              status={status}
              onStatusChange={setStatus}
              eInvoiceOnly={eInvoiceOnly}
              onEInvoiceOnlyChange={setEInvoiceOnly}
            />
            <AccountingCards onShowToReport={showToReport} />
          </>
        )}
        {zone === 'subscriptions' && <SubscriptionsZone />}
        {zone === 'grant' && <GrantZone />}
        {zone === 'export' && <AccountingCards onShowToReport={showToReport} />}
      </div>
    </div>
  );
}
