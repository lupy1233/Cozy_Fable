'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CONTACT_CHANNELS,
  DEADLINE_BUCKETS,
  budgetRangeFromRon,
  configuratorContentSchema,
  type DeadlineBucket,
} from '@marketplace/shared';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarClock,
  CalendarRange,
  Infinity as InfinityIcon,
  Lock,
  Plus,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ContactInTextHint } from './contact-in-text-hint';
import { useMe } from '@/hooks/use-auth';
import { useBudgetEstimate } from '@/hooks/use-requests';
import { cn } from '@/lib/utils';
import { draftGenerationId, storageScopeId, useConfiguratorStore, type DetailsValues } from '@/stores/configurator-store';
import { AddressAutocomplete } from './address-autocomplete';
import { BudgetSlider } from './budget-slider';
import { PhoneInput } from './phone-input';
import { anyRoomNeedsDesignHelp, toServerRoom } from './room-payload';

// Tarile oferite la livrare (F5, item 19) — RO implicit; etichetele vin din
// Intl.DisplayNames in limba interfetei.
const COUNTRIES = [
  'RO', 'MD', 'HU', 'BG', 'DE', 'AT', 'FR', 'IT', 'ES', 'BE', 'NL', 'CH',
  'GB', 'IE', 'PL', 'CZ', 'SK', 'GR', 'PT', 'SE', 'DK', 'NO', 'FI',
] as const;

// Pasul de detalii generale (dupa fisiere, inainte de sumar).
// Titlul NU se mai introduce: e generat automat pe server din camere + oras;
// aici aratam doar o previzualizare localizata. Bugetul e slider cu 3 trepte
// + "nu doresc sa spun"; termenul e ales pe carduri (interval, nu data exacta).
const detailsSchema = configuratorContentSchema.omit({ rooms: true });
type DetailsFormValues = z.infer<typeof detailsSchema>;

// b2: intarzierea salvarii automate in ciorna (ca la intrebarile camerelor)
export const DETAILS_AUTOSAVE_MS = 400;

// Valorile formularului, asa cum se scriu in ciorna: fara campurile derivate (modul si
// proiectarea au sursa lor, b8), copiate ca RHF sa nu le mai poata modifica pe loc.
function toDraftDetails(values: Partial<DetailsFormValues>): Partial<DetailsValues> {
  const { includesPaidDesign: _paid, hasOwnProject: _own, ...rest } = values;
  // structuredClone pastreaza cheile cu undefined (ex. termenul deselectat suprascrie valoarea veche)
  return structuredClone(rest) as Partial<DetailsValues>;
}

const DEADLINE_ICONS: Record<DeadlineBucket, React.ComponentType<{ className?: string }>> = {
  ASAP: Zap,
  ONE_TO_THREE_MONTHS: Calendar,
  THREE_TO_SIX_MONTHS: CalendarRange,
  SIX_PLUS_MONTHS: CalendarClock,
  FLEXIBLE: InfinityIcon,
};

export function DetailsStep({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const t = useTranslations('Requests');
  const tc = useTranslations('Configurator');
  const locale = useLocale();
  const me = useMe();
  const stored = useConfiguratorStore((s) => s.details);
  const rooms = useConfiguratorStore((s) => s.roomInstances);
  const setDetails = useConfiguratorStore((s) => s.setDetails);
  // b8: "cu proiectare" = macar o camera bifata "am nevoie de ajutor" (bifa de aici a disparut)
  const withDesign = anyRoomNeedsDesignHelp(rooms);

  // estimarea de buget din scorul camerelor completate (F5, item 18); camerele
  // bifate pleaca fara raspunsuri, la fel ca la publicare
  const estimate = useBudgetEstimate(rooms.filter((r) => r.completed).map(toServerRoom));

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      description: stored.description ?? '',
      budgetRange: (stored.budgetRange as DetailsFormValues['budgetRange']) ?? 'UNDER_5K',
      budgetEstimateRon: stored.budgetEstimateRon ?? undefined,
      deadlineBucket: (stored.deadlineBucket as DetailsFormValues['deadlineBucket']) || undefined,
      // derivate (modul + camerele): doar ca schema sa treaca; nu se salveaza de aici
      includesPaidDesign: withDesign,
      hasOwnProject: stored.hasOwnProject ?? false,
      addressText: stored.addressText ?? '',
      county: stored.county ?? '',
      city: stored.city ?? '',
      country: stored.country ?? 'RO',
      contactPreferences: stored.contactPreferences?.length
        ? stored.contactPreferences
        : [{ channel: 'EMAIL', value: '' }],
    },
  });

  const contacts = useFieldArray({ control, name: 'contactPreferences' });

  // b2: ce scrie clientul ajunge in ciorna la ~400 ms dupa ultima schimbare, fara
  // validare (validarea stricta ramane la "Continua la sumar"). Ciorna e store-ul: in
  // editare ajunge in memoria editarii; trimiterea la server o face wizard-ul, cu
  // intarzierea lui si o singura salvare in curs. Declarat INAINTEA completarilor
  // automate (emailul contului, bugetul din estimare), ca si ele sa fie salvate.
  // Scrierea compara cu ciorna, deci o valoare neschimbata nu porneste nimic (fara bucla).
  const scopeAtMount = useRef(storageScopeId());
  // M2: o golire a ciornei (deconectare, "Incepe una noua") intre tasta si salvare anuleaza salvarea
  const generationAtMount = useRef(draftGenerationId());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValues = useRef<Partial<DetailsFormValues> | null>(null);
  const flushDraft = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const values = pendingValues.current;
    pendingValues.current = null;
    // la iesirea din editare memoria s-a schimbat deja: nu scriem peste ciorna noua
    if (!values || storageScopeId() !== scopeAtMount.current || draftGenerationId() !== generationAtMount.current) return;
    const patch = toDraftDetails(values);
    const current = useConfiguratorStore.getState().details;
    if (JSON.stringify({ ...current, ...patch }) === JSON.stringify(current)) return;
    setDetails(patch);
  }, [setDetails]);
  useEffect(() => {
    const subscription = watch((values) => {
      pendingValues.current = values as Partial<DetailsFormValues>;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushDraft, DETAILS_AUTOSAVE_MS);
    });
    // reincarcare / inchiderea tabului inainte sa treaca intarzierea
    window.addEventListener('pagehide', flushDraft);
    window.addEventListener('beforeunload', flushDraft);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('pagehide', flushDraft);
      window.removeEventListener('beforeunload', flushDraft);
      // parasirea pasului (Inapoi, bara de faze, schimbarea limbii): ultima tasta nu se pierde
      flushDraft();
    };
  }, [watch, flushDraft]);
  const vmsg = (msg?: string) => (msg ? t(`validation.${msg}`) : undefined);
  const contactsRootError =
    errors.contactPreferences?.root?.message ?? errors.contactPreferences?.message;

  const budget = watch('budgetRange');
  const budgetRon = watch('budgetEstimateRon');
  const deadline = watch('deadlineBucket');
  const city = watch('city');
  const country = watch('country') ?? 'RO';
  const contactValues = watch('contactPreferences');
  const description = watch('description');

  // numele localizate ale tarilor, din motorul Intl al browserului
  const regionNames = new Intl.DisplayNames([locale], { type: 'region' });

  // emailul contului e BLOCAT ca prima cale de comunicare (PO r5) — randul 0
  // devine mereu emailul contului (read-only, fara stergere); ce a completat
  // clientul in plus ramane pe randurile urmatoare
  const accountEmail = me.data?.email ?? null;
  useEffect(() => {
    if (!accountEmail) return;
    const current = contactValues ?? [];
    const isAccount = (c?: { channel: string; value: string }) =>
      c?.channel === 'EMAIL' && c.value.trim().toLowerCase() === accountEmail.toLowerCase();
    if (current.length > 0 && isAccount(current[0])) return;
    const rest = current.filter((c) => !isAccount(c) && !(c.channel === 'EMAIL' && !c.value));
    contacts.replace(
      [{ channel: 'EMAIL' as const, value: accountEmail }, ...rest].slice(0, 4),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountEmail]);

  // cand soseste estimarea: initializeaza valoarea pe baza (sau clameaza una
  // salvata care a iesit din interval dupa editarea camerelor). Bucket-ul se
  // deriva mereu din RON (aceeasi regula ca serverul) — repara si drafturile
  // vechi in care eticheta ramasese pe "Sub 5.000 RON" langa 33.000 RON.
  useEffect(() => {
    const est = estimate.data;
    if (!est || est.minRon <= 0 || budget === 'UNDISCLOSED') return;
    const current = budgetRon;
    const setRon = (ron: number) => {
      setValue('budgetEstimateRon', ron, { shouldValidate: true });
      setValue('budgetRange', budgetRangeFromRon(ron), { shouldValidate: true });
    };
    if (typeof current !== 'number') {
      setRon(est.minRon);
    } else if (current < est.minRon || current > est.maxRon) {
      setRon(Math.min(Math.max(current, est.minRon), est.maxRon));
    } else if (budget !== budgetRangeFromRon(current)) {
      setValue('budgetRange', budgetRangeFromRon(current), { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate.data]);

  // previzualizare titlu generat: "Bucatarie + 2 Bai — Cluj" (sursa de adevar = server)
  const counts = new Map<string, number>();
  for (const r of rooms) counts.set(r.roomType, (counts.get(r.roomType) ?? 0) + 1);
  const titleParts = [...counts.entries()].map(([type, n]) => {
    const label = t(`roomType.${type}`);
    return n === 1 ? label : `${n} × ${label}`;
  });
  const titlePreview = titleParts.join(' + ') + (city ? ` — ${city}` : '');

  const submit = handleSubmit((values) => {
    // salvarea programata e inlocuita de valorile validate
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    pendingValues.current = null;
    // modul (hasOwnProject) si proiectarea (din camere) au sursa lor: nu le scrie formularul
    setDetails(toDraftDetails(values));
    onContinue();
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-7" noValidate>
      <h2 className="font-serif text-2xl leading-[1.2] sm:text-3xl">{t('sectionGeneral')}</h2>

      {/* titlu generat automat — doar preview */}
      <div className="flex flex-col gap-1.5">
        <p className="text-ui font-medium">{t('autoTitleLabel')}</p>
        <p className="rounded-md border border-dashed border-border-2 bg-surface-2 px-3.5 py-3 font-serif text-lg leading-snug">
          {titlePreview || '—'}
        </p>
      </div>

      <Field
        label={t('field.message')}
        hint={t('messageHint')}
        error={vmsg(errors.description?.message)}
      >
        <Textarea rows={4} {...register('description')} />
        <ContactInTextHint value={description} />
      </Field>

      <fieldset className="min-w-0">
        <legend className="heading-section mb-3">{t('field.budgetRange')}</legend>
        <BudgetSlider
          value={budget}
          onChange={(v) => setValue('budgetRange', v, { shouldValidate: true })}
          estimate={estimate.data && estimate.data.minRon > 0 ? estimate.data : null}
          valueRon={typeof budgetRon === 'number' ? budgetRon : null}
          onChangeRon={(ron) =>
            setValue('budgetEstimateRon', ron ?? undefined, { shouldValidate: true })
          }
        />
      </fieldset>

      <fieldset className="min-w-0">
        <legend className="heading-section mb-3">{t('field.desiredDeadline')}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(min(130px,100%),1fr))]">
          {DEADLINE_BUCKETS.map((d) => {
            const Icon = DEADLINE_ICONS[d];
            const selected = deadline === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  setValue('deadlineBucket', selected ? undefined : d, { shouldValidate: true })
                }
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-center text-ui transition-colors',
                  selected
                    ? 'border-walnut bg-surface-2 font-semibold text-foreground shadow-[0_0_0_1px_hsl(var(--walnut))]'
                    : 'border-border-2 bg-surface font-medium text-foreground hover:border-muted-2',
                )}
              >
                <Icon aria-hidden className={cn('h-4 w-4', selected ? 'text-walnut' : 'text-muted-foreground')} />
                {t(`deadline.${d}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* b8 (PO g0-8): proiectarea se cere pe camera, din cos; aici doar se aminteste */}
      {withDesign && (
        <div className="flex items-start gap-2 rounded-lg border border-brass/40 bg-brass/10 px-3 py-2.5 text-sm">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brass-2" />
          <div>
            <p className="font-medium">{t('designHelpIncluded')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('designHelpIncludedHint')}</p>
          </div>
        </div>
      )}

      <div>
        <h3 className="heading-section mb-3.5">{t('sectionAddress')}</h3>
        <div className="flex flex-col gap-4">
          {/* tara inaintea adresei: restrictioneaza sugestiile Places (item 19) */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('field.country')}>
              <Select
                value={country}
                onChange={(e) => setValue('country', e.target.value, { shouldValidate: true })}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {regionNames.of(c) ?? c}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <AddressAutocomplete
            defaultValue={stored.addressText ?? ''}
            error={vmsg(errors.addressText?.message)}
            country={country}
            onText={(text) => setValue('addressText', text, { shouldValidate: true })}
            onResolved={(parts) => {
              setValue('addressText', parts.addressText, { shouldValidate: true });
              if (parts.county) setValue('county', parts.county, { shouldValidate: true });
              if (parts.city) setValue('city', parts.city, { shouldValidate: true });
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('field.county')} error={vmsg(errors.county?.message)}>
              <Input {...register('county')} />
            </Field>
            <Field label={t('field.city')} error={vmsg(errors.city?.message)}>
              <Input {...register('city')} />
            </Field>
          </div>
        </div>
      </div>

      <div>
        <h3 className="heading-section mb-3.5">{t('sectionContact')}</h3>
        {contactsRootError && (
          <p className="mb-2 text-sm text-crimson">{vmsg(contactsRootError)}</p>
        )}
        {/* items-start: eroarea de sub camp creste in jos, fara sa urce inputurile
            vecine (feedback PO F5, item 20) */}
        <div className="flex flex-col gap-3">
          {contacts.fields.map((c, ci) => {
            const channel = contactValues?.[ci]?.channel ?? 'EMAIL';
            // randul 0 = emailul contului, blocat (PO r5): fara schimbare de
            // canal, fara editare, fara stergere
            const locked = ci === 0 && !!accountEmail;
            return (
              <div key={c.id} className="grid grid-cols-[1fr_2fr_auto] items-start gap-3">
                <Field label={t('field.contactChannel')}>
                  {locked ? (
                    <div className="flex h-10 items-center gap-1.5 rounded-md border border-border-2 bg-surface-2 px-3 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                      {t('contactChannel.EMAIL')}
                    </div>
                  ) : (
                    <Select
                      {...register(`contactPreferences.${ci}.channel` as const, {
                        // schimbarea canalului goleste valoarea (PO r5): emailul
                        // nu ramane in campul de telefon si invers
                        onChange: () =>
                          setValue(`contactPreferences.${ci}.value`, '', {
                            shouldValidate: false,
                          }),
                      })}
                    >
                      {CONTACT_CHANNELS.map((ch) => (
                        <option key={ch} value={ch}>
                          {t(`contactChannel.${ch}`)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {/* B2: eticheta "Valoare" nu se mai afiseaza (redundanta) —
                    spacer invizibil ca inputul sa ramana aliniat cu "Canal";
                    textul ramane pe aria-label pentru cititoarele de ecran */}
                <Field
                  label={
                    locked ? t('field.accountEmail') : <span aria-hidden>&#8203;</span>
                  }
                  hint={locked ? t('accountEmailLockedHint') : undefined}
                  error={vmsg(errors.contactPreferences?.[ci]?.value?.message)}
                >
                  {/* key per varianta: inputul controlat (blocat) si cel
                      inregistrat RHF nu impart acelasi nod DOM — altfel React
                      avertizeaza "uncontrolled -> controlled" cand soseste
                      sesiunea si randul 0 se blocheaza */}
                  {locked ? (
                    <Input key="locked" type="email" value={accountEmail ?? ''} disabled readOnly />
                  ) : channel === 'PHONE' ? (
                    <PhoneInput
                      value={contactValues?.[ci]?.value ?? ''}
                      onChange={(v) =>
                        setValue(`contactPreferences.${ci}.value`, v, { shouldValidate: true })
                      }
                    />
                  ) : (
                    <Input
                      key="free"
                      type="email"
                      aria-label={t('field.contactValue')}
                      {...register(`contactPreferences.${ci}.value` as const)}
                    />
                  )}
                </Field>
                {!locked && contacts.fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-[26px]"
                    onClick={() => contacts.remove(ci)}
                  >
                    <X className="h-4 w-4 text-crimson" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="mt-3.5 h-11"
          disabled={contacts.fields.length >= 4}
          onClick={() => contacts.append({ channel: 'PHONE', value: '' })}
        >
          <Plus aria-hidden />
          {t('addContact')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <Button type="button" variant="outline" size="xl" className="px-4 text-sm" onClick={() => {
          // b2: valorile curente ajung in ciorna inainte de plecare
          flushDraft();
          onBack();
        }}>
          <ArrowLeft aria-hidden />
          {tc('nav.back')}
        </Button>
        <Button type="submit" variant="walnut" size="xl">
          {tc('nav.toReview')}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </form>
  );
}
