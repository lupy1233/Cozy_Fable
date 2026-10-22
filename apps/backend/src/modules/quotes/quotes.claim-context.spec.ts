// E-company-3: GET /quotes/by-claim — cine vede contactele clientului si ce ramane dintr-o
// preluare inchisa (REDACTED) sau dintr-o cerere stearsa (TOMBSTONE). Prisma mock-uit;
// SettingsService real peste prisma mock (randuri lipsa → implicitele din SETTING_DEFAULTS).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { QuotesService } from './quotes.service';
import { SettingsService } from '../../common/settings/settings.service';

type Any = any;
const HOUR = 60 * 60 * 1000;

function makeSlot(over: Partial<Any> = {}, reqOver: Partial<Any> = {}): Any {
  return {
    id: 'slot-1',
    companyId: 'c1',
    requestId: 'r1',
    status: 'OFFER_SENT',
    claimedByUserId: 'u-claimer',
    assignedToUserId: null,
    createdAt: new Date(Date.now() - 5 * HOUR),
    updatedAt: new Date(Date.now() - HOUR),
    slaDeadlineAt: new Date(Date.now() + 48 * HOUR),
    slaPausedAt: null,
    assignDeadlineAt: null,
    claimCostCreditsSnapshot: 4,
    chatThread: { id: 't1', lastClientMessageAt: null },
    claimedBy: { id: 'u-claimer', name: 'Ion Claimer' },
    assignedTo: null,
    request: {
      id: 'r1',
      title: 'Bucatarie',
      includesPaidDesign: false,
      status: 'OFFERS_RECEIVED',
      clientUserId: 'u-client',
      description: 'descriere',
      budgetRange: 'RANGE_10_20K',
      budgetEstimateRon: 15000,
      deadlineBucket: 'ONE_TO_THREE_MONTHS',
      hasOwnProject: false,
      addressText: 'Str. Clientului 1',
      city: 'Cluj-Napoca',
      county: 'Cluj',
      country: 'RO',
      deletedAt: null,
      deliveredAt: null,
      rooms: [
        {
          id: 'room-1',
          roomType: 'KITCHEN',
          lengthM: 3,
          widthM: 2,
          heightM: 2.6,
          answers: { a: 1 },
          flowVersion: 3,
          createdAt: new Date(),
          items: [],
        },
      ],
      contactPreferences: [{ id: 'cp1', channel: 'PHONE', value: '0700000000' }],
      inspirationPhotos: [{ photoId: 'ph1', note: 'suna 0722 123 456, fronturi mate', requestRoomId: 'room-1' }],
      studioScenes: [{ id: 'sc1', name: 'Scena', data: {}, createdAt: new Date() }],
      ...reqOver,
    },
    ...over,
  };
}

function quoteDto(status = 'SENT'): Any {
  return {
    id: 'q1',
    status,
    versions: [{ id: 'v1', version: 1, sentAt: new Date(Date.now() - 2 * HOUR).toISOString() }],
    consultationInvites: [{ id: 'inv1', locationAddress: 'Str. Clientului 1', status: 'PENDING_CLIENT' }],
  };
}

function build(slot: Any, opts: { settings?: Record<string, string>; quoteStatus?: string } = {}) {
  const settingsRows = opts.settings ?? {};
  const prisma: Any = {
    claimSlot: { findUnique: jest.fn().mockResolvedValue(slot) },
    quote: { findFirst: jest.fn().mockResolvedValue({ id: 'q1', status: opts.quoteStatus ?? 'SENT' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Ana Client' }) },
    requestProjectCase: { findFirst: jest.fn().mockResolvedValue(null) },
    systemSetting: {
      findUnique: jest.fn(({ where }: Any) =>
        Promise.resolve(where.key in settingsRows ? { key: where.key, value: settingsRows[where.key] } : null),
      ),
    },
  };
  const settings = new SettingsService(prisma);
  const uploads: Any = { listForEntity: jest.fn().mockResolvedValue([{ id: 'att1', url: 'https://signed' }]) };
  const calendar: Any = { addWorkingDays: jest.fn((d: Date, n: number) => new Date(d.getTime() + n * 24 * HOUR)) };
  const queue: Any = { add: jest.fn() };
  const service = new QuotesService(prisma, settings, {} as Any, calendar, uploads, {} as Any, queue, queue, queue, queue, queue);
  jest.spyOn(service, 'getQuoteDto').mockResolvedValue(quoteDto(opts.quoteStatus ?? 'SENT'));
  return { service, prisma, uploads };
}

const owner: Any = { companyId: 'c1', memberRole: 'OWNER', status: 'APPROVED' };
const managed: Any = { companyId: 'c1', memberRole: 'EMPLOYEE_MANAGED', status: 'APPROVED' };

describe('QuotesService.getClaimContext (E-company-3)', () => {
  // E-client-34: notita pozei de inspiratie — bruta doar cu acces la contacte
  it('notita pozei: bruta cu acces la contacte, mascata fara acces', async () => {
    const full = build(makeSlot({ assignedToUserId: 'u-managed' }));
    const withAccess = await full.service.getClaimContext(managed, 'u-managed', 'slot-1');
    expect(withAccess.detail.inspirationPhotos).toEqual([
      { photoId: 'ph1', note: 'suna 0722 123 456, fronturi mate', requestRoomId: 'room-1' },
    ]);
    const limited = build(makeSlot());
    const noAccess = await limited.service.getClaimContext(managed, 'u-managed', 'slot-1');
    expect(noAccess.detail.inspirationPhotos[0].note).toContain('⟦contact⟧');
    expect(noAccess.detail.inspirationPhotos[0].note).not.toContain('0722 123 456');
    expect(noAccess.detail.inspirationPhotos[0].requestRoomId).toBe('room-1');
  });

  it('(a) angajat limitat pe OFFER_SENT-ul unui coleg: fara contacte/adresa, restul fisei ramane', async () => {
    const { service, uploads } = build(makeSlot());
    const c = await service.getClaimContext(managed, 'u-managed', 'slot-1');
    // E-client-9: fisa de lucru primeste atasamentele cererii cu nume neutre
    expect(uploads.listForEntity).toHaveBeenCalledWith('REQUEST', 'r1', undefined, { neutralNames: true });
    expect(c.visibility).toBe('FULL');
    expect(c.clientHiddenReason).toBe('NOT_ASSIGNED_TO_YOU');
    expect(c.client).toBeNull();
    expect(c.detail.addressText).toBe('');
    expect(c.quote?.consultationInvites[0].locationAddress).toBe('');
    expect(c.detail.rooms).toHaveLength(1);
    expect(c.detail.attachments).toHaveLength(1);
    expect(c.threadId).toBe('t1');
  });

  it('(b) angajat limitat atribuit pe slot: contacte + adresa', async () => {
    const { service } = build(makeSlot({ assignedToUserId: 'u-managed' }));
    const c = await service.getClaimContext(managed, 'u-managed', 'slot-1');
    expect(c.clientHiddenReason).toBeNull();
    expect(c.client).toEqual({ name: 'Ana Client', contacts: [{ id: 'cp1', channel: 'PHONE', value: '0700000000' }] });
    expect(c.detail.addressText).toBe('Str. Clientului 1');
    expect(c.quote?.consultationInvites[0].locationAddress).toBe('Str. Clientului 1');
  });

  it('(c) slot WITHDRAWN → REDACTED: fara presemnare, fara raspunsuri/scene/contacte, oras pastrat, oferta proprie WITHDRAWN', async () => {
    const { service, uploads, prisma } = build(makeSlot({ status: 'WITHDRAWN' }), { quoteStatus: 'WITHDRAWN' });
    const c = await service.getClaimContext(owner, 'u-owner', 'slot-1');
    expect(c.visibility).toBe('REDACTED');
    expect(c.clientHiddenReason).toBe('NOT_OCCUPYING');
    expect(uploads.listForEntity).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(c.detail.rooms).toEqual([]);
    expect(c.detail.attachments).toEqual([]);
    expect(c.detail.studioScenes).toEqual([]);
    expect(c.detail.inspirationPhotoIds).toEqual([]);
    expect(c.detail.inspirationPhotos).toEqual([]);
    expect(c.detail.description).toBe('');
    expect(c.detail.addressText).toBe('');
    expect(c.detail.city).toBe('Cluj-Napoca');
    expect(c.detail.county).toBe('Cluj');
    expect(c.client).toBeNull();
    expect(c.threadId).toBeNull();
    expect(c.rooms).toEqual([{ id: 'room-1', roomType: 'KITCHEN' }]);
    expect(c.quote?.status).toBe('WITHDRAWN');
    expect(c.quote?.consultationInvites[0].locationAddress).toBe('');
    // oferta proprie include si WITHDRAWN (fara filtru pe status)
    expect(prisma.quote.findFirst).toHaveBeenCalledWith({ where: { claimSlotId: 'slot-1' }, orderBy: { createdAt: 'desc' } });
    // setarile de acces nu se citesc pentru un slot neocupant
    expect(prisma.systemSetting.findUnique).not.toHaveBeenCalledWith({ where: { key: 'claim_contact_reveal_policy' } });
    expect(prisma.systemSetting.findUnique).not.toHaveBeenCalledWith({
      where: { key: 'completed_claim_contact_retention_days' },
    });
  });

  it('(d) cerere stearsa → TOMBSTONE: fara oras, fara camere', async () => {
    const { service, uploads } = build(makeSlot({}, { deletedAt: new Date(Date.now() - HOUR) }));
    const c = await service.getClaimContext(owner, 'u-owner', 'slot-1');
    expect(c.visibility).toBe('TOMBSTONE');
    expect(c.clientHiddenReason).toBe('REQUEST_DELETED');
    expect(c.detail.city).toBe('');
    expect(c.detail.county).toBe('');
    expect(c.rooms).toEqual([]);
    expect(c.projectCase).toBeNull();
    expect(c.requestTitle).toBe('Bucatarie');
    expect(uploads.listForEntity).not.toHaveBeenCalled();
  });

  it('(e) slotul altei firme → 404', async () => {
    const { service } = build(makeSlot({ companyId: 'c-other' }));
    await expect(service.getClaimContext(owner, 'u-owner', 'slot-1')).rejects.toMatchObject({
      status: 404,
      response: { code: 'NOT_FOUND' },
    });
  });

  it('(f) setari lipsa → comportament ON_CLAIM (contacte vizibile imediat dupa claim)', async () => {
    const { service, prisma } = build(makeSlot({ createdAt: new Date(Date.now() - 60 * 1000), status: 'ACTIVE' }));
    const c = await service.getClaimContext(owner, 'u-owner', 'slot-1');
    expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'claim_contact_reveal_policy' } });
    expect(c.client).not.toBeNull();
    expect(c.clientHiddenReason).toBeNull();
    expect(c.clientVisibleFrom).toBeNull();
  });

  it('(g) AFTER_GRACE in primele 30 min → REVEAL_PENDING + clientVisibleFrom; valoare necunoscuta → ON_CLAIM', async () => {
    const created = new Date(Date.now() - 10 * 60 * 1000);
    const { service } = build(makeSlot({ createdAt: created, status: 'ACTIVE' }), {
      settings: { claim_contact_reveal_policy: 'AFTER_GRACE' },
    });
    const c = await service.getClaimContext(owner, 'u-owner', 'slot-1');
    expect(c.clientHiddenReason).toBe('REVEAL_PENDING');
    expect(c.clientVisibleFrom).toBe(new Date(created.getTime() + 30 * 60 * 1000).toISOString());
    expect(c.client).toBeNull();
    expect(c.detail.addressText).toBe('');

    const unknown = build(makeSlot({ createdAt: created, status: 'ACTIVE' }), { settings: { claim_contact_reveal_policy: 'FOO' } });
    expect((await unknown.service.getClaimContext(owner, 'u-owner', 'slot-1')).client).not.toBeNull();
  });
});

// E-admin-platform-45 (F2-16) — contactele scrise in texte libere urmeaza aceeasi granita.
describe('QuotesService.getClaimContext free-text masking (E-admin-platform-45)', () => {
  const TOKEN = '⟦contact⟧';
  const withContacts = () =>
    makeSlot({}, {
      title: 'Bucatarie 0722123456',
      description: 'Sunati la 0722 123 456. Corp 240 x 60 cm',
      rooms: [
        {
          id: 'room-1',
          roomType: 'KITCHEN',
          lengthM: 3,
          widthM: 2,
          heightM: 2.6,
          answers: { notes: 'mail ana@example.com' },
          flowVersion: 1,
          createdAt: new Date(),
          items: [{ id: 'it1', name: 'Corp', material: 'PAL', systems: [], description: 'www.mobila-ana.ro', quantity: 1 }],
        },
      ],
      studioScenes: [{ id: 'sc1', name: 'Living 0722123456', data: {}, createdAt: new Date() }],
    });

  it('EMPLOYEE_MANAGED neatribuit: titlu, descriere, raspunsuri, items si scene mascate', async () => {
    const { service } = build(withContacts());
    const c = await service.getClaimContext(managed, 'u-managed', 'slot-1');
    expect(c.requestTitle).toBe(`Bucatarie ${TOKEN}`);
    expect(c.detail.description).toBe(`Sunati la ${TOKEN}. Corp 240 x 60 cm`);
    expect(c.detail.rooms[0].answers).toEqual({ notes: `mail ${TOKEN}` });
    expect(c.detail.rooms[0].items[0].description).toBe(TOKEN);
    expect(c.detail.studioScenes?.[0]?.name).toBe(`Living ${TOKEN}`);
  });

  it('OWNER cu acces la contacte: textul brut', async () => {
    const { service } = build(withContacts());
    const c = await service.getClaimContext(owner, 'u-owner', 'slot-1');
    expect(c.requestTitle).toBe('Bucatarie 0722123456');
    expect(c.detail.description).toBe('Sunati la 0722 123 456. Corp 240 x 60 cm');
    expect(c.detail.rooms[0].answers).toEqual({ notes: 'mail ana@example.com' });
    expect(c.detail.rooms[0].items[0].description).toBe('www.mobila-ana.ro');
    expect(c.detail.studioScenes?.[0]?.name).toBe('Living 0722123456');
  });

  it('vederea limitata (REDACTED) mascheaza titlul', async () => {
    const { service } = build(makeSlot({ status: 'WITHDRAWN' }, { title: 'Hol 0722123456' }), { quoteStatus: 'WITHDRAWN' });
    const c = await service.getClaimContext(owner, 'u-owner', 'slot-1');
    expect(c.requestTitle).toBe(`Hol ${TOKEN}`);
  });
});
