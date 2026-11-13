import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ro from '../../../../messages/ro.json';
import en from '../../../../messages/en.json';
import {
  ASSIGN_LATER,
  ClaimDialogDetails,
  assigneeToPayload,
  defaultAssignee,
} from './claim-dialog-details';
import { ClosedRequestNotice, closedDetails } from './closed-request-notice';

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// a5 (PO 2026-11-13): dialogul de preluare arata termenul de raspuns si responsabilul implicit
// (cel care preia); conducerea mai are un coleg sau "Atribui mai tarziu".
const t = ro.Marketplace.claimDialog;
const MEMBERS = [
  { userId: 'u-owner', name: 'Ana Owner' },
  { userId: 'u-col', name: 'Dan Coleg' },
];
// 17 nov. 2026, 23:59 in ora Romaniei
const DEADLINE = '2026-11-17T21:59:00.000Z';

function renderDetails(over: Partial<Parameters<typeof ClaimDialogDetails>[0]> = {}, locale: 'ro' | 'en' = 'ro') {
  const onChange = vi.fn();
  const props = {
    deadlineIso: DEADLINE,
    canAssign: true,
    meId: 'u-owner',
    members: MEMBERS,
    selfBusy: false,
    value: 'u-owner',
    onChange,
    assignMinutesLabel: '60 de minute',
    ...over,
  };
  const utils = render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ro' ? ro : en} timeZone="Europe/Bucharest">
      <ClaimDialogDetails {...props} />
    </NextIntlClientProvider>,
  );
  return { ...utils, onChange };
}

describe('ClaimDialogDetails (a5)', () => {
  it('termenul de raspuns in ora Romaniei', () => {
    const { container } = renderDetails();
    expect(container.textContent).toMatch(/17 nov\. 2026.*23:59/);
  });

  it('proprietar/manager: eu (implicit), colegii si "Atribui mai tarziu"', () => {
    const { onChange } = renderDetails();
    const select = screen.getByLabelText(t.assigneeLabel) as HTMLSelectElement;
    expect(select.value).toBe('u-owner');
    const options = Array.from(select.options).map((o) => o.textContent);
    expect(options).toEqual(['Eu (Ana Owner)', 'Dan Coleg', t.assignLater]);
    fireEvent.change(select, { target: { value: ASSIGN_LATER } });
    expect(onChange).toHaveBeenCalledWith(ASSIGN_LATER);
  });

  it('"Atribui mai tarziu" ales → explicatia cu ceasul de atribuire', () => {
    renderDetails({ value: ASSIGN_LATER });
    expect(screen.getByText(t.assignLaterHint.replace('{minutes}', '60 de minute'))).toBeTruthy();
  });

  it('conducerea ocupata cu o preluare fara oferta → "eu" dezactivat + avertisment', () => {
    renderDetails({ selfBusy: true, value: ASSIGN_LATER });
    const me = screen.getByRole('option', { name: 'Eu (Ana Owner)' }) as HTMLOptionElement;
    expect(me.disabled).toBe(true);
    expect(screen.getByText(t.selfBusyLead)).toBeTruthy();
  });

  it('angajat cu acces complet: fara lista, preia pentru el', () => {
    renderDetails({ canAssign: false, meId: 'u-emp' });
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText(t.assigneeSelf)).toBeTruthy();
    expect(screen.getByText(t.lateRisk)).toBeTruthy();
  });

  it('angajat ocupat → alerta inainte de confirmare', () => {
    renderDetails({ canAssign: false, meId: 'u-emp', selfBusy: true });
    expect(screen.getByRole('alert').textContent).toBe(t.selfBusy);
  });

  it('in engleza', () => {
    const { container } = renderDetails({}, 'en');
    expect(container.textContent).toContain('Who handles the request');
    expect(container.textContent).toContain('Me (Ana Owner)');
  });

  // m10: data urmeaza limba aplicatiei (next-intl), nu limba browserului, si ora Romaniei
  it('termenul dupa limba aplicatiei (en) si in ora Romaniei', () => {
    const { container } = renderDetails({}, 'en');
    expect(container.textContent).toMatch(/Nov 17, 2026.*11:59\s?PM/);
    expect(container.textContent).not.toMatch(/17 nov\./);
  });
});

// m9: fiecare cod pe care il pot intoarce preluarea si atribuirea are text in ambele limbi
describe('Marketplace.apiErrors pentru preluare si atribuire (m9)', () => {
  const CODES = [
    'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR', 'INTERNAL_ERROR', 'RATE_LIMITED', 'IDEMPOTENCY_CONFLICT',
    'CONCURRENT_MODIFICATION', 'SUBSCRIPTION_INACTIVE', 'PLAN_FEATURE_REQUIRED', 'COMPANY_NOT_APPROVED',
    'COMPANY_SUSPENDED', 'CLAIM_NOT_ALLOWED', 'GATING_NOT_OPEN', 'CLAIM_SLOTS_FULL', 'COMPANY_EXCLUDED_FROM_REQUEST',
    'CLAIM_ALREADY_EXISTS', 'OUT_OF_COVERAGE_AREA', 'ACTIVE_CLAIM_WITHOUT_OFFER_EXISTS',
    'ASSIGNED_USER_HAS_ACTIVE_CLAIM', 'ASSIGNED_USER_PENALTY_BLOCKED', 'MANAGER_UNASSIGNED_CAP_REACHED',
    'INSUFFICIENT_CREDITS', 'REQUEST_NO_LONGER_CLAIMABLE',
  ];
  it.each(CODES)('%s are text RO si EN', (code) => {
    expect(typeof (ro.Marketplace.apiErrors as Record<string, string>)[code]).toBe('string');
    expect(typeof (en.Marketplace.apiErrors as Record<string, string>)[code]).toBe('string');
  });
});

describe('defaultAssignee / assigneeToPayload (a5)', () => {
  it('implicit cel care preia; conducerea ocupata → mai tarziu', () => {
    expect(defaultAssignee({ canAssign: true, meId: 'u1', selfBusy: false })).toBe('u1');
    expect(defaultAssignee({ canAssign: true, meId: 'u1', selfBusy: true })).toBe(ASSIGN_LATER);
    expect(defaultAssignee({ canAssign: false, meId: 'u1', selfBusy: true })).toBe('u1');
    expect(assigneeToPayload(ASSIGN_LATER)).toBeUndefined();
    expect(assigneeToPayload('u1')).toBe('u1');
  });
});

// a1: pagina din piata a unei cereri inchise spune motivul, nu "Nicio cerere"
describe('ClosedRequestNotice (a1)', () => {
  const renderNotice = (raw: unknown) =>
    render(
      <NextIntlClientProvider locale="ro" messages={ro} timeZone="Europe/Bucharest">
        <ClosedRequestNotice details={closedDetails(raw)} />
      </NextIntlClientProvider>,
    );

  it('locuri ocupate: titlul + motivul', () => {
    renderNotice({ reason: 'SLOTS_FULL', myClaimSlotId: null });
    expect(screen.getByText(ro.Marketplace.closedRequest.title)).toBeTruthy();
    expect(screen.getByText(ro.Marketplace.closedRequest.reason.SLOTS_FULL)).toBeTruthy();
    expect(screen.queryByText(ro.Marketplace.empty)).toBeNull();
    expect(screen.queryByText(ro.Marketplace.closedRequest.openWorksheet)).toBeNull();
  });

  it('firma avea o preluare → link spre fisa de lucru', () => {
    renderNotice({ reason: 'OFFER_ACCEPTED', myClaimSlotId: 'slot-9' });
    expect(screen.getByText(ro.Marketplace.closedRequest.reason.OFFER_ACCEPTED)).toBeTruthy();
    expect(screen.getByText(ro.Marketplace.closedRequest.openWorksheet).closest('a')?.getAttribute('href')).toBe(
      '/marketplace/claims/slot-9',
    );
  });

  it('details lipsa sau necunoscute → motivul general', () => {
    renderNotice(undefined);
    expect(screen.getByText(ro.Marketplace.closedRequest.reason.CLOSED)).toBeTruthy();
  });
});
