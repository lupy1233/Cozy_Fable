import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CompanyDto } from '@marketplace/shared';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '../../../../messages/ro.json';
import { OfferPermissionsSection } from './offer-permissions-section';

// h1-2 (etapa 11, PO): proprietarul are mereu toate drepturile — coloana lui e bifata si needitabila.

const mutate = vi.fn();
vi.mock('@/hooks/use-company', () => ({
  useUpdateOfferPermissions: () => ({ mutate, isPending: false, isSuccess: false, error: null }),
}));

const FIELDS = ['PRICE', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY', 'DESCRIPTION'] as const;

function company(): CompanyDto {
  return {
    // proprietarul are randuri vechi debifate; serverul il trateaza oricum ca avand tot
    offerFieldPermissions: [
      ...FIELDS.map((fieldKey) => ({ role: 'OWNER', fieldKey, canEdit: false })),
      ...FIELDS.map((fieldKey) => ({ role: 'MANAGER', fieldKey, canEdit: true })),
    ],
  } as unknown as CompanyDto;
}

function renderSection(isOwner = true) {
  return render(
    <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
      <OfferPermissionsSection company={company()} isOwner={isOwner} />
    </NextIntlClientProvider>,
  );
}

const box = (field: string, role: string) =>
  screen.getByRole('checkbox', {
    name: ro.Company.permissionAria
      .replace('{field}', (ro.Company.fieldValue as Record<string, string>)[field])
      .replace('{role}', (ro.Company.roleValue as Record<string, string>)[role]),
  });

describe('OfferPermissionsSection (h1-2)', () => {
  beforeEach(() => mutate.mockReset());

  it('coloana proprietarului e bifata si needitabila, cu explicatia legata de casute', () => {
    renderSection();
    for (const f of FIELDS) {
      const cb = box(f, 'OWNER');
      expect(cb).toBeChecked();
      expect(cb).toBeDisabled();
      expect(cb).toHaveAccessibleDescription(ro.Company.ownerAlwaysAllowed);
    }
    expect(box('PRICE', 'MANAGER')).toBeEnabled();
  });

  it('salvarea nu trimite drepturile proprietarului', async () => {
    renderSection();
    await userEvent.click(box('PRICE', 'MANAGER'));
    await userEvent.click(screen.getByRole('button', { name: ro.Company.savePermissions }));
    expect(mutate).toHaveBeenCalledTimes(1);
    const { permissions } = mutate.mock.calls[0][0] as { permissions: { role: string; fieldKey: string; canEdit: boolean }[] };
    expect(permissions.some((p) => p.role === 'OWNER')).toBe(false);
    expect(permissions).toContainEqual({ role: 'MANAGER', fieldKey: 'PRICE', canEdit: false });
  });
});
