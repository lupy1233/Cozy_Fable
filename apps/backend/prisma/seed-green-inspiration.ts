import { PrismaClient, type Prisma } from '@prisma/client';
import { CDN, PINS, SITE, SOURCE_COMPANY } from './inspiration-catalog';

class GreenSeedError extends Error {}

export function assertGreenInspirationTarget(env: NodeJS.ProcessEnv, apply = false): void {
  let database: URL;
  try { database = new URL(env.DATABASE_URL ?? ''); }
  catch { throw new GreenSeedError('A valid isolated Green database URL is required'); }
  if (env.DEPLOYMENT_SLOT !== 'green' || env.GREEN_ISOLATED_PREVIEW !== 'true' ||
      database.hostname !== 'green-postgres.railway.internal' || database.pathname !== '/green_preview' ||
      env.REDIS_HOST !== 'green-redis.railway.internal' || env.S3_BUCKET !== 'green-preview' ||
      env.SMTP_HOST !== 'green-mail.railway.internal' || env.STRIPE_SECRET_KEY) {
    throw new GreenSeedError('Refusing a target outside the isolated Green preview');
  }
  if (apply && env.RUN_GREEN_INSPIRATION !== '1') throw new GreenSeedError('RUN_GREEN_INSPIRATION=1 is required for writes');
}

const curatedPhotos = PINS.map((pin) => ({
  title: pin.title, roomType: pin.roomType, colors: pin.colors, materials: pin.materials,
  systems: pin.systems, imageUrl: `${CDN}/${pin.img}`, sourceUrl: `${SITE}/${pin.project}`,
  published: true, featured: pin.featured ?? false,
}));

async function inspect(db: Pick<Prisma.TransactionClient, 'company' | 'inspirationPhoto'>) {
  const companies = await db.company.findMany({
    where: { name: SOURCE_COMPANY.name },
    select: { id: true, status: true, deletedAt: true },
  });
  if (companies.length > 1 || companies.some((company) => company.deletedAt || company.status !== 'APPROVED')) {
    throw new GreenSeedError('Existing source-company attribution needs review; no rows changed');
  }
  const companyId = companies[0]?.id;
  const existing = await db.inspirationPhoto.findMany({
    where: { imageUrl: { in: curatedPhotos.map((photo) => photo.imageUrl) } },
    select: { imageUrl: true, companyId: true, published: true, deletedAt: true },
  });
  if (existing.some((photo) => photo.companyId !== companyId || !photo.published || photo.deletedAt)) {
    throw new GreenSeedError('Existing curated photos need review; publication and attribution are preserved');
  }
  const urls = new Set(existing.map((photo) => photo.imageUrl));
  if (urls.size !== existing.length) throw new GreenSeedError('Duplicate curated photos need review; no rows changed');
  return { companyId, missing: curatedPhotos.filter((photo) => !urls.has(photo.imageUrl)), present: urls.size };
}

// Nu importa clienti/cereri si nu modifica publicarea imaginilor deja existente.
export async function seedGreenInspiration(prisma: PrismaClient, env: NodeJS.ProcessEnv, apply = false) {
  assertGreenInspirationTarget(env, apply);
  if (!apply) {
    const plan = await inspect(prisma);
    return { mode: 'dry-run', curated: curatedPhotos.length, companyCreates: plan.companyId ? 0 : 1, photoCreates: plan.missing.length, alreadyPresent: plan.present };
  }
  return prisma.$transaction(async (tx) => {
    // Serializam rerularile aceluiasi catalog, inclusiv cand image_url nu e unic.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(719260916)::text`;
    const plan = await inspect(tx);
    const companyId = plan.companyId ?? (await tx.company.create({
      data: { ...SOURCE_COMPANY, status: 'APPROVED' }, select: { id: true },
    })).id;
    if (plan.missing.length) await tx.inspirationPhoto.createMany({ data: plan.missing.map((photo) => ({ ...photo, companyId })) });
    return { mode: 'applied', curated: curatedPhotos.length, companyCreates: plan.companyId ? 0 : 1, photoCreates: plan.missing.length, alreadyPresent: plan.present };
  }, { timeout: 30_000 });
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');
  // Validam tinta inainte de instantierea clientului sau orice acces la DB.
  try { assertGreenInspirationTarget(process.env, apply); }
  catch (error) { console.error(error instanceof GreenSeedError ? error.message : 'Invalid Green seed target'); process.exit(1); }
  const prisma = new PrismaClient();
  seedGreenInspiration(prisma, process.env, apply)
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error instanceof GreenSeedError ? error.message : error.code ?? error.name); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
