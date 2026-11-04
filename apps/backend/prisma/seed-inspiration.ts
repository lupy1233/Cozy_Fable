// Seed galeria de inspiratie (R6 2026-07-12): portofoliul REAL Mobila Unicat
// (acord primit de PO) — fiecare poza are source_url catre proiectul de pe
// site-ul lor. Idempotent PER POZA (dupa imageUrl), deci poate rula si peste
// un DB care are deja pozele demo Unsplash; pe acelea le DEPUBLICA (galeria
// publica ramane doar cu mobilier real). Ruleaza: pnpm seed:inspiration
import { PrismaClient } from '@prisma/client';
import { CDN, PINS, SITE, SOURCE_COMPANY } from './inspiration-catalog';

const prisma = new PrismaClient();

async function ensureSourceCompany(): Promise<string> {
  const existing = await prisma.company.findFirst({
    where: { name: SOURCE_COMPANY.name, deletedAt: null },
  });
  if (existing) return existing.id;
  const created = await prisma.company.create({
    data: { ...SOURCE_COMPANY, status: 'APPROVED' },
  });
  console.log(`Created source company "${SOURCE_COMPANY.name}" (${created.id}).`);
  return created.id;
}

async function main() {
  const companyId = await ensureSourceCompany();

  // pozele demo Unsplash (seed-ul vechi) ies din galeria publica — raman in
  // DB (pot fi referite de cereri), dar publicul vede doar mobilier real
  const demoted = await prisma.inspirationPhoto.updateMany({
    where: { imageUrl: { contains: 'images.unsplash.com' }, published: true },
    data: { published: false },
  });
  if (demoted.count > 0) console.log(`Unpublished ${demoted.count} Unsplash demo photos.`);

  let created = 0;
  let skipped = 0;
  for (const pin of PINS) {
    const imageUrl = `${CDN}/${pin.img}`;
    const exists = await prisma.inspirationPhoto.findFirst({ where: { imageUrl } });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.inspirationPhoto.create({
      data: {
        companyId,
        title: pin.title,
        roomType: pin.roomType,
        colors: pin.colors,
        materials: pin.materials,
        systems: pin.systems,
        imageUrl,
        sourceUrl: `${SITE}/${pin.project}`,
        published: true,
        featured: pin.featured ?? false,
      },
    });
    created++;
  }
  console.log(`Inspiration seed: ${created} created, ${skipped} already present (${PINS.length} total).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
