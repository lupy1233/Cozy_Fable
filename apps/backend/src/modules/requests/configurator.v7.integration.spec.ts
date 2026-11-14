import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  collectScoreEntries,
  defaultPieceConfig,
  ETAPA10_FLOW_VERSION,
  normalizePieceConfig,
  type PieceConfig3d,
  type ScoreEntry,
} from '@marketplace/shared';
// fixture-urile deterministe ale instantaneelor (nu sunt exportate din pachet); jest ruleaza sursele shared
import { allFixtureFlows, FIXTURE_VARIANTS, fixtureAnswers } from '../../../../../packages/shared/src/questionnaire/firm-text.fixtures';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { testDatabaseUrl } from '../../test/db-guard';
import { ConfiguratorService, type ProcessedRoom } from './configurator.service';
import type { ConfiguratorRoomInputDto } from './dto/request.dto';
import { RequestsService } from './requests.service';

// etapa 10 (formularul v7, DESIGN §7d / §10) pe PostgreSQL real, dupa migrarea 20261115100000_form_v7_scores:
// - toate intrarile de scor emise de fluxurile ETAPA10_FLOW_VERSION (pe fixture-urile 'etapa10' + canapelele d3)
//   au rand in project_sizing_config (altfel o valoare noua ar costa 0 in tacere si adminul n-ar putea s-o regleze);
// - cele 45 de randuri ale migrarii exista, cu ponderile din migrare;
// - o bucatarie "Fara corpuri suspendate" se salveaza fara piesa suspendatelor.
// Ruleaza doar cu TEST_DATABASE_URL local (garda db-guard) si cu migrarile aplicate.
const url = testDatabaseUrl();
(url ? describe : describe.skip)('Configurator etapa 10 (formularul v7) against PostgreSQL', () => {
  const prisma = new PrismaService(url ? { datasources: { db: { url } } } : undefined);
  // writeRooms foloseste doar clientul de tranzactie; restul dependintelor nu sunt atinse
  const service = new RequestsService(prisma, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  const configurator = new ConfiguratorService();
  const write = (requestId: string, rooms: ProcessedRoom[]) =>
    prisma.$transaction((tx) => (service as unknown as { writeRooms: RequestsService['writeRooms'] }).writeRooms(tx, requestId, rooms));

  const MIGRATION_SRC = readFileSync(
    join(__dirname, '../../../prisma/migrations/20261115100000_form_v7_scores/migration.sql'),
    'utf8',
  );
  const MIGRATION_ROWS = [...MIGRATION_SRC.matchAll(/gen_random_uuid\(\)::text,\s*'([A-Z0-9_]+)',\s*'([A-Z0-9_]+)',\s*(-?\d+)\s*\)/g)]
    .map((m) => ({ key: m[1], option: m[2], weight: Number(m[3]) }));

  const sofa = (extra: Record<string, unknown>): PieceConfig3d => {
    const base = defaultPieceConfig('SOFA');
    return normalizePieceConfig('SOFA', { ...base, widthM: 2.4, sofa: { ...base.sofa!, ...extra } } as PieceConfig3d);
  };

  const created: string[] = [];
  afterAll(async () => {
    await prisma.request.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it('cele 45 de randuri ale migrarii exista (o pondere deja pusa de admin nu e suprascrisa — aici baza de test e curata)', async () => {
    expect(MIGRATION_ROWS).toHaveLength(45);
    const rows = await prisma.projectSizingConfig.findMany({
      where: { OR: MIGRATION_ROWS.map((r) => ({ key: r.key, option: r.option })) },
    });
    const byKey = new Map(rows.map((r) => [`${r.key}:${r.option}`, r.weight]));
    expect(MIGRATION_ROWS.filter((r) => !byKey.has(`${r.key}:${r.option}`))).toEqual([]);
    expect(MIGRATION_ROWS.filter((r) => byKey.get(`${r.key}:${r.option}`) !== r.weight)).toEqual([]);
  });

  it('toate intrarile de scor emise de fluxurile v7 (fixture-urile etapa10 + canapelele d3) au rand in project_sizing_config', async () => {
    const flows = allFixtureFlows({ only: 'etapa10' });
    expect(flows).toHaveLength(14);
    expect(flows.filter((f) => f.version !== ETAPA10_FLOW_VERSION[f.roomType])).toEqual([]);
    const entries: ScoreEntry[] = flows.flatMap(({ roomType, version, flow }) =>
      FIXTURE_VARIANTS.flatMap((variant) => collectScoreEntries(roomType, fixtureAnswers(flow, variant), version)),
    );
    for (const seats of [2, 3, 4]) {
      for (const layout of ['STRAIGHT', 'CHAISE_LEFT', 'CHAISE_RIGHT']) {
        entries.push(...collectScoreEntries('PIECE_SOFA', { config3d: sofa({ seats, layout, sleeper: true, storage: true }) }, ETAPA10_FLOW_VERSION.PIECE_SOFA));
      }
    }
    // baza de test e fara seed: randurile vechi (ROOM_TYPE, MATERIAL…) vin doar din seed.ts si sunt verificate
    // in configurator.service.spec.ts; aici se verifica pe baza reala categoriile adaugate de migrarea etapei 10
    const newKeys = new Set(MIGRATION_ROWS.map((r) => r.key));
    // fixture-urile nu ajung la stofa patului (cere pat tapitat); o adaugam explicit, pe toate valorile
    for (const bedFabric of ['WOVEN', 'BOUCLE', 'VELVET', 'FIRM_DECIDES']) {
      entries.push(...collectScoreEntries('BEDROOM', {
        piecesNeeded: ['BED_FRAME'], bedSize: 'Q_160', bedStorage: 'NONE', bedUpholstered: true, bedFabric, materialBed: 'LEMN_MASIV',
      }, ETAPA10_FLOW_VERSION.BEDROOM));
    }
    const wanted = [...new Set(entries.flatMap((e) => ('optionKeys' in e ? e.optionKeys : [e.optionKey]).map((o) => `${e.category}:${o}`)))];
    const wantedNew = wanted.filter((k) => newKeys.has(k.split(':')[0]));
    // fixture-urile + canapelele ating toate cele 14 categorii noi
    expect(new Set(wantedNew.map((k) => k.split(':')[0]))).toEqual(newKeys);
    const rows = await prisma.projectSizingConfig.findMany({ where: { key: { in: [...newKeys] } } });
    const present = new Set(rows.map((r) => `${r.key}:${r.option}`));
    expect(wantedNew.filter((k) => !present.has(k))).toEqual([]);
  });

  it('bucataria "Fara corpuri suspendate" se salveaza doar cu corpurile de baza (cu nota)', async () => {
    const r = await prisma.request.create({ data: { draftTokenHash: randomUUID(), status: 'DRAFT', includesPaidDesign: false, hasOwnProject: false } });
    created.push(r.id);
    const processed = configurator.processRooms([
      {
        sourceLocalId: 'kitchen', roomType: 'KITCHEN', flowVersion: ETAPA10_FLOW_VERSION.KITCHEN,
        answers: {
          layout: 'STRAIGHT', hasIsland: false, wallCabinets: 'NO_WALL_CABINETS', dimensions: { runA: 3, ceilingHeight: 2.6 },
          frontMaterialBase: 'PAL', openingSystemsBase: ['PUSH'], countertop: 'PAL',
        },
      } as ConfiguratorRoomInputDto,
    ]);
    const ids = await write(r.id, processed.rooms);
    const kitchen = await prisma.requestRoom.findUniqueOrThrow({ where: { id: ids.get('kitchen')! }, include: { items: true } });
    expect(kitchen.flowVersion).toBe(ETAPA10_FLOW_VERSION.KITCHEN);
    expect(kitchen.items.map((i) => i.name)).toEqual(['Corpuri de bază']);
    expect(kitchen.items[0].description).toContain('Fără corpuri suspendate');
  });
});
