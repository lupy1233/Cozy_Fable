'use client';

import {
  COMPANY_MEMBER_ROLES,
  OFFER_FIELD_KEYS,
  type CompanyDto,
  type OfferFieldPermissionEntry,
} from '@marketplace/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { useUpdateOfferPermissions } from '@/hooks/use-company';
import { apiErrorKey } from '@/lib/error-messages';
import { CompanySection } from './company-section';

export function OfferPermissionsSection({ company, isOwner }: { company: CompanyDto; isOwner: boolean }) {
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

  const saveError = update.error ? apiErrorKey(update.error) : null;

  return (
    <CompanySection id="permissions" title={t('offerPermissions')} description={t('offerPermissionsHint')}>
      <Card padding="none" className="overflow-hidden">
        <Table className="min-w-[640px] text-sm">
          <THead>
            <TR>
              <TH scope="col" className="bg-surface-2 px-4 py-3">
                {t('field')}
              </TH>
              {COMPANY_MEMBER_ROLES.map((role) => (
                <TH key={role} scope="col" className="bg-surface-2 px-4 py-3 text-center">
                  {t(`roleValue.${role}`)}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {OFFER_FIELD_KEYS.map((field) => (
              <TR key={field}>
                <TH
                  scope="row"
                  className="px-4 py-3 text-sm font-medium normal-case tracking-normal text-foreground [tr:last-child>&]:border-0"
                >
                  {t(`fieldValue.${field}`)}
                </TH>
                {COMPANY_MEMBER_ROLES.map((role) => (
                  <TD key={role} className="px-4 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      className="size-[18px] accent-walnut disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!isOwner}
                      checked={matrix[`${role}|${field}`] ?? false}
                      aria-label={t('permissionAria', {
                        field: t(`fieldValue.${field}`),
                        role: t(`roleValue.${role}`),
                      })}
                      onChange={() => toggle(role, field)}
                    />
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      {isOwner && (
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2.5">
          {saveError && (
            <p role="alert" className="mr-auto text-sm text-crimson">
              {t.has(saveError.key) ? t(saveError.key) : t('apiErrors.INTERNAL_ERROR')}
            </p>
          )}
          {isDirty && (
            <span role="status" className="text-ui font-medium text-amber">
              {t('unsavedChanges')}
            </span>
          )}
          {update.isSuccess && !isDirty && (
            <span role="status" className="text-ui font-medium text-sage">
              {t('permissionsSaved')}
            </span>
          )}
          {isDirty && (
            <Button type="button" variant="ghost" className="h-11" onClick={() => setMatrix(initial)}>
              {t('discardChanges')}
            </Button>
          )}
          <Button
            type="button"
            variant="walnut"
            className="h-11 px-5"
            onClick={save}
            disabled={update.isPending || !isDirty}
          >
            {t('savePermissions')}
          </Button>
        </div>
      )}
    </CompanySection>
  );
}
