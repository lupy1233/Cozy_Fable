'use client';

import type { AdminBillingOrderItemDto } from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useUpdateEInvoice } from '@/hooks/use-billing';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toaster';
import { usePaymentErrorText } from './use-payment-error-text';

const EDITABLE_E_INVOICE = ['PENDING', 'UPLOADED', 'VALIDATED', 'REJECTED'] as const;
type EditableEInvoice = (typeof EDITABLE_E_INVOICE)[number];

// Actualizare stare e-Factura: ce a facut contabilul in SPV (index incarcare / descarcare).
export function EInvoiceDialog({ order, onClose }: { order: AdminBillingOrderItemDto; onClose: () => void }) {
  const t = useTranslations('AdminPayments');
  const errorText = usePaymentErrorText();
  const update = useUpdateEInvoice();
  const initial = (EDITABLE_E_INVOICE as readonly string[]).includes(order.eInvoiceStatus ?? '')
    ? (order.eInvoiceStatus as EditableEInvoice)
    : 'PENDING';
  const [status, setStatus] = useState<EditableEInvoice>(initial);
  const [uploadId, setUploadId] = useState(order.anafUploadId ?? '');
  const [downloadId, setDownloadId] = useState(order.anafDownloadId ?? '');
  const needsUpload = status === 'UPLOADED' || status === 'VALIDATED';
  const digits = (v: string) => v === '' || /^\d{1,20}$/.test(v);
  const canSave = !update.isPending && digits(uploadId) && digits(downloadId) && (!needsUpload || uploadId !== '');

  const save = () => {
    if (!canSave) return;
    update.mutate(
      {
        orderId: order.id,
        status,
        anafUploadId: uploadId || undefined,
        anafDownloadId: downloadId || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('eInvoice.updated'));
          onClose();
        },
        onError: (err) => toast.error(errorText(err)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !update.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('eInvoice.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {order.companyName} · {order.invoiceLabel}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label={t('col.eInvoice')}>
            <Select value={status} onChange={(e) => setStatus(e.target.value as EditableEInvoice)}>
              {EDITABLE_E_INVOICE.map((s) => (
                <option key={s} value={s}>
                  {t(`eInvoice.status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('eInvoice.uploadId')}>
            <Input
              inputMode="numeric"
              maxLength={20}
              className="font-mono"
              value={uploadId}
              onChange={(e) => setUploadId(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label={t('eInvoice.downloadId')}>
            <Input
              inputMode="numeric"
              maxLength={20}
              className="font-mono"
              value={downloadId}
              onChange={(e) => setDownloadId(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={update.isPending} onClick={onClose}>
            {t('no')}
          </Button>
          <Button variant="walnut" disabled={!canSave} onClick={save}>
            {t('eInvoice.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
