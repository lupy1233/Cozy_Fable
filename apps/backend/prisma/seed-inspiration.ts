// Seed galeria de inspiratie (F6, item 3) — idempotent: sare daca exista poze.
// Pozele demo (Unsplash, aceleasi ca vechiul dataset static din frontend) sunt
// atribuite round-robin firmelor APPROVED existente. Ruleaza: pnpm seed:inspiration
import { PrismaClient, InspirationColor, ItemSystem, Material, RoomType } from '@prisma/client';

const prisma = new PrismaClient();

const img = (id: string, w = 900) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;

type Pin = {
  title: string;
  roomType: RoomType;
  img: string;
  colors: InspirationColor[];
  materials: Material[];
  systems: ItemSystem[];
  featured?: boolean;
};

const PINS: Pin[] = [
  { title: 'Bucatarie luminoasa', roomType: 'KITCHEN', img: img('1556911220-bff31c812dba'), colors: ['WHITE', 'NATURAL_WOOD'], materials: ['MDF_VOPSIT'], systems: ['MANER'], featured: true },
  { title: 'Living cu canapea verde', roomType: 'LIVING', img: img('1555041469-a586c61ea9bc'), colors: ['GREEN', 'NATURAL_WOOD'], materials: ['PAL'], systems: ['PUSH'], featured: true },
  { title: 'Dormitor clasic', roomType: 'BEDROOM', img: img('1505693416388-ac5ce068fe85'), colors: ['BEIGE', 'WHITE'], materials: ['MDF_VOPSIT'], systems: ['MANER'], featured: true },
  { title: 'Dulap vintage', roomType: 'DRESSING', img: img('1558997519-83ea9252edf8'), colors: ['BROWN'], materials: ['LEMN_MASIV'], systems: ['MANER'], featured: true },
  { title: 'Birou de acasa', roomType: 'OFFICE', img: img('1518455027359-f3f8164ba6bd'), colors: ['NATURAL_WOOD', 'BLACK'], materials: ['MDF_FURNIR'], systems: ['PUSH'] },
  { title: 'Colt de lectura', roomType: 'LIVING', img: img('1586023492125-27b2c045efd7'), colors: ['BEIGE', 'NATURAL_WOOD'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Bucatarie cu insula', roomType: 'KITCHEN', img: img('1565538810643-b5bdb714032a'), colors: ['GRAY', 'NATURAL_WOOD'], materials: ['MDF_INFOLIAT'], systems: ['GOLA', 'AVENTOS'], featured: true },
  { title: 'Dormitor minimal', roomType: 'BEDROOM', img: img('1595526114035-0d45ed16cfbf'), colors: ['WHITE', 'GRAY'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  { title: 'Living cald', roomType: 'LIVING', img: img('1493663284031-b7e3aefcae8e'), colors: ['BROWN', 'BEIGE'], materials: ['LEMN_MASIV'], systems: ['MANER'] },
  { title: 'Dressing cu rafturi deschise', roomType: 'DRESSING', img: img('1595428774223-ef52624120d2'), colors: ['WHITE'], materials: ['PAL'], systems: ['GLISANTE'] },
  { title: 'Dormitor tip hotel', roomType: 'BEDROOM', img: img('1540518614846-7eded433c457'), colors: ['GRAY', 'BLACK'], materials: ['MDF_FURNIR'], systems: ['PUSH'] },
];

async function main() {
  const existing = await prisma.inspirationPhoto.count();
  if (existing > 0) {
    console.log(`Inspiration already seeded (${existing} photos). Skipping.`);
    return;
  }
  const firms = await prisma.company.findMany({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'asc' },
  });
  if (firms.length === 0) {
    console.log('No APPROVED companies found — run seed-demo first. Skipping.');
    return;
  }
  for (let i = 0; i < PINS.length; i++) {
    const pin = PINS[i];
    await prisma.inspirationPhoto.create({
      data: {
        companyId: firms[i % firms.length].id,
        title: pin.title,
        roomType: pin.roomType,
        colors: pin.colors,
        materials: pin.materials,
        systems: pin.systems,
        imageUrl: pin.img,
        published: true,
        featured: pin.featured ?? false,
      },
    });
  }
  console.log(`Seeded ${PINS.length} inspiration photos across ${firms.length} firms.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
