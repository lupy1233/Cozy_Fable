'use client';

import {
  COMPANY_MEMBER_ROLES,
  OFFER_FIELD_KEYS,
  type CompanyDto,
  type CompanyLocationInput,
  type CompanyMemberInviteInput,
  type OfferFieldPermissionEntry,
  type PortfolioItemInput,
} from '@marketplace/shared';
import { Plus, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  useAddLocation,
  useAddMember,
  useAddPortfolioItem,
  useChangeMemberRole,
  useDeleteLocation,
  useDeletePortfolioItem,
  useRemoveMember,
  useUpdateOfferPermissions,
} from '@/hooks/use-company';

export function CompanyDashboard({ company }: { company: CompanyDto }) {
  const t = useTranslations('Company');
  const format = useFormatter();
  const isOwner = company.myRole === 'OWNER';
  const canManage = company.myRole === 'OWNER' || company.myRole === 'MANAGER';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="page-title">{t('dashboardTitle')}</h1>
        <div className="flex items-center gap-3">
          {company.status === 'APPROVED' && (
            <Link href="/marketplace" className="text-sm font-medium text-walnut hover:underline">
              {t('marketplaceLink')} →
            </Link>
          )}
          <span className="rounded-full bg-surface-2 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
            {t('status')}: {t(`statusValue.${company.status}`)}
          </span>
        </div>
      </header>

      {company.status === 'PENDING_VERIFICATION' && (
        <p className="rounded-lg border border-amber/25 bg-amber-soft px-4 py-3 text-sm text-amber">
          {t('pendingNotice')}
        </p>
      )}
      {company.status === 'REJECTED' && (
        <p className="rounded-lg border border-crimson/25 bg-crimson-soft px-4 py-3 text-sm text-crimson">
          {t('rejectedNotice', { reason: company.rejectionReason ?? '' })}
        </p>
      )}
      {company.status === 'SUSPENDED' && company.suspendedUntil && (
        <p className="rounded-lg border border-crimson/25 bg-crimson-soft px-4 py-3 text-sm text-crimson">
          {t('suspendedNotice', {
            until: format.dateTime(new Date(company.suspendedUntil), { dateStyle: 'medium' }),
          })}
        </p>
      )}

      <Section title={t('profile')}>
        <p className="font-serif text-lg">{company.name}</p>
        <p className="text-sm text-muted-foreground">
          {t('cui')}: {company.cui} · {t('regComNumber')}: {company.regComNumber}
        </p>
        <p className="text-sm text-muted-foreground">
          {company.addressText}, {company.city}, {company.county}
        </p>
      </Section>

      <LocationsSection company={company} canManage={canManage} />
      <TeamSection company={company} canManage={canManage} />
      <PortfolioSection company={company} canManage={canManage} />
      <OfferPermissionsSection company={company} isOwner={isOwner} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="font-serif text-xl">{title}</h2>
      {children}
    </section>
  );
}

const EMPTY_LOCATION: CompanyLocationInput = {
  addressText: '',
  county: '',
  city: '',
  lat: 0,
  lng: 0,
  coverageRadiusKm: 50,
};

function LocationsSection({ company, canManage }: { company: CompanyDto; canManage: boolean }) {
  const t = useTranslations('Company');
  const add = useAddLocation();
  const del = useDeleteLocation();
  // formularul apare doar la apasarea butonului "+ Adauga locatie"
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<CompanyLocationInput>(EMPTY_LOCATION);

  return (
    <Section title={t('locations')}>
      {company.locations.length === 0 && <p className="text-sm text-muted-foreground">{t('noLocations')}</p>}
      <ul className="flex flex-col gap-2">
        {company.locations.map((l) => (
          <li key={l.id} className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
            <span>
              {l.addressText}, {l.city}, {l.county}, {t('countryRomania')} ·{' '}
              {t('coverageRadiusLabel', { km: l.coverageRadiusKm })}
            </span>
            {canManage && (
              <button onClick={() => del.mutate(l.id)} className="text-crimson hover:underline">
                {t('deleteLocation')}
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && !adding && (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t('addLocation')}
        </Button>
      )}

      {canManage && adding && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <Field label={t('addressText')}>
            <Input
              value={form.addressText}
              onChange={(e) => setForm({ ...form, addressText: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('county')}>
              <Input value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} />
            </Field>
            <Field label={t('city')}>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label={t('country')}>
              <Input value={t('countryRomania')} disabled readOnly />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('lat')} hint={t('latHint')}>
              <Input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })}
              />
            </Field>
            <Field label={t('lng')} hint={t('lngHint')}>
              <Input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })}
              />
            </Field>
            <Field label={t('coverageRadiusKm')} hint={t('coverageRadiusHint')}>
              <Input
                type="number"
                step="any"
                value={form.coverageRadiusKm}
                onChange={(e) => setForm({ ...form, coverageRadiusKm: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                add.mutate(form, {
                  onSuccess: () => {
                    setForm(EMPTY_LOCATION);
                    setAdding(false);
                  },
                })
              }
              disabled={add.isPending}
            >
              {t('addLocation')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              <X className="mr-1 h-4 w-4" />
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

// Tonuri de badge per rol — managerul si angajatii se disting dintr-o privire.
const ROLE_TONE: Record<string, 'walnut' | 'sage' | 'info' | 'muted'> = {
  OWNER: 'walnut',
  MANAGER: 'sage',
  EMPLOYEE_TRUSTED: 'info',
  EMPLOYEE_MANAGED: 'muted',
};

function TeamSection({ company, canManage }: { company: CompanyDto; canManage: boolean }) {
  const t = useTranslations('Company');
  const add = useAddMember();
  const remove = useRemoveMember();
  const changeRole = useChangeMemberRole();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<CompanyMemberInviteInput>({ email: '', role: 'EMPLOYEE_MANAGED' });

  return (
    <Section title={t('team')}>
      <ul className="flex flex-col gap-2">
        {company.members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">
                {m.name} · {m.email}
              </span>
              <Badge tone={ROLE_TONE[m.role] ?? 'muted'}>{t(`roleValue.${m.role}`)}</Badge>
            </span>
            {canManage && m.role !== 'OWNER' && (
              <span className="flex items-center gap-3">
                {/* schimbare rol: promovare/retrogradare fara stergere (PO overhaul) */}
                <Select
                  className="h-8 w-auto py-0 text-xs"
                  value={m.role}
                  disabled={changeRole.isPending}
                  onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value as CompanyMemberInviteInput['role'] })}
                >
                  <option value="MANAGER">{t('roleValue.MANAGER')}</option>
                  <option value="EMPLOYEE_TRUSTED">{t('roleValue.EMPLOYEE_TRUSTED')}</option>
                  <option value="EMPLOYEE_MANAGED">{t('roleValue.EMPLOYEE_MANAGED')}</option>
                </Select>
                <button onClick={() => remove.mutate(m.id)} className="text-crimson hover:underline">
                  {t('removeMember')}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {canManage && !adding && (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" />
          {t('addMember')}
        </Button>
      )}

      {canManage && adding && (
        <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-end">
          <Field label={t('memberEmail')} className="flex-1">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label={t('memberRole')}>
            <Select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as CompanyMemberInviteInput['role'] })}
            >
              <option value="MANAGER">{t('roleValue.MANAGER')}</option>
              <option value="EMPLOYEE_TRUSTED">{t('roleValue.EMPLOYEE_TRUSTED')}</option>
              <option value="EMPLOYEE_MANAGED">{t('roleValue.EMPLOYEE_MANAGED')}</option>
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                add.mutate(form, {
                  onSuccess: () => {
                    setForm({ email: '', role: 'EMPLOYEE_MANAGED' });
                    setAdding(false);
                  },
                })
              }
              disabled={add.isPending}
            >
              {t('addMember')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              <X className="mr-1 h-4 w-4" />
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

function PortfolioSection({ company, canManage }: { company: CompanyDto; canManage: boolean }) {
  const t = useTranslations('Company');
  const add = useAddPortfolioItem();
  const del = useDeletePortfolioItem();
  const [form, setForm] = useState<PortfolioItemInput>({ title: '', description: '', imageUrl: '' });

  return (
    <Section title={t('portfolio')}>
      {company.portfolio.length === 0 && <p className="text-sm text-muted-foreground">{t('noPortfolio')}</p>}
      <ul className="flex flex-col gap-2">
        {company.portfolio.map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
            <span>
              <strong>{p.title}</strong>
              {p.description ? ` · ${p.description}` : ''}
            </span>
            {canManage && (
              <button onClick={() => del.mutate(p.id)} className="text-crimson hover:underline">
                {t('deleteLocation')}
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <div className="grid grid-cols-1 gap-2 border-t border-border pt-3">
          <input
            placeholder={t('portfolioTitle')}
            className="rounded-md border border-border-2 bg-surface px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:border-foreground"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            placeholder={t('portfolioDescription')}
            className="rounded-md border border-border-2 bg-surface px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:border-foreground"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            placeholder={t('portfolioImageUrl')}
            className="rounded-md border border-border-2 bg-surface px-2 py-1.5 text-sm focus-visible:outline-none focus-visible:border-foreground"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
          />
          <button
            onClick={() => add.mutate(form)}
            disabled={add.isPending}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
          >
            {t('addPortfolioItem')}
          </button>
        </div>
      )}
    </Section>
  );
}

function OfferPermissionsSection({ company, isOwner }: { company: CompanyDto; isOwner: boolean }) {
  const t = useTranslations('Company');
  const update = useUpdateOfferPermissions();

  // Index local editabil: role|field → canEdit
  const initial: Record<string, boolean> = {};
  for (const p of company.offerFieldPermissions) initial[`${p.role}|${p.fieldKey}`] = p.canEdit;
  const [matrix, setMatrix] = useState<Record<string, boolean>>(initial);

  // dirty = matricea locala difera de cea salvata (buton Save activ + avertizare)
  const isDirty = COMPANY_MEMBER_ROLES.some((role) =>
    OFFER_FIELD_KEYS.some(
      (field) => (matrix[`${role}|${field}`] ?? false) !== (initial[`${role}|${field}`] ?? false),
    ),
  );

  const toggle = (role: string, field: string) => {
    if (!isOwner) return;
    setMatrix((m) => ({ ...m, [`${role}|${field}`]: !m[`${role}|${field}`] }));
  };

  const save = () => {
    const permissions: OfferFieldPermissionEntry[] = [];
    for (const role of COMPANY_MEMBER_ROLES) {
      for (const fieldKey of OFFER_FIELD_KEYS) {
        permissions.push({ role, fieldKey, canEdit: matrix[`${role}|${fieldKey}`] ?? false });
      }
    }
    update.mutate({ permissions });
  };

  return (
    <Section title={t('offerPermissions')}>
      <p className="text-sm text-muted-foreground">{t('offerPermissionsHint')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-4">{t('field')}</th>
              {COMPANY_MEMBER_ROLES.map((r) => (
                <th key={r} className="px-2 py-2 text-center">
                  {t(`roleValue.${r}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OFFER_FIELD_KEYS.map((field) => (
              <tr key={field} className="border-t border-border">
                <td className="py-2 pr-4">{t(`fieldValue.${field}`)}</td>
                {COMPANY_MEMBER_ROLES.map((role) => (
                  <td key={role} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      disabled={!isOwner}
                      checked={matrix[`${role}|${field}`] ?? false}
                      onChange={() => toggle(role, field)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isOwner && (
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={update.isPending || !isDirty}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-50"
          >
            {t('savePermissions')}
          </button>
          {isDirty && (
            <>
              <span className="text-sm text-amber">{t('unsavedChanges')}</span>
              <button
                onClick={() => setMatrix(initial)}
                className="text-sm text-muted-foreground hover:underline"
              >
                {t('discardChanges')}
              </button>
            </>
          )}
          {update.isSuccess && !isDirty && (
            <span className="text-sm text-sage">{t('permissionsSaved')}</span>
          )}
        </div>
      )}
    </Section>
  );
}
