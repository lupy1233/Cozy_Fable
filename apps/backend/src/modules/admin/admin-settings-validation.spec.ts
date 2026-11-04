import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

// Sprint 1 security-close — setarile noi (inchidere automata oferte expirate, reminder livrare)
// accepta doar valori cunoscute; celelalte chei raman neatinse.
describe('AdminService.updateSetting - validare chei noi', () => {
  const makeService = (key: string | null) => {
    const prisma = {
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(key ? { key, value: 'x' } : null),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ key: where.key, value: data.value })),
      },
    };
    const queue = {} as never;
    const service = new AdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue,
    );
    return { service, prisma };
  };

  it.each([
    ['expired_offer_autoclose_enabled', 'true'],
    ['expired_offer_autoclose_enabled', 'false'],
    ['expired_offer_autoclose_credit_outcome', 'REFUND'],
    ['expired_offer_autoclose_credit_outcome', 'CONSUME'],
    ['expired_offer_autoclose_credit_outcome', 'UNSET'],
    ['expired_offer_autoclose_days', '0'],
    ['expired_offer_autoclose_days', '14'],
    ['delivery_reminder_days_before', ' 3 '],
    // E-admin-platform-2
    ['legal_identity_published', 'true'],
    ['legal_identity_published', 'false'],
    ['legal_contact_email', ''],
    ['legal_contact_email', ' contact@cozy.test '],
    // Hotfix 2026-10-04 (PO): re-acceptarea Termenilor pentru conturile existente
    ['legal_reaccept_existing_users', 'true'],
    ['legal_reaccept_existing_users', 'false'],
    ['legal_reaccept_existing_users', ' true '],
    // E-admin-platform-10
    ['claims_open_after_first_offer', 'true'],
    ['claims_open_after_first_offer', 'false'],
    ['max_claims_per_request', '1'],
    ['max_claims_per_request', '3'],
    // E-company-3 (DECIZIE NECESARA PO)
    ['claim_contact_reveal_policy', 'ON_CLAIM'],
    ['claim_contact_reveal_policy', 'AFTER_GRACE'],
    ['completed_claim_contact_retention_days', '0'],
    ['completed_claim_contact_retention_days', '3650'],
    // E-admin-platform-45 (DECIZIE NECESARA PO)
    ['pre_claim_contact_text_policy', 'MASK'],
    ['pre_claim_contact_text_policy', 'BLOCK'],
    // E-client-9 (DECIZIE NECESARA PO)
    ['marketplace_distance_display', 'KM'],
    ['marketplace_distance_display', 'BAND'],
    ['company_locations_max', '1'],
    ['company_locations_max', '100'],
    ['company_location_changes_per_day', '1'],
    ['company_location_changes_per_day', '1000'],
    // E-company-21 (DECIZIE NECESARA PO: valorile min/max)
    ['credit_value_ron', '1000'],
    ['credit_value_ron', '1'],
    ['claim_cost_min', '1'],
    ['claim_cost_max', '0'],
    ['claim_cost_max', '25'],
    // E-company-24 (DECIZIE NECESARA PO: zilele; 0 = oprit)
    ['bank_transfer_reminder_days', '0'],
    ['bank_transfer_reminder_days', '7'],
    ['bank_transfer_expiry_days', '0'],
    ['bank_transfer_expiry_days', '7'],
  ])('%s = %p este acceptat', async (key, value) => {
    const { service, prisma } = makeService(key);
    const res = await service.updateSetting(key, value, 'admin-1');
    expect(res.value).toBe(value.trim());
    expect(prisma.systemSetting.update).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['expired_offer_autoclose_enabled', 'yes'],
    ['expired_offer_autoclose_credit_outcome', 'refund'],
    ['expired_offer_autoclose_credit_outcome', ''],
    ['expired_offer_autoclose_days', '-1'],
    ['expired_offer_autoclose_days', '1.5'],
    ['expired_offer_autoclose_days', '366'],
    ['delivery_reminder_days_before', 'abc'],
    ['legal_identity_published', 'yes'],
    ['legal_contact_email', 'abc'],
    ['legal_contact_email', 'a b@c.d'],
    ['legal_reaccept_existing_users', 'yes'],
    ['legal_reaccept_existing_users', 'TRUE'],
    ['legal_reaccept_existing_users', ''],
    // E-admin-platform-10 (docs/03 4.8: maxim 3 firme)
    ['claims_open_after_first_offer', 'yes'],
    ['claims_open_after_first_offer', 'TRUE'],
    ['max_claims_per_request', '0'],
    ['max_claims_per_request', '4'],
    ['max_claims_per_request', 'abc'],
    ['max_claims_per_request', '2.5'],
    ['max_claims_per_request', ''],
    // E-company-3
    ['claim_contact_reveal_policy', 'FOO'],
    ['claim_contact_reveal_policy', 'on_claim'],
    ['completed_claim_contact_retention_days', '-1'],
    ['completed_claim_contact_retention_days', '3651'],
    ['completed_claim_contact_retention_days', '01'],
    ['completed_claim_contact_retention_days', ''],
    // E-admin-platform-45
    ['pre_claim_contact_text_policy', 'mask'],
    ['pre_claim_contact_text_policy', 'FOO'],
    // E-client-9
    ['marketplace_distance_display', 'km'],
    ['marketplace_distance_display', 'EXACT'],
    ['company_locations_max', '0'],
    ['company_locations_max', '101'],
    ['company_locations_max', '1.5'],
    ['company_locations_max', ''],
    ['company_location_changes_per_day', '0'],
    ['company_location_changes_per_day', '1001'],
    ['company_location_changes_per_day', '05'],
    // E-company-24
    ['bank_transfer_reminder_days', '-1'],
    ['bank_transfer_reminder_days', 'abc'],
    ['bank_transfer_reminder_days', '400'],
    ['bank_transfer_expiry_days', '-1'],
    ['bank_transfer_expiry_days', 'abc'],
    ['bank_transfer_expiry_days', '400'],
    // E-company-21
    ['credit_value_ron', '0'],
    ['credit_value_ron', '-1'],
    ['credit_value_ron', 'abc'],
    ['credit_value_ron', '1000001'],
    ['claim_cost_min', '0'],
    ['claim_cost_min', '-1'],
    ['claim_cost_min', 'abc'],
    ['claim_cost_min', '1001'],
    ['claim_cost_max', '-1'],
    ['claim_cost_max', 'abc'],
    ['claim_cost_max', '1001'],
    ['claim_cost_max', '05'],
  ])('%s = %p este respins cu 400 fara scriere', async (key, value) => {
    const { service, prisma } = makeService(key);
    await expect(service.updateSetting(key, value, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.systemSetting.update).not.toHaveBeenCalled();
  });

  it('cheile existente fara regula raman neschimbate (valoare nemodificata)', async () => {
    const { service } = makeService('invoice_series');
    const res = await service.updateSetting('invoice_series', ' CF ', 'admin-1');
    expect(res.value).toBe(' CF ');
  });

  it('cheie necunoscuta → 404', async () => {
    const { service } = makeService(null);
    await expect(service.updateSetting('nope', 'x', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

// E-company-21: plafonul costului unei preluari e 0 (fara plafon) sau >= minimul
describe('AdminService.updateSetting - intervalul claim_cost_min/claim_cost_max', () => {
  const makeService = (values: Record<string, string>) => {
    const prisma = {
      systemSetting: {
        findUnique: jest.fn(({ where }: { where: { key: string } }) =>
          Promise.resolve(where.key in values ? { key: where.key, value: values[where.key] } : null),
        ),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ key: where.key, value: data.value })),
      },
    };
    const queue = {} as never;
    const service = new AdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue,
    );
    return { service, prisma };
  };

  it('max = 2 cu min = 3 → 400 CLAIM_COST_RANGE fara scriere', async () => {
    const { service, prisma } = makeService({ claim_cost_min: '3', claim_cost_max: '0' });
    await expect(service.updateSetting('claim_cost_max', '2', 'admin-1')).rejects.toMatchObject({
      response: { code: 'VALIDATION_ERROR', details: [{ field: 'claim_cost_max', reason: 'CLAIM_COST_RANGE' }] },
    });
    expect(prisma.systemSetting.update).not.toHaveBeenCalled();
  });

  it('min = 30 cu max = 25 → 400 fara scriere', async () => {
    const { service, prisma } = makeService({ claim_cost_min: '1', claim_cost_max: '25' });
    await expect(service.updateSetting('claim_cost_min', '30', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.systemSetting.update).not.toHaveBeenCalled();
  });

  it('min = 30 cu max = 0 (fara plafon) → acceptat', async () => {
    const { service, prisma } = makeService({ claim_cost_min: '1', claim_cost_max: '0' });
    await expect(service.updateSetting('claim_cost_min', '30', 'admin-1')).resolves.toEqual({ key: 'claim_cost_min', value: '30' });
    expect(prisma.systemSetting.update).toHaveBeenCalledTimes(1);
  });

  it('max = min este acceptat; lipsa celeilalte chei = implicitele (min 1, max 0)', async () => {
    const a = makeService({ claim_cost_min: '3', claim_cost_max: '0' });
    await expect(a.service.updateSetting('claim_cost_max', '3', 'admin-1')).resolves.toEqual({ key: 'claim_cost_max', value: '3' });
    const b = makeService({ claim_cost_max: '0' });
    await expect(b.service.updateSetting('claim_cost_max', '1', 'admin-1')).resolves.toEqual({ key: 'claim_cost_max', value: '1' });
  });
});

// E-admin-platform-58: trial_plan = codul unui plan ACTIV existent (planurile sunt date)
describe('AdminService.updateSetting - trial_plan', () => {
  const makeService = (activeCodes: string[]) => {
    const prisma = {
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue({ key: 'trial_plan', value: 'GOLD' }),
        update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ key: where.key, value: data.value })),
      },
      subscriptionPlan: {
        findFirst: jest.fn(({ where }: { where: { code: string; isActive: boolean } }) =>
          Promise.resolve(activeCodes.includes(where.code) && where.isActive ? { id: `plan-${where.code}` } : null),
        ),
      },
    };
    const queue = {} as never;
    const service = new AdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue, queue,
    );
    return { service, prisma };
  };

  it.each(['GOLD', ' TEST_FREE '])('%p (plan activ) → acceptat', async (value) => {
    const { service, prisma } = makeService(['GOLD', 'TEST_FREE']);
    await expect(service.updateSetting('trial_plan', value, 'admin-1')).resolves.toEqual({ key: 'trial_plan', value: value.trim() });
    expect(prisma.subscriptionPlan.findFirst).toHaveBeenCalledWith({ where: { code: value.trim(), isActive: true }, select: { id: true } });
  });

  it.each(['NOPE', 'gold', '', 'GOLD; DROP'])('%p → 400 PLAN_NOT_FOUND fara scriere', async (value) => {
    const { service, prisma } = makeService(['GOLD']);
    await expect(service.updateSetting('trial_plan', value, 'admin-1')).rejects.toMatchObject({
      status: 400,
      response: { code: 'VALIDATION_ERROR', details: [{ field: 'trial_plan', reason: 'PLAN_NOT_FOUND' }] },
    });
    expect(prisma.systemSetting.update).not.toHaveBeenCalled();
  });
});
