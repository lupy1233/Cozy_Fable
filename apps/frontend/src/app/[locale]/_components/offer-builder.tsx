'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  createQuoteSchema,
  MAX_DELIVERY_TERM_VALUE,
  MAX_DESIGN_INCLUDES_LENGTH,
  MAX_QUOTE_VERSIONS,
  MAX_WARRANTY_MONTHS,
  QUOTE_DELIVERY_TERM_UNITS as DELIVERY_TERM_UNITS,
  QUOTE_VAT_MODES as VAT_MODES,
  type OfferFieldKey,
  type QuoteVersionDto,
} from '@marketplace/shared';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { forwardRef, useId, useMemo, useState, type InputHTMLAttributes } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { formatDecimal, parseDecimal } from '@/lib/decimal';
import { APP_TIME_ZONE } from '@/lib/sla-deadline';
import { cn } from '@/lib/utils';
import { useCreateQuote, useExtraVersion, useReoffer, useReviseQuote } from '@/hooks/use-quotes';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// m8 (revizuire etapa 4): aceleasi plafoane ca serverul, citite din schema comuna (shared),
// ca formularul sa spuna campul inainte de "Datele trimise nu sunt valide".
const MAX_PRICE = createQuoteSchema.shape.price.maxValue ?? 100_000_000;
const MAX_DESIGN_FEE = createQuoteSchema.shape.designFee.unwrap().maxValue ?? MAX_PRICE;
const MAX_VALIDITY_DAYS = createQuoteSchema.shape.validityDays.unwrap().maxValue ?? 365;

// Numerele vin din inputuri ca '' cand sunt goale; z.coerce le facea 0 → pica positive()
// FARA mesaj afisat si formularul nu se trimitea deloc (bug F7: "firma nu poate raspunde").
// Golul devine explicit undefined.
const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : Number(v));
// m12: sumele accepta virgula si punctul ("12,5" = 12.5), cu cititorul comun (lib/decimal);
// textul nevalid devine NaN → pica schema cu mesajul aplicatiei (nu ramane o valoare veche)
export function parseAmount(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (v == null) return undefined;
  const p = parseDecimal(String(v));
  return p.kind === 'empty' ? undefined : p.kind === 'number' ? p.value : Number.NaN;
}
// variantele obligatorii au functia lor, ca tipul sa ramana `number` (nu `number | undefined`)
const requiredAmount = (max: number) => z.preprocess(parseAmount, z.number().positive().max(max));
const optionalAmount = (max: number) =>
  z.preprocess(parseAmount, z.number().positive().max(max).optional());
const requiredWhole = (max: number) =>
  z.preprocess(emptyToUndefined, z.number().int().positive().max(max));
const optionalWhole = (max: number) =>
  z.preprocess(emptyToUndefined, z.number().int().positive().max(max).optional());

// a3 (etapa 4): termenul (numar + unitate), garantia in luni, rubrica de TVA si bifele
// "inclus in pret" pleaca SEPARAT spre API si sunt obligatorii; textele libere
// deliveryTerm / warranty nu se mai trimit (serverul le completeaza din rubrici).
// g0-11: la cererile cu proiectare cu plata, pretul proiectarii si "ce include" sunt obligatorii.
function buildSchema(paidDesign: boolean) {
  return z.object({
    price: requiredAmount(MAX_PRICE),
    designFee: paidDesign ? requiredAmount(MAX_DESIGN_FEE) : optionalAmount(MAX_DESIGN_FEE),
    designIncludes: paidDesign
      ? z.string().trim().min(1).max(MAX_DESIGN_INCLUDES_LENGTH)
      : z.string().optional(),
    currency: z.enum(['RON', 'EUR']),
    vatMode: z.enum(VAT_MODES),
    deliveryTermValue: requiredWhole(MAX_DELIVERY_TERM_VALUE),
    deliveryTermUnit: z.enum(DELIVERY_TERM_UNITS),
    deliveryDate: z.string().optional(),
    warrantyMonths: requiredWhole(MAX_WARRANTY_MONTHS),
    includesTransport: z.boolean(),
    includesAssembly: z.boolean(),
    description: z.string().trim().min(1),
    validityDays: optionalWhole(MAX_VALIDITY_DAYS),
  });
}

// M1: cheile matricei de permisiuni (details.fields din OFFER_FIELD_NOT_EDITABLE) → eticheta campului
const FIELD_KEY_LABEL: Record<OfferFieldKey, string> = {
  PRICE: 'builder.fieldKey.PRICE',
  DELIVERY_TERM: 'builder.deliveryTerm',
  DELIVERY_DATE: 'builder.deliveryDate',
  WARRANTY: 'builder.warranty',
  DESCRIPTION: 'builder.description',
};
type FormValues = z.input<ReturnType<typeof buildSchema>>;

// camerele cererii, pentru defalcarea pretului (F7, item 22)
type OfferRoom = { id: string; roomType: string };
type OfferCurrency = 'RON' | 'EUR';

type Props = (
  | { kind: 'create'; claimSlotId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'revise'; quoteId: string; changeRequestId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'extra'; quoteId: string; includesPaidDesign: boolean; onDone?: () => void }
  | { kind: 'reoffer'; quoteId: string; includesPaidDesign: boolean; onDone?: () => void }
) & {
  rooms?: OfferRoom[];
  // moneda ofertei existente — alegerea implicita cand nu exista o varianta precedenta
  currency?: OfferCurrency;
  // a4: ultima varianta trimisa; varianta noua porneste precompletata din ea
  previous?: QuoteVersionDto;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// data livrarii din varianta precedenta se pastreaza doar daca nu a trecut
function futureDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(new Date());
  return iso.slice(0, 10) >= today ? iso.slice(0, 10) : '';
}

// a4: valorile de pornire ale variantei noi = ultima varianta (rubricile lipsa raman goale)
function defaultsFrom(
  previous: QuoteVersionDto | undefined,
  currency: OfferCurrency | undefined,
  locale: string,
): FormValues {
  const p = previous;
  // sumele se scriu in formatul limbii ("1250,5" in romana), ca sa poata fi recitite de parseDecimal
  const money = (n: number | null | undefined) => (n == null ? '' : formatDecimal(n, locale, 2));
  return {
    price: money(p?.price),
    designFee: money(p?.designFee),
    designIncludes: p?.designIncludes ?? '',
    currency: p?.currency ?? currency ?? 'RON',
    vatMode: p?.vatMode ?? undefined,
    deliveryTermValue: p?.deliveryTermValue ?? '',
    deliveryTermUnit: p?.deliveryTermUnit ?? 'WEEKS',
    deliveryDate: futureDate(p?.deliveryDate),
    warrantyMonths: p?.warrantyMonths ?? '',
    includesTransport: p?.includesTransport ?? false,
    includesAssembly: p?.includesAssembly ?? false,
    description: p?.description ?? '',
    validityDays: '',
  } as FormValues;
}

export function OfferBuilder(props: Props) {
  const t = useTranslations('Quotes');
  const tc = useTranslations('Configurator');
  const format = useFormatter();
  const locale = useLocale();
  const uid = useId();
  const isCreate = props.kind === 'create';
  const paidDesign = props.includesPaidDesign;
  const quoteId = props.kind === 'create' ? '' : props.quoteId;
  const create = useCreateQuote();
  const revise = useReviseQuote(quoteId);
  const extra = useExtraVersion(quoteId);
  const reoffer = useReoffer(quoteId);
  const schema = useMemo(() => buildSchema(paidDesign), [paidDesign]);
  // m10: varianta din care s-a completat formularul se fixeaza la deschidere (eticheta si
  // valorile vin din aceeasi varianta, chiar daca oferta se reimprospateaza intre timp)
  const [previous] = useState(props.previous);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFrom(previous, props.currency, locale),
  });
  const pickedCurrency = useWatch({ control, name: 'currency' });
  const validityRaw = useWatch({ control, name: 'validityDays' });

  // unitatea de langa sume urmeaza moneda aleasa (moneda e a variantei, nu a ofertei)
  const currency: OfferCurrency = pickedCurrency ?? 'RON';
  const moneyUnit = t(`builder.unit.${currency}`);
  // M2: moneda schimbata fata de varianta precedenta — sumele nu se convertesc singure
  const currencyChanged = !!previous && previous.currency !== currency;
  const [roomErrors, setRoomErrors] = useState<Record<string, boolean>>({});

  // "Valabila pana la ..." — doar cand firma a scris un numar de zile (altfel se aplica implicitul din setari)
  const validityDays = Number(validityRaw);
  const validUntil =
    Number.isInteger(validityDays) && validityDays > 0 && validityDays <= 365
      ? format.dateTime(new Date(Date.now() + validityDays * DAY_MS), {
          dateStyle: 'long',
          timeZone: APP_TIME_ZONE,
        })
      : null;

  // Defalcare pe camere (F7): cand TOATE camerele au pret, totalul se
  // calculeaza singur si campul de pret se blocheaza pe suma.
  const rooms = props.rooms ?? [];
  // a4: defalcarea precedenta se preia doar daca acopera toate camerele (altfel pret unic)
  const [roomPrices, setRoomPrices] = useState<Record<string, string>>(() => {
    const prev = previous?.roomPrices ?? [];
    const covered = rooms.length > 0 && rooms.every((r) => prev.some((rp) => rp.requestRoomId === r.id));
    return covered
      ? Object.fromEntries(prev.map((rp) => [rp.requestRoomId, formatDecimal(rp.price, locale, 2)]))
      : {};
  });
  const roomAmount = (raw: string | undefined) => parseAmount(raw ?? '');
  const positive = (n: number | undefined) => n != null && Number.isFinite(n) && n > 0;
  const filled = rooms.filter((r) => positive(roomAmount(roomPrices[r.id])));
  const allFilled = rooms.length > 0 && filled.length === rooms.length;
  const partial = filled.length > 0 && !allFilled;

  const setRoomPrice = (roomId: string, raw: string) => {
    const next = { ...roomPrices, [roomId]: raw };
    setRoomPrices(next);
    setRoomErrors((e) => ({ ...e, [roomId]: false }));
    const nextFilled = rooms.filter((r) => positive(roomAmount(next[r.id])));
    if (rooms.length > 0 && nextFilled.length === rooms.length) {
      const sum = nextFilled.reduce((acc, r) => acc + roomAmount(next[r.id])!, 0);
      setValue('price', formatDecimal(Math.round(sum * 100) / 100, locale, 2), { shouldValidate: true });
    }
  };

  const active =
    props.kind === 'create' ? create : props.kind === 'revise' ? revise : props.kind === 'extra' ? extra : reoffer;
  const apiError = active.error instanceof ApiError ? active.error : null;
  const apiErr = apiError?.code ?? null;
  // M1: serverul numeste campurile pentru care membrul nu are drept (details.fields)
  const deniedFields =
    apiErr === 'OFFER_FIELD_NOT_EDITABLE'
      ? ((apiError?.details as { fields?: unknown } | undefined)?.fields as string[] | undefined)?.filter(
          (k): k is OfferFieldKey => k in FIELD_KEY_LABEL,
        ) ?? []
      : [];
  const apiErrorText =
    deniedFields.length > 0
      ? t('builder.fieldsNotEditable', {
          fields: deniedFields.map((k) => t(FIELD_KEY_LABEL[k])).join(', '),
        })
      : apiErr
        ? t.has(`apiErrors.${apiErr}`)
          ? t(`apiErrors.${apiErr}`)
          : t('apiErrors.INTERNAL_ERROR')
        : null;

  const onSubmit = (v: FormValues) => {
    if (partial) return; // defalcare incompleta: completeaza tot sau goleste
    // valorile sunt deja validate de schema (numere pozitive, enum-uri)
    const s = schema.parse(v);
    // M2: moneda schimbata, dar o suma a ramas exact cea din varianta precedenta → nu pleaca
    if (previous && s.currency !== previous.currency) {
      let blocked = false;
      const sameRooms = allFilled
        ? rooms.filter((r) => {
            const old = previous.roomPrices.find((rp) => rp.requestRoomId === r.id);
            return old != null && roomAmount(roomPrices[r.id]) === old.price;
          })
        : [];
      if (sameRooms.length > 0) {
        setRoomErrors(Object.fromEntries(sameRooms.map((r) => [r.id, true])));
        blocked = true;
      } else if (!allFilled && s.price === previous.price) {
        setError('price', { type: 'sameAmount' });
        blocked = true;
      }
      if (paidDesign && s.designFee != null && s.designFee === previous.designFee) {
        setError('designFee', { type: 'sameAmount' });
        blocked = true;
      }
      if (blocked) return;
    }
    const base = {
      price: s.price,
      currency: s.currency,
      vatMode: s.vatMode,
      deliveryTermValue: s.deliveryTermValue,
      deliveryTermUnit: s.deliveryTermUnit,
      warrantyMonths: s.warrantyMonths,
      includesTransport: s.includesTransport,
      includesAssembly: s.includesAssembly,
      // proiectarea exista doar pe cererile cu proiectare cu plata (altfel serverul o refuza)
      ...(paidDesign && s.designFee != null
        ? { designFee: s.designFee, designIncludes: (s.designIncludes ?? '').trim() }
        : {}),
      deliveryDate: s.deliveryDate || undefined,
      description: s.description,
      validityDays: s.validityDays,
      roomPrices: allFilled
        ? rooms.map((r) => ({ requestRoomId: r.id, price: roomAmount(roomPrices[r.id])! }))
        : undefined,
    };
    if (props.kind === 'create') {
      create.mutate({ ...base, claimSlotId: props.claimSlotId }, { onSuccess: () => props.onDone?.() });
    } else if (props.kind === 'revise') {
      revise.mutate({ ...base, changeRequestId: props.changeRequestId }, { onSuccess: () => props.onDone?.() });
    } else if (props.kind === 'extra') {
      extra.mutate({ ...base }, { onSuccess: () => props.onDone?.() });
    } else {
      reoffer.mutate({ ...base }, { onSuccess: () => props.onDone?.() });
    }
  };

  const title =
    props.kind === 'create'
      ? t('builder.createTitle')
      : props.kind === 'revise'
        ? t('builder.reviseTitle')
        : props.kind === 'extra'
          ? t('builder.extraTitle')
          : t('builder.reofferTitle');
  // oferta noua = cardul principal al fisei (h2); variantele ulterioare stau in cardul ofertei (h3)
  const TitleTag = isCreate ? 'h2' : 'h3';
  const ids = {
    title: `${uid}-title`,
    price: `${uid}-price`,
    fee: `${uid}-fee`,
    term: `${uid}-term`,
    date: `${uid}-date`,
    warranty: `${uid}-warranty`,
    validity: `${uid}-validity`,
    currency: `${uid}-currency`,
    desc: `${uid}-desc`,
    descHint: `${uid}-desc-hint`,
    vat: `${uid}-vat`,
    included: `${uid}-included`,
    designIncludes: `${uid}-design-includes`,
    designNote: `${uid}-design-note`,
  };

  const sameAmountText = previous
    ? t('validation.sameAmountOtherCurrency', {
        n: previous.version,
        currency: t(`builder.currencyName.${currency}`),
      })
    : '';

  // randul pretului: total calculat din camere (blocat) sau pret unic scris de firma;
  // a3: rubrica de TVA si bifele "inclus in pret" stau langa pret
  const priceRow = (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-2 px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Label htmlFor={ids.price} className="text-sm font-semibold">
          {paidDesign ? t('builder.priceFurnitureEstimate') : t('builder.price')}
        </Label>
        <UnitInput
          id={ids.price}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          {...register('price')}
          readOnly={allFilled}
          title={allFilled ? t('builder.priceLocked') : undefined}
          unit={moneyUnit}
          aria-invalid={errors.price ? true : undefined}
          wrapperClassName="shrink-0"
          className="w-32 flex-none text-right font-mono read-only:cursor-default read-only:font-medium"
        />
      </div>
      {/* M2: moneda schimbata fata de varianta precedenta — sumele raman numerele vechi */}
      {currencyChanged && (
        <p role="status" className="text-xs font-medium text-amber">
          {t('builder.currencyChanged', { currency: t(`builder.currencyName.${currency}`) })}
        </p>
      )}
      {errors.price && (
        <p className="text-xs text-crimson">
          {errors.price.type === 'sameAmount'
            ? sameAmountText
            : t('validation.priceRange', { max: format.number(MAX_PRICE) })}
        </p>
      )}
      {partial && <p className="text-xs text-amber">{t('builder.roomPricesPartial')}</p>}

      <fieldset
        className="flex min-w-0 flex-col gap-1.5"
        aria-describedby={errors.vatMode ? `${ids.vat}-error` : undefined}
      >
        <legend className="mb-1.5 text-sm font-medium">{t('builder.vat.label')}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {VAT_MODES.map((mode) => (
            <label key={mode} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
              <input type="radio" value={mode} className="accent-walnut" {...register('vatMode')} />
              {t(`builder.vat.${mode}`)}
            </label>
          ))}
        </div>
        {errors.vatMode && (
          <p id={`${ids.vat}-error`} className="text-xs text-crimson">
            {t('validation.vatRequired')}
          </p>
        )}
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">{t('builder.included.label')}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="accent-walnut" {...register('includesTransport')} />
            {t('builder.included.transport')}
          </label>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="accent-walnut" {...register('includesAssembly')} />
            {t('builder.included.assembly')}
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t('builder.included.hint')}</p>
      </fieldset>
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      // m12: validarea o face schema, cu mesajele aplicatiei (nu baloanele browserului)
      noValidate
      aria-labelledby={ids.title}
      className={cn(
        'flex flex-col',
        isCreate
          ? 'gap-6 rounded-xl border border-border bg-surface p-5 shadow sm:p-7'
          : 'gap-5 rounded-lg border border-border-2 bg-surface p-4',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <TitleTag id={ids.title} className={isCreate ? 'font-serif text-2xl' : 'heading-card'}>
          {title}
        </TitleTag>
        {isCreate && (
          <span className="text-ui text-muted-foreground">
            {t('builder.versionOf', { n: 1, max: MAX_QUOTE_VERSIONS })}
          </span>
        )}
        {previous && (
          <p className="w-full text-ui text-muted-foreground">
            {t('builder.prefilledFrom', { n: previous.version })}
          </p>
        )}
      </div>

      {/* pret per camera (F7, item 22): total calculat automat */}
      {rooms.length > 0 ? (
        <fieldset className="flex min-w-0 flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-semibold">{t('builder.roomPrices')}</legend>
          {rooms.map((r, i) => {
            const roomId = `${uid}-room-${r.id}`;
            const raw = roomPrices[r.id] ?? '';
            const invalid = raw.trim() !== '' && !positive(roomAmount(raw));
            return (
              <div key={r.id} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <label htmlFor={roomId} className="min-w-0 flex-[1_1_200px] text-sm">
                    {i + 1}. {tc(`rooms.type.${r.roomType}`)}
                  </label>
                  <UnitInput
                    id={roomId}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={raw}
                    onChange={(e) => setRoomPrice(r.id, e.target.value)}
                    placeholder="0"
                    unit={moneyUnit}
                    aria-invalid={invalid || roomErrors[r.id] ? true : undefined}
                    wrapperClassName="shrink-0"
                    className="w-32 flex-none text-right font-mono"
                  />
                </div>
                {invalid && <p className="text-xs text-crimson">{t('validation.amountInvalid')}</p>}
                {roomErrors[r.id] && <p className="text-xs text-crimson">{sameAmountText}</p>}
              </div>
            );
          })}
          {priceRow}
        </fieldset>
      ) : (
        priceRow
      )}

      {/* g0-11: proiectarea cu plata — pretul si ce include, separat de pretul mobilierului */}
      {paidDesign && (
        <fieldset
          className="flex min-w-0 flex-col gap-3 rounded-lg border border-border-2 px-4 py-3.5"
          aria-describedby={ids.designNote}
        >
          <legend className="px-1 text-sm font-semibold">{t('builder.design.title')}</legend>
          <p id={ids.designNote} className="text-xs text-muted-foreground">
            {t('builder.design.note')}
          </p>
          <Field
            label={t('builder.designFee')}
            htmlFor={ids.fee}
            error={
              errors.designFee
                ? errors.designFee.type === 'sameAmount'
                  ? sameAmountText
                  : t('validation.designFeeRange', { max: format.number(MAX_DESIGN_FEE) })
                : undefined
            }
          >
            <UnitInput
              id={ids.fee}
              type="text"
              autoComplete="off"
              inputMode="decimal"
              {...register('designFee')}
              unit={moneyUnit}
              wrapperClassName="max-w-xs"
            />
          </Field>
          <Field
            label={t('builder.design.includes')}
            htmlFor={ids.designIncludes}
            hint={t('builder.design.includesHint')}
            error={errors.designIncludes ? t('validation.designIncludesRequired') : undefined}
          >
            <Textarea id={ids.designIncludes} rows={3} maxLength={1000} {...register('designIncludes')} />
          </Field>
        </fieldset>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-5">
        <Field
          label={t('builder.deliveryTerm')}
          htmlFor={ids.term}
          error={errors.deliveryTermValue ? t('validation.wholeNumberMax', { max: MAX_DELIVERY_TERM_VALUE }) : undefined}
        >
          <div className="flex gap-2">
            <Input
              id={ids.term}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              {...register('deliveryTermValue')}
              className="h-11 w-20 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <Select aria-label={t('builder.termUnitLabel')} {...register('deliveryTermUnit')} className="h-11">
                {DELIVERY_TERM_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {t(`builder.termUnit.${u}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Field>
        <Field label={t('builder.deliveryDate')} htmlFor={ids.date}>
          <Input id={ids.date} type="date" {...register('deliveryDate')} className="h-11" />
        </Field>
        <Field
          label={t('builder.warranty')}
          htmlFor={ids.warranty}
          error={errors.warrantyMonths ? t('validation.wholeNumberMax', { max: MAX_WARRANTY_MONTHS }) : undefined}
        >
          <UnitInput
            id={ids.warranty}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            {...register('warrantyMonths')}
            unit={t('builder.unitMonths')}
          />
        </Field>
        <Field
          label={t('builder.validity')}
          htmlFor={ids.validity}
          error={errors.validityDays ? t('validation.wholeNumberMax', { max: MAX_VALIDITY_DAYS }) : undefined}
          hint={validUntil ? t('validUntil', { date: validUntil }) : undefined}
        >
          <UnitInput
            id={ids.validity}
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            {...register('validityDays')}
            placeholder="14"
            unit={t('builder.unitDays')}
          />
        </Field>
        {/* a4: moneda e a variantei — se poate schimba la fiecare varianta noua */}
        <Field label={t('builder.currency')} htmlFor={ids.currency}>
          <Select id={ids.currency} {...register('currency')} className="h-11">
            <option value="RON">{t('builder.currencyOption.RON')}</option>
            <option value="EUR">{t('builder.currencyOption.EUR')}</option>
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={ids.desc}>{t('builder.description')}</Label>
        <Textarea id={ids.desc} rows={4} aria-describedby={ids.descHint} {...register('description')} />
        {errors.description && <p className="text-xs text-crimson">{t('validation.descriptionRequired')}</p>}
        <p id={ids.descHint} className="text-xs text-muted-foreground">
          {t('builder.descriptionHint')}
        </p>
      </div>

      {apiErrorText && (
        <p role="alert" className="text-sm text-crimson">
          {apiErrorText}
        </p>
      )}

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-6 gap-y-3',
          isCreate && 'border-t border-border pt-5',
        )}
      >
        {isCreate && <p className="max-w-sm text-ui text-muted-foreground">{t('builder.createNote')}</p>}
        <Button
          type="submit"
          variant={isCreate ? 'walnut' : 'default'}
          size={isCreate ? 'xl' : 'lg'}
          disabled={active.isPending || partial}
        >
          {isCreate ? t('builder.submitCreate') : t('builder.submit')}
        </Button>
      </div>
    </form>
  );
}

// Camp cu unitatea lipita in dreapta (lei, luni, zile). Unitatea e legata de input prin
// aria-describedby, deci numele accesibil al campului ramane eticheta lui.
const UnitInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { unit?: string; wrapperClassName?: string }
>(function UnitInput({ unit, wrapperClassName, className, id, ...props }, ref) {
  const unitId = unit && id ? `${id}-unit` : undefined;
  return (
    <div
      className={cn(
        'flex h-11 items-center rounded-md border border-border-2 bg-surface transition-colors',
        'focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/5',
        'has-[input:read-only]:border-transparent has-[input:read-only]:bg-transparent',
        wrapperClassName,
      )}
    >
      <input
        ref={ref}
        id={id}
        aria-describedby={unitId}
        className={cn(
          'h-10 min-w-0 flex-1 rounded-md bg-transparent px-3 text-sm placeholder:text-muted-2 focus-visible:outline-none',
          className,
        )}
        {...props}
      />
      {unit && (
        <span id={unitId} className="shrink-0 pr-3 text-sm text-muted-foreground">
          {unit}
        </span>
      )}
    </div>
  );
});
