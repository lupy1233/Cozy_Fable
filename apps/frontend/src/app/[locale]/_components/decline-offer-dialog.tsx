'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';
import {
  MAX_QUOTE_DECLINE_NOTE_LENGTH,
  QUOTE_DECLINE_REASONS,
  type QuoteDeclineReason,
  type QuoteDto,
} from '@marketplace/shared';
import { useDeclineQuote, useRefreshQuotes } from '@/hooks/use-quotes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// a4 (etapa 4, raspunsurile PO a4-1 / a4-2): clientul refuza definitiv o oferta. Un singur clic
// nu refuza — dialogul spune consecintele (definitiv, firma e anuntata) si cere confirmarea
// explicita; motivul (lista scurta) si textul liber sunt optionale, iar firma le vede.

const NOTE_MAX = MAX_QUOTE_DECLINE_NOTE_LENGTH;

export function DeclineOfferDialog({
  quote,
  open,
  onOpenChange,
  onDeclined,
}: {
  quote: QuoteDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // dupa un refuz reusit (cardul muta focusul pe anuntul de refuz)
  onDeclined?: () => void;
}) {
  const t = useTranslations('Quotes');
  const decline = useDeclineQuote();
  const refreshQuotes = useRefreshQuotes();
  const [reason, setReason] = useState<QuoteDeclineReason | null>(null);
  const [note, setNote] = useState('');
  const uid = useId();
  const { reset } = decline;

  // fiecare deschidere porneste curat (fara motivul sau eroarea de data trecuta)
  useEffect(() => {
    if (!open) return;
    setReason(null);
    setNote('');
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errorText =
    decline.error instanceof ApiError
      ? t.has(`apiErrors.${decline.error.code}`)
        ? t(`apiErrors.${decline.error.code}`)
        : t('apiErrors.INTERNAL_ERROR')
      : decline.error
        ? t('apiErrors.INTERNAL_ERROR')
        : null;
  const trimmed = note.trim();
  // m11: oferta nu mai poate fi refuzata (s-a schimbat intre timp sau i-a trecut valabilitatea) —
  // dialogul ramane deschis cu explicatia, fara o noua incercare; oferta se reimprospateaza la inchidere
  const errorCode = decline.error instanceof ApiError ? decline.error.code : null;
  const finalError = errorCode === 'QUOTE_NOT_DECLINABLE' || errorCode === 'QUOTE_EXPIRED';
  const close = () => {
    if (decline.isPending) return;
    onOpenChange(false);
    if (decline.error) refreshQuotes();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('decline.title', { company: quote.companyName })}</DialogTitle>
          <DialogDescription>{t('decline.body', { company: quote.companyName })}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 font-medium">{t('decline.reasonLabel')}</legend>
            {QUOTE_DECLINE_REASONS.map((r) => (
              <label key={r} className="flex min-h-9 cursor-pointer items-center gap-2.5">
                <input
                  type="radio"
                  name={`${uid}-reason`}
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-walnut"
                />
                {t(`declineReasons.${r}`)}
              </label>
            ))}
            {reason && (
              <button
                type="button"
                onClick={() => setReason(null)}
                className="self-start text-xs text-walnut hover:underline"
              >
                {t('decline.clearReason')}
              </button>
            )}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-note`} className="font-medium">
              {t('decline.noteLabel')}
            </label>
            <Textarea
              id={`${uid}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              rows={3}
              aria-describedby={`${uid}-note-hint`}
            />
            <p id={`${uid}-note-hint`} className="text-xs text-muted-foreground">
              {t('decline.noteHint', { used: note.length, max: NOTE_MAX })}
            </p>
          </div>

          {errorText && (
            <p role="alert" className="text-crimson">
              {errorText}
            </p>
          )}
        </div>

        <DialogFooter className="flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={close}
            disabled={decline.isPending}
          >
            {t('decline.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={decline.isPending || finalError}
            onClick={() =>
              decline.mutate(
                { quoteId: quote.id, reason: reason ?? undefined, note: trimmed || undefined },
                {
                  onSuccess: () => {
                    onOpenChange(false);
                    onDeclined?.();
                  },
                },
              )
            }
          >
            {decline.isPending ? t('decline.pending') : t('decline.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
