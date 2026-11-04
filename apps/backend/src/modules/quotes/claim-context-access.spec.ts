import { resolveClaimContextAccess, type ClaimContextAccessInput } from './claim-context-access';

// E-company-3: matricea completa a accesului pe fisa de lucru (docs/03 4.2).
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = new Date('2026-09-30T12:00:00.000Z').getTime();

function input(over: Partial<ClaimContextAccessInput> = {}): ClaimContextAccessInput {
  return {
    slotStatus: 'OFFER_SENT',
    requestDeletedAt: null,
    slotCreatedAt: new Date(NOW - 2 * DAY),
    slotUpdatedAt: new Date(NOW - DAY),
    requestDeliveredAt: null,
    claimedByUserId: 'u-claimer',
    assignedToUserId: null,
    memberRole: 'OWNER',
    actingUserId: 'u-owner',
    revealPolicy: 'ON_CLAIM',
    retentionDays: 0,
    now: NOW,
    ...over,
  };
}

describe('resolveClaimContextAccess (E-company-3)', () => {
  it('cerere stearsa → TOMBSTONE / REQUEST_DELETED (inaintea oricarei alte reguli)', () => {
    expect(resolveClaimContextAccess(input({ requestDeletedAt: new Date(NOW - DAY), slotStatus: 'WITHDRAWN' }))).toEqual({
      visibility: 'TOMBSTONE',
      clientVisible: false,
      clientHiddenReason: 'REQUEST_DELETED',
      clientVisibleFrom: null,
    });
  });

  it.each([
    'WITHDRAWN',
    'WITHDRAWN_VOLUNTARY',
    'SLA_EXPIRED',
    'CANCELLED_REQUEST_ACCEPTED',
    'CANCELLED_UNASSIGNED',
    'CANCELLED_PROJECT',
    'CANCELLED_OFFER_EXPIRED',
  ] as const)('slot %s → REDACTED / NOT_OCCUPYING', (slotStatus) => {
    const a = resolveClaimContextAccess(input({ slotStatus }));
    expect(a.visibility).toBe('REDACTED');
    expect(a.clientVisible).toBe(false);
    expect(a.clientHiddenReason).toBe('NOT_OCCUPYING');
  });

  it.each(['ACTIVE', 'OFFER_SENT', 'COMPLETED'] as const)('slot ocupant %s, OWNER → FULL, contacte vizibile', (slotStatus) => {
    expect(resolveClaimContextAccess(input({ slotStatus }))).toEqual({
      visibility: 'FULL',
      clientVisible: true,
      clientHiddenReason: null,
      clientVisibleFrom: null,
    });
  });

  describe('EMPLOYEE_MANAGED', () => {
    const managed = { memberRole: 'EMPLOYEE_MANAGED' as const, actingUserId: 'u-managed' };
    it('pe preluarea unui coleg → FULL, fara contacte (NOT_ASSIGNED_TO_YOU)', () => {
      const a = resolveClaimContextAccess(input(managed));
      expect(a).toEqual({ visibility: 'FULL', clientVisible: false, clientHiddenReason: 'NOT_ASSIGNED_TO_YOU', clientVisibleFrom: null });
    });
    it('atribuit pe slot → contacte vizibile', () => {
      expect(resolveClaimContextAccess(input({ ...managed, assignedToUserId: 'u-managed' })).clientVisible).toBe(true);
    });
    it('claimer pe slot → contacte vizibile', () => {
      expect(resolveClaimContextAccess(input({ ...managed, claimedByUserId: 'u-managed' })).clientVisible).toBe(true);
    });
  });

  it('EMPLOYEE_TRUSTED pe preluarea unui coleg → contacte vizibile', () => {
    const a = resolveClaimContextAccess(input({ memberRole: 'EMPLOYEE_TRUSTED', actingUserId: 'u-trusted' }));
    expect(a.clientVisible).toBe(true);
  });

  describe('AFTER_GRACE', () => {
    it('la +10 min de la claim → REVEAL_PENDING cu visibleFrom = claim + 30 min', () => {
      const created = new Date(NOW - 10 * MIN);
      const a = resolveClaimContextAccess(input({ revealPolicy: 'AFTER_GRACE', slotCreatedAt: created, slotStatus: 'ACTIVE' }));
      expect(a.visibility).toBe('FULL');
      expect(a.clientVisible).toBe(false);
      expect(a.clientHiddenReason).toBe('REVEAL_PENDING');
      expect(a.clientVisibleFrom?.getTime()).toBe(created.getTime() + 30 * MIN);
    });
    it('la +31 min → contacte vizibile', () => {
      const a = resolveClaimContextAccess(
        input({ revealPolicy: 'AFTER_GRACE', slotCreatedAt: new Date(NOW - 31 * MIN), slotStatus: 'ACTIVE' }),
      );
      expect(a.clientVisible).toBe(true);
      expect(a.clientHiddenReason).toBeNull();
    });
    it('ON_CLAIM la +1 min → vizibile imediat (W1)', () => {
      expect(resolveClaimContextAccess(input({ slotCreatedAt: new Date(NOW - MIN) })).clientVisible).toBe(true);
    });
  });

  describe('prag dupa livrare (retentionDays)', () => {
    const completed = {
      slotStatus: 'COMPLETED' as const,
      retentionDays: 30,
      requestDeliveredAt: new Date(NOW - 40 * DAY),
    };
    it('livrat acum 40 zile, prag 30: TRUSTED ascuns (RETENTION_EXPIRED)', () => {
      const a = resolveClaimContextAccess(input({ ...completed, memberRole: 'EMPLOYEE_TRUSTED', actingUserId: 'u-claimer' }));
      expect(a.clientVisible).toBe(false);
      expect(a.clientHiddenReason).toBe('RETENTION_EXPIRED');
    });
    it('MANAGER si OWNER raman cu acces', () => {
      expect(resolveClaimContextAccess(input({ ...completed, memberRole: 'MANAGER' })).clientVisible).toBe(true);
      expect(resolveClaimContextAccess(input({ ...completed, memberRole: 'OWNER' })).clientVisible).toBe(true);
    });
    it('livrat acum 10 zile → TRUSTED inca vede', () => {
      const a = resolveClaimContextAccess(
        input({ ...completed, requestDeliveredAt: new Date(NOW - 10 * DAY), memberRole: 'EMPLOYEE_TRUSTED' }),
      );
      expect(a.clientVisible).toBe(true);
    });
    it('fara delivered_at → ancora = updated_at al slotului', () => {
      const a = resolveClaimContextAccess(
        input({ ...completed, requestDeliveredAt: null, slotUpdatedAt: new Date(NOW - 31 * DAY), memberRole: 'EMPLOYEE_TRUSTED' }),
      );
      expect(a.clientHiddenReason).toBe('RETENTION_EXPIRED');
    });
    it('prag 0 → niciodata ascuns', () => {
      const a = resolveClaimContextAccess(
        input({ ...completed, retentionDays: 0, requestDeliveredAt: new Date(NOW - 3000 * DAY), memberRole: 'EMPLOYEE_TRUSTED' }),
      );
      expect(a.clientVisible).toBe(true);
    });
    it('pragul nu se aplica pe sloturi care nu sunt COMPLETED', () => {
      const a = resolveClaimContextAccess(
        input({ ...completed, slotStatus: 'OFFER_SENT', memberRole: 'EMPLOYEE_TRUSTED' }),
      );
      expect(a.clientVisible).toBe(true);
    });
  });
});
