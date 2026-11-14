import { PrismaService } from '../../infra/prisma/prisma.service';
import { RequestsService } from './requests.service';
import { testDatabaseUrl } from '../../test/db-guard';

// b12 (etapa 7): "Bloc, scara, apartament" pe ciorna — scris, citit, golit; o ciorna fara camp
// (ca cele vechi) ramane valida si intoarce ''. Cere migrarea 20261114140000_request_address_details.
// Ruleaza doar cu TEST_DATABASE_URL (Postgres local, garda db-guard).
const url = testDatabaseUrl();
(url ? describe : describe.skip)('RequestsService address details against PostgreSQL (b12)', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  // toDto citeste fisierele ciornei: lista goala; restul dependintelor nu sunt atinse
  const uploads = { listForEntity: async () => [] };
  const service = new RequestsService(prisma, {} as never, {} as never, {} as never, uploads as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) await prisma.request.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it('o ciorna noua fara camp: coloana NULL, DTO-ul intoarce text gol', async () => {
    const { id, draftToken } = await service.createDraft(null, { addressText: 'Str. X 1' });
    created.push(id);
    expect((await prisma.request.findUniqueOrThrow({ where: { id } })).addressDetails).toBeNull();
    expect((await service.getDraft(draftToken, null)).addressDetails).toBe('');
  });

  it('patch: scrie textul curatat; un patch fara camp nu-l atinge; golirea il face NULL', async () => {
    const { id, draftToken } = await service.createDraft(null, { addressDetails: '  bl. A2,  ap. 14 ' });
    created.push(id);
    expect((await service.getDraft(draftToken, null)).addressDetails).toBe('bl. A2, ap. 14');
    await service.patchDraft(draftToken, { city: 'Cluj' }, null);
    expect((await prisma.request.findUniqueOrThrow({ where: { id } })).addressDetails).toBe('bl. A2, ap. 14');
    await service.patchDraft(draftToken, { addressDetails: '   ' }, null);
    expect((await prisma.request.findUniqueOrThrow({ where: { id } })).addressDetails).toBeNull();
  });
});
