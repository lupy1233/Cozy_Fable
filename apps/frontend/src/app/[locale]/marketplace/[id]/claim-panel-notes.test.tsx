import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import ro from '../../../../messages/ro.json';
import { ClaimCostSource, claimBlockedByRole } from './claim-panel-notes';

// a7 (etapa 7): cine poate prelua, de unde vine costul, codurile preluarii au text.

describe('claimBlockedByRole', () => {
  it('angajatul fara acces complet e blocat; conducerea si angajatul de incredere nu', () => {
    expect(claimBlockedByRole({ myRole: 'EMPLOYEE_MANAGED' })).toBe(true);
    expect(claimBlockedByRole({ myRole: 'EMPLOYEE_TRUSTED' })).toBe(false);
    expect(claimBlockedByRole({ myRole: 'MANAGER' })).toBe(false);
    expect(claimBlockedByRole({ myRole: 'OWNER' })).toBe(false);
    // permisiunile calculate de server au intaietate
    expect(claimBlockedByRole({ myRole: 'OWNER', permissions: [] })).toBe(true);
  });

  it('firma inca neincarcata → nu blocheaza (serverul verifica oricum)', () => {
    expect(claimBlockedByRole(undefined)).toBe(false);
  });
});

describe('ClaimCostSource', () => {
  function show(estimateMinRon: number | null, creditValueRon: number | undefined) {
    return render(
      <NextIntlClientProvider locale="ro" messages={ro}>
        <ClaimCostSource estimateMinRon={estimateMinRon} creditValueRon={creditValueRon} />
      </NextIntlClientProvider>,
    );
  }

  it('bugetul minim estimat si valoarea unui credit, in lei', () => {
    show(33000, 1000);
    expect(
      screen.getByText('Costul vine din bugetul minim estimat de client (33.000 lei; 1 credit = 1.000 lei).'),
    ).toBeInTheDocument();
  });

  it('fara valoarea creditului → doar bugetul; fara estimare → nimic', () => {
    show(12000, undefined);
    expect(screen.getByText('Costul vine din bugetul minim estimat de client (12.000 lei).')).toBeInTheDocument();
    const { container } = show(null, 1000);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('textele preluarii (a7)', () => {
  it.each([
    ['ro', ro],
    ['en', en],
  ] as const)('%s: CLAIM_ROLE_NOT_ALLOWED si MANAGER_UNASSIGNED_CAP_REACHED au text', (_l, msgs) => {
    expect(msgs.Marketplace.apiErrors.CLAIM_ROLE_NOT_ALLOWED).toBeTruthy();
    expect(msgs.Marketplace.apiErrors.MANAGER_UNASSIGNED_CAP_REACHED).toBeTruthy();
    expect(msgs.Marketplace.claimPanel.roleBlocked).toBeTruthy();
    expect(msgs.Marketplace.detailMetaClaimed).not.toMatch(/după preluare|after you claim/);
  });
});
