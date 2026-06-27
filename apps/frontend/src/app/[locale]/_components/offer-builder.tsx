'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { useCreateQuote, useExtraVersion, useReoffer, useReviseQuote } from '@/hooks/use-quotes';

const formSchema = z.object({
  price: z.coerce.number().positive(),
  designFee: z.coerce.number().positive().optional(),
  currency: z.enum(['RON', 'EUR']).optional(),
  deliveryTerm: z.string().optional(),
  deliveryDate: z.string().optional(),
  warranty: z.string().optional(),
  description: z.string().min(1),
  validityDays: z.coerce.number().int().positive().optional(),
});
type FormValues = z.input<typeof formSchema>;

type Props =
  | { kind: 'create'; claimSlotId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'revise'; quoteId: string; changeRequestId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'extra'; quoteId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'reoffer'; quoteId: string; includesPaidDesign: boolean; onDone?: () => void };

export function OfferBuilder(props: Props) {
  const t = useTranslations('Quotes');
  const quoteId = props.kind === 'create' ? '' : props.quoteId;
  const create = useCreateQuote();
  const revise = useReviseQuote(quoteId);
  const extra = useExtraVersion(quoteId);
  const reoffer = useReoffer(quoteId);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const active =
    props.kind === 'create' ? create : props.kind === 'revise' ? revise : props.kind === 'extra' ? extra : reoffer;
  const apiErr = active.error instanceof ApiError ? active.error.code : null;

  const onSubmit = (v: FormValues) => {
    const base = {
      price: Number(v.price),
      designFee: v.designFee ? Number(v.designFee) : undefined,
      deliveryTerm: v.deliveryTerm || undefined,
      deliveryDate: v.deliveryDate || undefined,
      warranty: v.warranty || undefined,
      description: v.description,
      validityDays: v.validityDays ? Number(v.validityDays) : undefined,
    };
    if (props.kind === 'create') {
      create.mutate(
        { ...base, claimSlotId: props.claimSlotId, currency: v.currency },
        { onSuccess: () => props.onDone?.() },
      );
    } else if (props.kind === 'revise') {
      revise.mutate({ ...base, changeRequestId: props.changeRequestId }, { onSuccess: () => props.onDone?.() });
    } else if (props.kind === 'extra') {
      extra.mutate({ ...base }, { onSuccess: () => props.onDone?.() });
    } else {
      reoffer.mutate({ ...base }, { onSuccess: () => props.onDone?.() });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="font-serif text-lg">
        {props.kind === 'create'
          ? t('builder.createTitle')
          : props.kind === 'revise'
            ? t('builder.reviseTitle')
            : props.kind === 'extra'
              ? t('builder.extraTitle')
              : t('builder.reofferTitle')}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('builder.price')} error={errors.price && t('validation.priceInvalid')}>
          <input type="number" step="0.01" {...register('price')} className="input" />
        </Field>
        {props.kind === 'create' && (
          <Field label={t('builder.currency')}>
            <select {...register('currency')} className="input" defaultValue="RON">
              <option value="RON">RON</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
        )}
        {props.includesPaidDesign && (
          <Field label={t('builder.designFee')}>
            <input type="number" step="0.01" {...register('designFee')} className="input" />
          </Field>
        )}
        <Field label={t('builder.deliveryTerm')}>
          <input {...register('deliveryTerm')} className="input" />
        </Field>
        <Field label={t('builder.deliveryDate')}>
          <input type="date" {...register('deliveryDate')} className="input" />
        </Field>
        <Field label={t('builder.warranty')}>
          <input {...register('warranty')} className="input" />
        </Field>
        <Field label={t('builder.validityDays')}>
          <input type="number" {...register('validityDays')} placeholder="14" className="input" />
        </Field>
      </div>

      <Field label={t('builder.description')} error={errors.description && t('validation.descriptionRequired')}>
        <textarea {...register('description')} rows={3} className="input" />
      </Field>

      {apiErr && (
        <p className="text-sm text-crimson">
          {t.has(`apiErrors.${apiErr}`) ? t(`apiErrors.${apiErr}`) : t('apiErrors.INTERNAL_ERROR')}
        </p>
      )}

      <button
        type="submit"
        disabled={active.isPending}
        className="self-start rounded-md bg-walnut px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-110 disabled:opacity-50"
      >
        {t('builder.submit')}
      </button>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid hsl(var(--border-2));
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        :global(.input:focus-visible) {
          outline: none;
          border-color: hsl(var(--foreground));
        }
      `}</style>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-xs text-crimson">{error}</span>}
    </label>
  );
}
