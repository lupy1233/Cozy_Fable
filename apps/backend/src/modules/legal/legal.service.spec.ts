import { ERROR_CODES, LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from '@marketplace/shared';
import { LegalService } from './legal.service';

// E-admin-platform-2: identitatea operatorului (din system_settings) + acceptare versionata.
type RuleRow = { ruleKey: string; points: number; isActive: boolean };

function makeService(settings: Record<string, string>, rules: RuleRow[] = []) {
  const prisma = {
    systemSetting: {
      findMany: jest.fn(async () => Object.entries(settings).map(([key, value]) => ({ key, value }))),
    },
    penaltyRule: {
      findMany: jest.fn(async () => rules),
    },
    user: {
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        termsVersion: data.termsVersion,
        privacyVersion: data.privacyVersion,
        termsAcceptedAt: data.termsAcceptedAt,
      })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { service: new LegalService(prisma), prisma };
}

const FULL = {
  seller_name: '  Firma Test SRL ',
  seller_cui: 'RO1',
  seller_reg_com: 'J40/1/2026',
  seller_address: 'Str. Test 1, Bucuresti',
  legal_contact_email: 'contact@cozy.test',
  legal_identity_published: 'true',
};

describe('LegalService.getOperator', () => {
  it('flag false → published:false (nu expune valorile seller_* demo)', async () => {
    const { service } = makeService({ ...FULL, legal_identity_published: 'false' });
    await expect(service.getOperator()).resolves.toEqual({ published: false });
  });

  it('flag true dar un camp gol → published:false', async () => {
    const { service } = makeService({ ...FULL, seller_cui: '  ' });
    await expect(service.getOperator()).resolves.toEqual({ published: false });
    const other = makeService({ ...FULL, legal_contact_email: '' });
    await expect(other.service.getOperator()).resolves.toEqual({ published: false });
  });

  it('complet configurat → DTO cu valori curatate, dintr-o singura interogare', async () => {
    const { service, prisma } = makeService(FULL);
    await expect(service.getOperator()).resolves.toEqual({
      published: true,
      name: 'Firma Test SRL',
      cui: 'RO1',
      regCom: 'J40/1/2026',
      address: 'Str. Test 1, Bucuresti',
      contactEmail: 'contact@cozy.test',
    });
    expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('LegalService.getFirmRules', () => {
  const RULES: RuleRow[] = [
    { ruleKey: 'SLA_MISS', points: 3, isActive: true },
    { ruleKey: 'VOLUNTARY_WITHDRAWAL', points: 2, isActive: true },
  ];
  const SETTINGS = {
    company_penalty_threshold: '15',
    company_suspension_months: '4',
    max_claims_per_request: '5',
    trial_enabled: 'true',
    trial_plan: 'SILVER',
    trial_duration_days: '14',
    trial_bonus_credits: '7',
  };

  it('setari + reguli complete → DTO exact (valorile sunt live, nu hardcodate)', async () => {
    const { service } = makeService(SETTINGS, RULES);
    await expect(service.getFirmRules()).resolves.toEqual({
      verification: { reapplyBlockMonths: 3 },
      trial: { enabled: true, plan: 'SILVER', durationDays: 14, bonusCredits: 7 },
      claims: {
        maxClaimsPerRequest: 5,
        assignDeadlineMinutes: 60,
        openAfterFirstOffer: false,
        contactRevealPolicy: 'ON_CLAIM',
        completedContactRetentionDays: 0,
        claimCost: { min: 1, max: null },
      },
      sla: { workingDays: { SMALL: 3, MEDIUM: 3, LARGE: 5 }, graceHours: 12, clarificationExtensionWorkingDays: 1 },
      withdrawals: { voluntaryGraceMinutes: 30, clientUnresponsiveHours: 48 },
      penalties: {
        windowDays: 180,
        companyThreshold: 15,
        suspensionMonths: 4,
        points: { SLA_MISS: 3, VOLUNTARY_WITHDRAWAL: 2 },
      },
      delivery: { autoCompleteDays: 14 },
    });
  });

  it('fara setari si fara reguli → valorile implicite 12/6/3/true/GOLD/30/10 si punctele 3/2', async () => {
    const { service } = makeService({}, []);
    const dto = await service.getFirmRules();
    expect(dto.penalties).toMatchObject({ companyThreshold: 12, suspensionMonths: 6, points: { SLA_MISS: 3, VOLUNTARY_WITHDRAWAL: 2 } });
    expect(dto.claims.maxClaimsPerRequest).toBe(3);
    expect(dto.trial).toEqual({ enabled: true, plan: 'GOLD', durationDays: 30, bonusCredits: 10 });
  });

  it('E-admin-platform-10: openAfterFirstOffer = false implicit, true doar cu randul "true"', async () => {
    expect((await makeService({}, RULES).service.getFirmRules()).claims.openAfterFirstOffer).toBe(false);
    const on = await makeService({ ...SETTINGS, claims_open_after_first_offer: 'true' }, RULES).service.getFirmRules();
    expect(on.claims.openAfterFirstOffer).toBe(true);
    const off = await makeService({ ...SETTINGS, claims_open_after_first_offer: 'false' }, RULES).service.getFirmRules();
    expect(off.claims.openAfterFirstOffer).toBe(false);
  });

  it('E-company-3: contactRevealPolicy ON_CLAIM / retentie 0 implicit; valorile valide trec, cele invalide revin la implicit', async () => {
    const def = (await makeService({}, RULES).service.getFirmRules()).claims;
    expect(def.contactRevealPolicy).toBe('ON_CLAIM');
    expect(def.completedContactRetentionDays).toBe(0);
    const set = await makeService(
      { ...SETTINGS, claim_contact_reveal_policy: 'AFTER_GRACE', completed_claim_contact_retention_days: '90' },
      RULES,
    ).service.getFirmRules();
    expect(set.claims.contactRevealPolicy).toBe('AFTER_GRACE');
    expect(set.claims.completedContactRetentionDays).toBe(90);
    const bad = await makeService(
      { ...SETTINGS, claim_contact_reveal_policy: 'FOO', completed_claim_contact_retention_days: '-3' },
      RULES,
    ).service.getFirmRules();
    expect(bad.claims.contactRevealPolicy).toBe('ON_CLAIM');
    expect(bad.claims.completedContactRetentionDays).toBe(0);
  });

  it('E-company-21: claimCost implicit {min:1, max:null}; plafonul setat apare pe pagina publica', async () => {
    expect((await makeService({}, RULES).service.getFirmRules()).claims.claimCost).toEqual({ min: 1, max: null });
    const capped = await makeService({ ...SETTINGS, claim_cost_max: '25' }, RULES).service.getFirmRules();
    expect(capped.claims.claimCost).toEqual({ min: 1, max: 25 });
    const noCap = await makeService({ ...SETTINGS, claim_cost_min: '3', claim_cost_max: '0' }, RULES).service.getFirmRules();
    expect(noCap.claims.claimCost).toEqual({ min: 3, max: null });
  });

  it('regula inactiva → 0 puncte', async () => {
    const { service } = makeService({}, [
      { ruleKey: 'SLA_MISS', points: 3, isActive: true },
      { ruleKey: 'VOLUNTARY_WITHDRAWAL', points: 2, isActive: false },
    ]);
    const dto = await service.getFirmRules();
    expect(dto.penalties.points).toEqual({ SLA_MISS: 3, VOLUNTARY_WITHDRAWAL: 0 });
  });

  it('valoare intreaga invalida → valoarea implicita', async () => {
    const { service } = makeService({ ...SETTINGS, company_penalty_threshold: 'abc', trial_duration_days: '' }, RULES);
    const dto = await service.getFirmRules();
    expect(dto.penalties.companyThreshold).toBe(12);
    expect(dto.trial.durationDays).toBe(30);
  });

  it("trial_enabled 'false' → false", async () => {
    const { service } = makeService({ ...SETTINGS, trial_enabled: 'false' }, RULES);
    expect((await service.getFirmRules()).trial.enabled).toBe(false);
  });

  it('cate o singura interogare pe tabel', async () => {
    const { service, prisma } = makeService(SETTINGS, RULES);
    await service.getFirmRules();
    expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.penaltyRule.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('LegalService.accept', () => {
  it('versiune gresita → 409 LEGAL_VERSION_MISMATCH, fara scriere', async () => {
    const { service, prisma } = makeService({});
    await expect(service.accept('u1', { termsVersion: 'old', privacyVersion: LEGAL_PRIVACY_VERSION })).rejects.toMatchObject({
      status: 409,
      response: { code: ERROR_CODES.LEGAL_VERSION_MISMATCH },
    });
    await expect(service.accept('u1', { termsVersion: LEGAL_TERMS_VERSION, privacyVersion: 'old' })).rejects.toMatchObject({
      response: { code: ERROR_CODES.LEGAL_VERSION_MISMATCH },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('versiuni curente → salveaza ambele versiuni si momentul acceptarii', async () => {
    const { service, prisma } = makeService({});
    const res = await service.accept('u1', { termsVersion: LEGAL_TERMS_VERSION, privacyVersion: LEGAL_PRIVACY_VERSION });
    const arg = prisma.user.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 'u1' });
    expect(arg.data).toMatchObject({ termsVersion: LEGAL_TERMS_VERSION, privacyVersion: LEGAL_PRIVACY_VERSION });
    expect(arg.data.termsAcceptedAt).toBeInstanceOf(Date);
    expect(res.id).toBe('u1');
  });
});
