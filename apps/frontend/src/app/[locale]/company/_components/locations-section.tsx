'use client';

import {
  MIN_COVERAGE_RADIUS_KM,
  type CompanyDto,
  type CompanyLocationDto,
  type CompanyLocationInput,
} from '@marketplace/shared';
import { AlertTriangle, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAddLocation, useDeleteLocation } from '@/hooks/use-company';
import { apiErrorKey } from '@/lib/error-messages';
import { ActionConfirmDialog } from '../../_components/action-confirm-dialog';
import { CompanySection } from './company-section';

const EMPTY_LOCATION: CompanyLocationInput = {
  addressText: '',
  county: '',
  city: '',
  lat: 0,
  lng: 0,
  coverageRadiusKm: 50,
};

export function LocationsSection({ company, canManage }: { company: CompanyDto; canManage: boolean }) {
  const t = useTranslations('Company');
  const add = useAddLocation();
  const del = useDeleteLocation();
  const radiusId = useId();
  // formularul apare doar la apasarea butonului "+ Adauga locatie"
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<CompanyLocationInput>(EMPTY_LOCATION);
  // stergerea cere confirmare; tinta ramane in stare si dupa inchidere (textul nu dispare in animatie)
  const [target, setTarget] = useState<CompanyLocationDto | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // E-client-9: raza minima (grila de confidentialitate) + plafoanele de locatii/schimbari
  const radiusTooSmall = form.coverageRadiusKm < MIN_COVERAGE_RADIUS_KM;

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

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (add.isPending || radiusTooSmall) return;
    add.mutate(form, {
      onSuccess: () => {
        setForm(EMPTY_LOCATION);
        setAdding(false);
      },
    });
  };

  return (
    <CompanySection id="locations" title={t('locations')} aside={t('locationsHint')}>
      <Card padding="none" className="overflow-hidden">
        {company.locations.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground sm:px-6">{t('noLocations')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {company.locations.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 sm:px-6"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{fullAddress(l)}</div>
                  <div className="data-mono text-muted-foreground">
                    {t('coverageRadiusLabel', { km: l.coverageRadiusKm })}
                  </div>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 px-2.5 text-crimson hover:bg-crimson-soft hover:text-crimson"
                    aria-label={t('deleteLocationAria', { address: fullAddress(l) })}
                    onClick={() => askDelete(l)}
                  >
                    {t('deleteLocationAction')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && !adding && (
          <div className="border-t border-border bg-surface-2 px-4 py-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="h-11 border-foreground px-[18px]"
              onClick={() => setAdding(true)}
            >
              <Plus aria-hidden />
              {t('addLocation')}
            </Button>
          </div>
        )}

        {canManage && adding && (
          <form
            noValidate
            onSubmit={submit}
            className="flex flex-col gap-3.5 border-t border-border bg-surface-2 px-4 py-5 sm:px-6"
          >
            <Field label={t('newLocationAddress')}>
              <Input
                className="h-11"
                value={form.addressText}
                onChange={(e) => setForm({ ...form, addressText: e.target.value })}
              />
            </Field>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label={t('county')}>
                <Input
                  className="h-11"
                  value={form.county}
                  onChange={(e) => setForm({ ...form, county: e.target.value })}
                />
              </Field>
              <Field label={t('city')}>
                <Input
                  className="h-11"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
              <Field label={t('country')}>
                <Input className="h-11" value={t('countryRomania')} disabled readOnly />
              </Field>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Field label={t('lat')} hint={t('latHint')}>
                <Input
                  className="h-11"
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })}
                />
              </Field>
              <Field label={t('lng')} hint={t('lngHint')}>
                <Input
                  className="h-11"
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })}
                />
              </Field>
              <Field
                label={t('coverageRadius')}
                htmlFor={radiusId}
                hint={t('coverageRadiusHint', { min: MIN_COVERAGE_RADIUS_KM })}
                error={
                  radiusTooSmall ? t('validation.radiusTooSmall', { min: MIN_COVERAGE_RADIUS_KM }) : undefined
                }
              >
                <div className="flex h-11 items-center rounded-md border border-border-2 bg-surface transition-colors focus-within:border-foreground focus-within:ring-2 focus-within:ring-foreground/5">
                  <input
                    id={radiusId}
                    type="number"
                    step="any"
                    min={MIN_COVERAGE_RADIUS_KM}
                    value={form.coverageRadiusKm}
                    aria-invalid={radiusTooSmall || undefined}
                    onChange={(e) => setForm({ ...form, coverageRadiusKm: Number(e.target.value) })}
                    className="h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-sm focus-visible:outline-none"
                  />
                  <span className="px-3 text-sm text-muted-foreground">km</span>
                </div>
              </Field>
            </div>
            {add.error && (
              <Alert tone="crimson" icon={<AlertTriangle />} role="alert">
                {errorText(add.error)}
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                variant="outline"
                className="h-11 border-foreground px-[18px]"
                disabled={add.isPending || radiusTooSmall}
              >
                <Plus aria-hidden />
                {t('addLocation')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => {
                  add.reset();
                  setAdding(false);
                }}
              >
                <X aria-hidden />
                {t('cancel')}
              </Button>
            </div>
          </form>
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
