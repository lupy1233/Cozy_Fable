import { makeQuoteFull, makeService, structuredFields } from './quotes.test-fixtures';

// h1-2 (etapa 11, PO 2026-11-13): proprietarul are mereu toate drepturile pe campurile ofertei;
// firma fara niciun rand de permisiuni primeste matricea de la inscriere; firma cu randuri
// ramane pe randurile ei (rand lipsa pentru un rol ≠ OWNER = refuz).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const FIELDS = ['PRICE', 'DESCRIPTION', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY'];
const dto: Any = {
  claimSlotId: 'slot-win',
  price: 900,
  description: 'v1',
  vatMode: 'VAT_INCLUDED',
  deliveryTermValue: 6,
  deliveryTermUnit: 'WEEKS',
  warrantyMonths: 24,
  includesTransport: true,
  includesAssembly: true,
};
const asRole = (memberRole: string): Any => ({ companyId: 'c-win', memberRole, status: 'APPROVED' });

function setup(rows: { fieldKey: string; canEdit: boolean }[], companyRowCount: number) {
  const ctx = makeService({ lockedRequest: { status: 'CLAIMED_PARTIAL' } } as Any);
  ctx.prisma.companyOfferFieldPermission.findMany.mockResolvedValue(rows);
  ctx.prisma.companyOfferFieldPermission.count.mockResolvedValue(companyRowCount);
  return ctx;
}

describe('QuotesService — permisiunile pe campurile ofertei (h1-2)', () => {
  it('proprietar, firma fara niciun rand → oferta trece, fara citirea randurilor', async () => {
    const ctx = setup([], 0);
    await expect(ctx.service.createQuote(asRole('OWNER'), 'u-firm', dto)).resolves.toBeDefined();
    expect(ctx.prisma.companyOfferFieldPermission.findMany).not.toHaveBeenCalled();
  });

  it('proprietar cu randurile lui debifate → oferta trece', async () => {
    const ctx = setup(FIELDS.map((fieldKey) => ({ fieldKey, canEdit: false })), 20);
    await expect(ctx.service.createQuote(asRole('OWNER'), 'u-firm', dto)).resolves.toBeDefined();
  });

  it('manager, firma fara niciun rand → matricea de la inscriere il lasa sa trimita', async () => {
    const ctx = setup([], 0);
    await expect(ctx.service.createQuote(asRole('MANAGER'), 'u-mgr', dto)).resolves.toBeDefined();
  });

  it('angajat de incredere, firma fara niciun rand → tot nu poate schimba pretul', async () => {
    const ctx = setup([], 0);
    await expect(ctx.service.createQuote(asRole('EMPLOYEE_TRUSTED'), 'u-emp', dto)).rejects.toMatchObject({
      status: 403,
      response: { code: 'OFFER_FIELD_NOT_EDITABLE', details: { fields: ['PRICE'] } },
    });
  });

  it('angajat de incredere cu randuri proprii fara PRICE → 403 pe pret', async () => {
    const ctx = setup(
      FIELDS.map((fieldKey) => ({ fieldKey, canEdit: fieldKey !== 'PRICE' })),
      20,
    );
    await expect(ctx.service.createQuote(asRole('EMPLOYEE_TRUSTED'), 'u-emp', dto)).rejects.toMatchObject({
      response: { code: 'OFFER_FIELD_NOT_EDITABLE', details: { fields: ['PRICE'] } },
    });
  });

  it('firma cu randuri, dar niciunul pentru rolul angajatului → refuz (nu matricea implicita)', async () => {
    const ctx = setup([], 5);
    await expect(ctx.service.createQuote(asRole('MANAGER'), 'u-mgr', dto)).rejects.toMatchObject({
      status: 403,
      response: { code: 'OFFER_FIELD_NOT_EDITABLE' },
    });
  });
});

// revizuire h1 (testele lipsa 1-2): toate drumurile care scriu o varianta de oferta
describe('QuotesService — proprietarul, firma fara randuri, pe fiecare drum (h1-2)', () => {
  const pendingChange = (versionId: string) => ({
    id: 'cr1', quoteVersionId: versionId, clientUserId: 'u-client', requestedText: 'mai ieftin',
    status: 'PENDING', respondedAt: null, createdAt: new Date(),
  });
  const snapshotWith = (nonExtra: number, pendingOnLatest = false) =>
    makeQuoteFull({
      versions: Array.from({ length: nonExtra }, (_, i) => ({
        changeRequests: pendingOnLatest && i === nonExtra - 1 ? [pendingChange(`v${nonExtra}`)] : [],
      })),
    });
  const noRows = (ctx: Any) => {
    ctx.prisma.companyOfferFieldPermission.findMany.mockResolvedValue([]);
    ctx.prisma.companyOfferFieldPermission.count.mockResolvedValue(0);
    return ctx;
  };
  const offer: Any = { price: 1200, description: 'v noua', ...structuredFields };

  it('reviseQuote: proprietarul trece fara randuri', async () => {
    const ctx = noRows(makeService({ snapshot: snapshotWith(1, true) }));
    ctx.prisma.quoteChangeRequest.findUnique.mockResolvedValue(pendingChange('v1'));
    await expect(ctx.service.reviseQuote(asRole('OWNER'), 'u-firm', 'q1', { ...offer, changeRequestId: 'cr1' })).resolves.toMatchObject({ id: 'q1' });
  });

  it('reofferModify: proprietarul trece fara randuri', async () => {
    const ctx = noRows(makeService({ snapshot: snapshotWith(1) }));
    await expect(ctx.service.reofferModify(asRole('OWNER'), 'u-firm', 'q1', offer)).resolves.toMatchObject({ id: 'q1' });
  });

  it('extraVersion: proprietarul trece fara randuri', async () => {
    const ctx = noRows(makeService({ snapshot: snapshotWith(3) }));
    await expect(ctx.service.extraVersion(asRole('OWNER'), 'u-firm', 'q1', offer)).resolves.toMatchObject({ id: 'q1' });
  });

  it('reofferModify: angajatul de incredere fara randuri → refuzat pe pret', async () => {
    const ctx = noRows(makeService({ snapshot: snapshotWith(1) }));
    await expect(ctx.service.reofferModify(asRole('EMPLOYEE_TRUSTED'), 'u-emp', 'q1', offer)).rejects.toMatchObject({
      status: 403,
      response: { code: 'OFFER_FIELD_NOT_EDITABLE', details: { fields: ['PRICE'] } },
    });
  });

  it('EMPLOYEE_MANAGED, firma fara randuri → refuzat la creare si la variante noi', async () => {
    const create = noRows(makeService({ lockedRequest: { status: 'CLAIMED_PARTIAL' } } as Any));
    await expect(create.service.createQuote(asRole('EMPLOYEE_MANAGED'), 'u-emp', dto)).rejects.toMatchObject({ status: 403 });
    const reoffer = noRows(makeService({ snapshot: snapshotWith(1) }));
    await expect(reoffer.service.reofferModify(asRole('EMPLOYEE_MANAGED'), 'u-emp', 'q1', offer)).rejects.toMatchObject({ status: 403 });
    expect(create.tx.quote.create).not.toHaveBeenCalled();
  });
});
