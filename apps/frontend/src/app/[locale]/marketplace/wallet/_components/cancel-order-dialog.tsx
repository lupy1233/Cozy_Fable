'use client';

import type { BillingOrderDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useMoney } from '@/hooks/use-money';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { shortRef } from './order-ref';

// h3 (etapa 9): confirmarea "Anuleaza comanda" (comanda in asteptare, nemarcata "Am platit").
export function CancelOrderDialog({
  order,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  order: BillingOrderDto | null;
  /** anularea e in curs: dialogul nu se inchide */
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (order: BillingOrderDto) => void;
}) {
  const tb = useTranslations('Billing');
  const money = useMoney();

  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tb('cancelOrder.title')}</DialogTitle>
          <DialogDescription>
            {order
              ? tb('cancelOrder.body', {
                  what:
                    order.orderType === 'SUBSCRIPTION'
                      ? tb('planLabel', { tier: order.planTier ?? '' })
                      : tb('packageLabel', { n: order.credits ?? 0 }),
                  total: money(order.totalRon),
                  ref: shortRef(order.id),
                })
              : ''}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{tb('cancelOrder.note')}</p>
        {error && (
          <Alert tone="crimson" role="alert" className="mt-3">
            {error}
          </Alert>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onClose}>
            {tb('cancelOrder.keep')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={busy || !order}
            aria-busy={busy}
            onClick={() => order && onConfirm(order)}
          >
            {tb('cancelOrder.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
