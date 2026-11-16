import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { BillingOrderDto } from '@marketplace/shared';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../../../../messages/ro.json';
import { CancelOrderDialog } from './cancel-order-dialog';
import { OrdersSection } from './orders-section';

// h3 (etapa 9): „Anulează plata” — buton doar pe plata în așteptare nemarcată „Am plătit”,
// cu dialog de confirmare în aplicație; termenul anulării automate lângă sumă.

const order = (over: Partial<BillingOrderDto> = {}): BillingOrderDto => ({
  id: 'abcdef12-3456-4789-8abc-def012345678', orderType: 'CREDIT_PACKAGE', status: 'PENDING', planTier: null,
  credits: 100, baseAmountRon: 100, vatRate: 21, vatAmountRon: 21, totalRon: 121, invoiceSeries: null,
  invoiceNumber: null, invoiceLabel: null, paymentSource: null, hasStripeSession: false,
  createdAt: '2026-11-14T10:00:00.000Z', confirmedAt: null, testMode: false, paymentClaimedAt: null,
  transferExpiresAt: null, ...over,
});

const wrap = (ui: React.ReactNode) => (
  <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
    {ui}
  </NextIntlClientProvider>
);

function showOrders(orders: BillingOrderDto[]) {
  const onCancelOrder = vi.fn();
  render(
    wrap(
      <OrdersSection
        pending={false}
        loaded
        orders={orders}
        stripeEnabled={false}
        billingReady
        checkoutPending={false}
        checkoutError={null}
        downloadingId={null}
        onContinuePayment={vi.fn()}
        onShowBankDetails={vi.fn()}
        onDownloadInvoice={vi.fn()}
        onCancelOrder={onCancelOrder}
      />,
    ),
  );
  return { onCancelOrder };
}

describe('OrdersSection — „Anulează plata” și termenul', () => {
  it('în așteptare, nemarcată → butonul deschide confirmarea; apare „valabilă până”', () => {
    const o = order({ transferExpiresAt: '2026-11-21T10:00:00.000Z' });
    const { onCancelOrder } = showOrders([o]);
    fireEvent.click(screen.getByRole('button', { name: ro.Billing.cancelOrder.action }));
    expect(onCancelOrder).toHaveBeenCalledWith(o);
    expect(screen.getByText(/Valabilă până pe .*12:00/)).toBeInTheDocument();
  });

  it('marcată „Am plătit”, plătită sau anulată → fără buton; fără termen când anularea automată e oprită', () => {
    showOrders([
      order({ id: 'a1', paymentClaimedAt: '2026-11-14T11:00:00.000Z' }),
      order({ id: 'a2', status: 'CONFIRMED', invoiceLabel: 'MM-1' }),
      order({ id: 'a3', status: 'CANCELLED' }),
    ]);
    expect(screen.queryByRole('button', { name: ro.Billing.cancelOrder.action })).not.toBeInTheDocument();
    expect(screen.queryByText(/Valabilă până pe/)).not.toBeInTheDocument();
  });
});

describe('CancelOrderDialog', () => {
  it('arată plata și trimite confirmarea; „Nu” închide fără anulare', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const o = order();
    render(wrap(<CancelOrderDialog order={o} busy={false} error={null} onClose={onClose} onConfirm={onConfirm} />));
    expect(screen.getByRole('dialog')).toHaveTextContent('121,00 lei · referința #ABCDEF12');
    fireEvent.click(screen.getByRole('button', { name: ro.Billing.cancelOrder.keep }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: ro.Billing.cancelOrder.confirm }));
    expect(onConfirm).toHaveBeenCalledWith(o);
  });

  it('cât se anulează, butoanele sunt oprite; eroarea serverului apare în dialog', () => {
    render(
      wrap(
        <CancelOrderDialog
          order={order()}
          busy
          error={ro.Billing.apiErrors.PAYMENT_REPORTED_PAID}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      ),
    );
    expect(screen.getByRole('button', { name: ro.Billing.cancelOrder.confirm })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(ro.Billing.apiErrors.PAYMENT_REPORTED_PAID);
  });

  it('fără plată aleasă → dialogul e închis', () => {
    render(wrap(<CancelOrderDialog order={null} busy={false} error={null} onClose={vi.fn()} onConfirm={vi.fn()} />));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
