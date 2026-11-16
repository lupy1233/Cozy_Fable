'use client';

import {
  MIN_COVERAGE_RADIUS_KM,
  type CompanyDto,
  type CompanyLocationDto,
} from '@marketplace/shared';
import { AlertTriangle, Pencil, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { AddressAutocomplete } from '@/components/configurator/address-autocomplete';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  useAddLocation,
  useDeleteLocation,
  useUpdateLocation,
  type CompanyLocationWriteInput,
  type LocationWriteResult,
} from '@/hooks/use-company';
import { ApiError } from '@/lib/api';
import { apiErrorKey } from '@/lib/error-messages';
import { ActionConfirmDialog } from '../../_components/action-confirm-dialog';
import { CompanySection } from './company-section';

// h1 (etapa 11): razele din selector — de la raza minima (grila de confidentialitate, E-client-9)
// in sus; serverul accepta orice valoare intre minim si 1000 km, deci o raza salvata care nu e in
// lista se pastreaza ca optiune.
export const RADIUS_OPTIONS_KM = [MIN_COVERAGE_RADIUS_KM, 5, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300].filter(
  (v, i, all) => v >= MIN_COVERAGE_RADIUS_KM && all.indexOf(v) === i,
);

const EMPTY_LOCATION: CompanyLocationWriteInput = {
  addressText: '',
  county: '',
  city: '',
  coverageRadiusKm: 50,
};

type ErrorField = 'addressText' | 'county' | 'city' | 'coverageRadiusKm';
type FieldErrors = Partial<Record<ErrorField, string>>;

// Erorile serverului care tin de un camp anume → mesajul apare sub acel camp.
// VALIDATION_ERROR vine cu mesajele class-validator („coverageRadiusKm must not be less than 2”).
export function serverFieldOf(err: unknown): ErrorField | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'GEOCODING_FAILED') return 'addressText';
  if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
    const fields: ErrorField[] = ['coverageRadiusKm', 'addressText', 'county', 'city'];
    for (const msg of err.details as unknown[]) {
      const field = fields.find((f) => typeof msg === 'string' && msg.startsWith(f));
      if (field) return field;
    }
  }
  return null;
}

function LocationForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: CompanyLocationWriteInput;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (input: CompanyLocationWriteInput) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('Company');
  const radiusId = useId();
  const [form, setForm] = useState<CompanyLocationWriteInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const radiusOptions = RADIUS_OPTIONS_KM.includes(form.coverageRadiusKm)
    ? RADIUS_OPTIONS_KM
    : [...RADIUS_OPTIONS_KM, form.coverageRadiusKm].sort((a, b) => a - b);

  const errorText = (err: unknown) => {
    const { key } = apiErrorKey(err);
    return t.has(key) ? t(key) : t('apiErrors.INTERNAL_ERROR');
  };
  // eroarea serverului pe camp (raza / adresa); restul (plafoane) ca mesaj al formularului
  const serverField = serverFieldOf(error);
  const serverText = (field: ErrorField) => {
    if (!error || serverField !== field) return undefined;
    if (field === 'coverageRadiusKm') return t('validation.radiusTooSmall', { min: MIN_COVERAGE_RADIUS_KM });
    return errorText(error);
  };
  const fieldError = (field: ErrorField) => errors[field] ?? serverText(field);

  const update = (patch: Partial<CompanyLocationWriteInput>, touched: ErrorField[]) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const f of touched) delete next[f];
      return next;
    });
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const next: FieldErrors = {};
    if (form.addressText.trim().length < 3) next.addressText = t('validation.addressTooShort');
    if (form.county.trim().length < 2) next.county = t('validation.countyTooShort');
    if (form.city.trim().length < 2) next.city = t('validation.cityTooShort');
    if (form.coverageRadiusKm < MIN_COVERAGE_RADIUS_KM) {
      next.coverageRadiusKm = t('validation.radiusTooSmall', { min: MIN_COVERAGE_RADIUS_KM });
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      addressText: form.addressText.trim(),
      county: form.county.trim(),
      city: form.city.trim(),
      coverageRadiusKm: form.coverageRadiusKm,
    });
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3.5">
      {/* sugestiile Google ca la formularul de cerere; coordonatele le pune serverul din adresa */}
      <AddressAutocomplete
        label={t('locationAddress')}
        defaultValue={initial.addressText}
        error={fieldError('addressText')}
        onText={(text) => update({ addressText: text }, ['addressText'])}
        onResolved={(parts) =>
          update(
            {
              addressText: parts.addressDetails ? `${parts.addressText}, ${parts.addressDetails}` : parts.addressText,
              ...(parts.county ? { county: parts.county } : {}),
              ...(parts.city ? { city: parts.city } : {}),
            },
            ['addressText', 'county', 'city'],
          )
        }
      />
      <p className="-mt-2 text-xs text-muted-foreground">{t('locationAddressHint')}</p>
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field label={t('county')} error={fieldError('county')}>
          <Input
            className="h-11"
            value={form.county}
            aria-invalid={fieldError('county') ? true : undefined}
            onChange={(e) => update({ county: e.target.value }, ['county'])}
          />
        </Field>
        <Field label={t('city')} error={fieldError('city')}>
          <Input
            className="h-11"
            value={form.city}
            aria-invalid={fieldError('city') ? true : undefined}
            onChange={(e) => update({ city: e.target.value }, ['city'])}
          />
        </Field>
        <Field label={t('country')}>
          <Input className="h-11" value={t('countryRomania')} disabled readOnly />
        </Field>
      </div>
      <Field
        label={t('coverageRadius')}
        htmlFor={radiusId}
        hint={t('coverageRadiusHint', { min: MIN_COVERAGE_RADIUS_KM })}
        error={fieldError('coverageRadiusKm')}
        className="sm:max-w-[16rem]"
      >
        <Select
          id={radiusId}
          className="h-11"
          value={String(form.coverageRadiusKm)}
          aria-invalid={fieldError('coverageRadiusKm') ? true : undefined}
          onChange={(e) => update({ coverageRadiusKm: Number(e.target.value) }, ['coverageRadiusKm'])}
        >
          {radiusOptions.map((km) => (
            <option key={km} value={km}>
              {t('radiusOption', { km })}
            </option>
          ))}
        </Select>
      </Field>
      {!!error && !serverField && (
        <Alert tone="crimson" icon={<AlertTriangle />} role="alert">
          {errorText(error)}
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" className="h-11 border-foreground px-[18px]" disabled={pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={onCancel}>
          <X aria-hidden />
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

export function LocationsSection({ company, canManage }: { company: CompanyDto; canManage: boolean }) {
  const t = useTranslations('Company');
  const add = useAddLocation();
  const edit = useUpdateLocation();
  const del = useDeleteLocation();
  // un singur formular deschis: adaugare SAU modificarea unei locatii
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // stergerea cere confirmare; tinta ramane in stare si dupa inchidere (textul nu dispare in animatie)
  const [target, setTarget] = useState<CompanyLocationDto | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // h1 (revizuire m6): locatia salvata cu centrul orasului (adresa exacta negasita) → nota sub ea
  const [cityOnlyId, setCityOnlyId] = useState<string | null>(null);

  const afterSave = (result: LocationWriteResult, locationId: string | undefined) => {
    setCityOnlyId(result.geocodePrecision === 'CITY' && locationId ? locationId : null);
  };

  const errorText = (err: unknown) => {
    const { key } = apiErrorKey(err);
    return t.has(key) ? t(key) : t('apiErrors.INTERNAL_ERROR');
  };
  const fullAddress = (l: CompanyLocationDto) =>
    `${l.addressText}, ${l.city}, ${l.county}, ${t('countryRomania')}`;

  const askDelete = (l: CompanyLocationDto) => {
    del.reset();
    setTarget(l);
    setConfirmOpen(true);
  };
  const startEdit = (l: CompanyLocationDto) => {
    edit.reset();
    setAdding(false);
    setEditingId(l.id);
  };
  const startAdd = () => {
    add.reset();
    setEditingId(null);
    setAdding(true);
  };

  return (
    <CompanySection id="locations" title={t('locations')} aside={t('locationsHint')}>
      <Card padding="none" className="overflow-hidden">
        {company.locations.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground sm:px-6">{t('noLocations')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {company.locations.map((l) =>
              editingId === l.id ? (
                <li key={l.id} className="bg-surface-2 px-4 py-5 sm:px-6">
                  <LocationForm
                    initial={{
                      addressText: l.addressText,
                      county: l.county,
                      city: l.city,
                      coverageRadiusKm: l.coverageRadiusKm,
                    }}
                    submitLabel={t('saveLocation')}
                    pending={edit.isPending}
                    error={edit.error}
                    onSubmit={(input) =>
                      edit.mutate(
                        { id: l.id, ...input },
                        {
                          onSuccess: (result) => {
                            afterSave(result, l.id);
                            setEditingId(null);
                          },
                        },
                      )
                    }
                    onCancel={() => {
                      edit.reset();
                      setEditingId(null);
                    }}
                  />
                </li>
              ) : (
                <li
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{fullAddress(l)}</div>
                    <div className="data-mono text-muted-foreground">
                      {t('coverageRadiusLabel', { km: l.coverageRadiusKm })}
                    </div>
                    {cityOnlyId === l.id && (
                      <p role="status" className="mt-1 text-xs text-amber">
                        {t('locationCityOnlyNote')}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 px-2.5"
                        aria-label={t('editLocationAria', { address: fullAddress(l) })}
                        onClick={() => startEdit(l)}
                      >
                        <Pencil aria-hidden />
                        {t('editLocationAction')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 px-2.5 text-crimson hover:bg-crimson-soft hover:text-crimson"
                        aria-label={t('deleteLocationAria', { address: fullAddress(l) })}
                        onClick={() => askDelete(l)}
                      >
                        {t('deleteLocationAction')}
                      </Button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}

        {canManage && !adding && (
          <div className="border-t border-border bg-surface-2 px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-11 border-foreground px-[18px]"
              onClick={startAdd}
            >
              <Plus aria-hidden />
              {t('addLocation')}
            </Button>
          </div>
        )}

        {canManage && adding && (
          <div className="border-t border-border bg-surface-2 px-4 py-5 sm:px-6">
            <LocationForm
              initial={EMPTY_LOCATION}
              submitLabel={t('addLocation')}
              pending={add.isPending}
              error={add.error}
              onSubmit={(input) => {
                const before = new Set(company.locations.map((l) => l.id));
                add.mutate(input, {
                  onSuccess: (result) => {
                    // locatia noua = id-ul care nu era in lista dinainte
                    afterSave(result, result.locations.find((l) => !before.has(l.id))?.id);
                    setAdding(false);
                  },
                });
              }}
              onCancel={() => {
                add.reset();
                setAdding(false);
              }}
            />
          </div>
        )}
      </Card>

      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('deleteLocationConfirm.title')}
        confirmLabel={t('deleteLocationConfirm.confirm')}
        cancelLabel={t('cancel')}
        pendingLabel={t('deleting')}
        pending={del.isPending}
        error={del.error ? errorText(del.error) : null}
        tone="danger"
        onConfirm={() => {
          if (target) del.mutate(target.id, { onSuccess: () => setConfirmOpen(false) });
        }}
      >
        {target && <p>{t('deleteLocationConfirm.body', { address: fullAddress(target) })}</p>}
      </ActionConfirmDialog>
    </CompanySection>
  );
}
