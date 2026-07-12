// Seed galeria de inspiratie (R6 2026-07-12): portofoliul REAL Mobila Unicat
// (acord primit de PO) — fiecare poza are source_url catre proiectul de pe
// site-ul lor. Idempotent PER POZA (dupa imageUrl), deci poate rula si peste
// un DB care are deja pozele demo Unsplash; pe acelea le DEPUBLICA (galeria
// publica ramane doar cu mobilier real). Ruleaza: pnpm seed:inspiration
import { PrismaClient, InspirationColor, ItemSystem, Material, RoomType } from '@prisma/client';

const prisma = new PrismaClient();

// firma-partener careia ii sunt atribuite pozele (apare ca "de Mobila Unicat")
const SOURCE_COMPANY = {
  name: 'Mobila Unicat',
  // CUI/RegCom necunoscute aici — adminul le poate completa la onboarding real
  cui: 'N/A',
  regComNumber: 'N/A',
  addressText: 'Soseaua Chitilei 14, Sector 1, Bucuresti',
  county: 'Bucuresti',
  city: 'Bucuresti',
  lat: 44.4795,
  lng: 26.0334,
};

const CDN = 'https://cdn.prod.website-files.com/60c4bb3c4288c6dd046e1d07';
const SITE = 'https://www.mobilaunicat.ro/locuinta';

type Pin = {
  title: string;
  roomType: RoomType;
  // fisierul de pe CDN-ul Webflow al mobilaunicat.ro
  img: string;
  // slug-ul proiectului-sursa de pe site-ul lor
  project: string;
  colors: InspirationColor[];
  materials: Material[];
  systems: ItemSystem[];
  featured?: boolean;
};

// Etichetele (camera/culori/materiale/deschidere) au fost puse VIZUAL, poza cu
// poza, ca filtrele galeriei sa dea rezultate corecte — nu le regenera orbeste.
const PINS: Pin[] = [
  // --- apartament-10020 ---
  { title: 'Living cu mobilier din stejar si accente calde', roomType: 'LIVING', project: 'apartament-10020', img: '60cc95a344d7c9861756b36f__MG_8729-min.jpg', colors: ['NATURAL_WOOD', 'BEIGE'], materials: ['PAL'], systems: ['MANER'] },
  { title: 'Mobilier de baie suspendat cu front de lemn', roomType: 'BATHROOM', project: 'apartament-10020', img: '60cc95a722274acbd384a0c3__MG_8749-min.jpg', colors: ['GRAY', 'NATURAL_WOOD'], materials: ['MDF_FURNIR'], systems: ['PUSH'] },
  { title: 'Dormitor cu panou albastru petrol si stejar', roomType: 'BEDROOM', project: 'apartament-10020', img: '60cc95a72a293177c2cddeb8__MG_8795-min.jpg', colors: ['BLUE', 'NATURAL_WOOD'], materials: ['PAL'], systems: ['MANER'] },
  { title: 'Depozitare cu sertare sub scara', roomType: 'HALLWAY', project: 'apartament-10020', img: '60cc95a7e50f53062b9df38d__MG_8819-min.jpg', colors: ['WHITE'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  // --- apartament-10043 ---
  { title: 'Hol cu tapet tropical si masa alba', roomType: 'HALLWAY', project: 'apartament-10043', img: '60f56420a6a1660c18a10cf4_p04.jpg', colors: ['GREEN', 'WHITE'], materials: ['PAL'], systems: ['MANER'] },
  { title: 'Bucatarie alba in L cu perdele mustar', roomType: 'KITCHEN', project: 'apartament-10043', img: '60f56420e98f2b3f5cfba60e_p03.jpg', colors: ['WHITE'], materials: ['MDF_INFOLIAT'], systems: ['MANER'] },
  // --- apartament-10134 ---
  { title: 'Bucatarie alba cu fronturi verzi', roomType: 'KITCHEN', project: 'apartament-10134', img: '60f571d23d076113eadb2110_A-04-8-min.jpg', colors: ['WHITE', 'GREEN'], materials: ['MDF_VOPSIT'], systems: ['MANER'] },
  { title: 'Living cu perete verde si mobilier alb', roomType: 'LIVING', project: 'apartament-10134', img: '60f571d2488cbb2efee85e08_A-04-16-min.jpg', colors: ['GREEN', 'GRAY'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Dormitor cu tablie tapitata bej', roomType: 'BEDROOM', project: 'apartament-10134', img: '60f571d25d007b87be2de522_A-04-35-min.jpg', colors: ['BEIGE'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  { title: 'Dressing deschis cu rafturi albe', roomType: 'DRESSING', project: 'apartament-10134', img: '60f571d272940c13b8888f65_A-04-24-min.jpg', colors: ['WHITE'], materials: ['PAL'], systems: ['MANER'] },
  { title: 'Cuier verde cu oglinzi rotunde', roomType: 'HALLWAY', project: 'apartament-10134', img: '60f571d272940cb4cb888f64_A-04-10-min.jpg', colors: ['GREEN', 'NATURAL_WOOD'], materials: ['PAL'], systems: ['PUSH'] },
  // --- apartament-10342 ---
  { title: 'Mobilier de hol alb cu stejar', roomType: 'HALLWAY', project: 'apartament-10342', img: '619cdbbe75d870c5f87da9c2_3-min.jpg', colors: ['WHITE', 'NATURAL_WOOD', 'YELLOW'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Living cu birou integrat si fresca pictata', roomType: 'LIVING', project: 'apartament-10342', img: '619cdbbe85a3c96562d77c42_5-min.jpg', colors: ['GRAY', 'MULTICOLOR'], materials: ['PAL'], systems: ['MANER'] },
  // --- apartament-10564 ---
  { title: 'Birou de acasa cu paravan din sipci', roomType: 'OFFICE', project: 'apartament-10564', img: '61289ccc114306d534848566_Living%20room-min.jpg', colors: ['NATURAL_WOOD', 'WHITE'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Camera copilului in albastru', roomType: 'BEDROOM', project: 'apartament-10564', img: '61289cd71e6a8c736b04171b__MG_0034-min.jpg', colors: ['BLUE', 'WHITE'], materials: ['MDF_VOPSIT'], systems: ['MANER'] },
  { title: 'Bucatarie alba cu corpuri din lemn', roomType: 'KITCHEN', project: 'apartament-10564', img: '61289cd7969db04034ed0d82_s1d-min.jpg', colors: ['WHITE', 'NATURAL_WOOD'], materials: ['MDF_VOPSIT', 'PAL'], systems: ['MANER'], featured: true },
  { title: 'Camera copiilor cu covor multicolor', roomType: 'BEDROOM', project: 'apartament-10564', img: '61289cd7b587b1d21db5c8ae__MG_0036-min.jpg', colors: ['BLUE', 'MULTICOLOR'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  { title: 'Bar de bucatarie cu blat si etajere din lemn', roomType: 'KITCHEN', project: 'apartament-10564', img: '61289cd7ca9fe332e305634e__MG_0033-Recovered-min.jpg', colors: ['WHITE', 'NATURAL_WOOD'], materials: ['LEMN_MASIV', 'MDF_VOPSIT'], systems: ['MANER'] },
  // --- apartament-10623 ---
  { title: 'Cuier alb cu bancuta albastra', roomType: 'HALLWAY', project: 'apartament-10623', img: '61289e7a2e4cd209b0ef20b8__MG_0079-min.jpg', colors: ['WHITE', 'BLUE'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  // --- apartament-10630 ---
  { title: 'Bucatarie neagra cu manere aurii', roomType: 'KITCHEN', project: 'apartament-10630', img: '61bb1e2b0bac79833378c9ab_a56-min.jpg', colors: ['BLACK'], materials: ['MDF_VOPSIT'], systems: ['MANER'], featured: true },
  // --- apartament-2303 ---
  { title: 'Biblioteca alba pe tot peretele', roomType: 'LIVING', project: 'apartament-2303', img: '60cc8f9646fc8053088b6797__MG_5769-min.jpg', colors: ['WHITE', 'MULTICOLOR'], materials: ['MDF_VOPSIT'], systems: [], featured: true },
  { title: 'Pat casuta din lemn pentru copii', roomType: 'BEDROOM', project: 'apartament-2303', img: '60cc8ff186c6e5cb9e5fa0f9_2-min.jpg', colors: ['NATURAL_WOOD'], materials: ['LEMN_MASIV'], systems: ['MANER'] },
  // --- apartament-2311 ---
  { title: 'Dulap cu usi glisante si nisa TV', roomType: 'DRESSING', project: 'apartament-2311', img: '619cdddd6f087ebfea7b37d9_ANCA4-min.jpg', colors: ['NATURAL_WOOD', 'GRAY'], materials: ['PAL'], systems: ['GLISANTE'], featured: true },
  // --- apartament-4290 ---
  { title: 'Bucatarie clasica vopsita crem', roomType: 'KITCHEN', project: 'apartament-4290', img: '60f55d21b4713201078bdb5d_p61.jpg', colors: ['BEIGE'], materials: ['MDF_VOPSIT'], systems: ['MANER'] },
  { title: 'Baie cu consola vintage', roomType: 'BATHROOM', project: 'apartament-4290', img: '60f55d2624a861241a013fc1_p66.jpg', colors: ['BEIGE'], materials: ['LEMN_MASIV'], systems: ['MANER'] },
  { title: 'Blat de baie din lemn masiv', roomType: 'BATHROOM', project: 'apartament-4290', img: '60f55d2634d71956d82b89eb_p67.jpg', colors: ['WHITE', 'NATURAL_WOOD'], materials: ['LEMN_MASIV'], systems: ['MANER'] },
  { title: 'Camera copilului cu pat casuta', roomType: 'BEDROOM', project: 'apartament-4290', img: '60f55d2642eda336bbb7a339_p6123.jpg', colors: ['BLUE', 'NATURAL_WOOD'], materials: ['PAL', 'MDF_INFOLIAT'], systems: ['MANER'] },
  // --- apartament-7288 ---
  { title: 'Comoda TV alba cu canapea verde', roomType: 'LIVING', project: 'apartament-7288', img: '619cdc9f4830e05283f4b714__MG_9992-min.jpg', colors: ['WHITE', 'GREEN', 'NATURAL_WOOD'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Dormitor clasic cu perete din furnir', roomType: 'BEDROOM', project: 'apartament-7288', img: '619cdcb60ac388d1829397ff__MG_0005-min.jpg', colors: ['BROWN'], materials: ['MDF_FURNIR'], systems: ['MANER'] },
  { title: 'Mobilier cu masina de spalat integrata', roomType: 'BATHROOM', project: 'apartament-7288', img: '619cdcb70ac388603b93981e__MG_0034-min.jpg', colors: ['WHITE', 'NATURAL_WOOD'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  { title: 'Bucatarie alba cu blat de lemn masiv', roomType: 'KITCHEN', project: 'apartament-7288', img: '619cdcb72d5013f080a79728__MG_0041-min.jpg', colors: ['WHITE', 'NATURAL_WOOD'], materials: ['MDF_VOPSIT', 'LEMN_MASIV'], systems: ['MANER'] },
  // --- apartament-7328 ---
  { title: 'Perete media crem cu riflaje', roomType: 'LIVING', project: 'apartament-7328', img: '60f55f9ea0bd957fc53004b6_p74.jpg', colors: ['BEIGE', 'GRAY'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  // --- apartament-7642 ---
  { title: 'Bucatarie crem cu lemn deschis', roomType: 'KITCHEN', project: 'apartament-7642', img: '60f578eca4f8649254751e56_IMG_2010-min-min.jpg', colors: ['BEIGE', 'NATURAL_WOOD'], materials: ['PAL'], systems: ['MANER'] },
  { title: 'Living clasic cu nise si canapea alba', roomType: 'LIVING', project: 'apartament-7642', img: '60f57a7819916e04d9b01ff1_IMG_1994-min-min.jpg', colors: ['WHITE', 'BEIGE'], materials: ['MDF_VOPSIT'], systems: ['MANER'] },
  // --- apartament-9003 ---
  { title: 'Comoda alba cu canapea galbena', roomType: 'LIVING', project: 'apartament-9003', img: '60cc98d27200ad08465ea50a__MG_0309-min.jpg', colors: ['YELLOW', 'WHITE'], materials: ['PAL'], systems: ['PUSH'], featured: true },
  { title: 'Perete de dulapuri albe', roomType: 'DRESSING', project: 'apartament-9003', img: '60cc98eeb0a237457b9dc1c9__MG_0337-min.jpg', colors: ['WHITE'], materials: ['MDF_INFOLIAT'], systems: ['PUSH'] },
  { title: 'Dormitor cu canapea galbena', roomType: 'BEDROOM', project: 'apartament-9003', img: '60cc98ef22274a530e84afea__MG_0306-min.jpg', colors: ['YELLOW', 'BLUE'], materials: ['PAL'], systems: ['PUSH'] },
  // --- apartament-9564 ---
  { title: 'Bucatarie alba mata cu lemn inchis', roomType: 'KITCHEN', project: 'apartament-9564', img: '619cdf628cd720198e5e6492_a1-min.jpg', colors: ['WHITE', 'BROWN'], materials: ['MDF_VOPSIT'], systems: ['PUSH', 'GOLA'] },
  { title: 'Hol cu bancuta si cosuri de ratan', roomType: 'HALLWAY', project: 'apartament-9564', img: '619cdf7e75d870658c7dc38b_bfd-min.jpg', colors: ['WHITE'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Colt de birou cu tabla de scris', roomType: 'OFFICE', project: 'apartament-9564', img: '619cdf7eb263b6cd5a5dbe1e_cd-min.jpg', colors: ['GRAY', 'RED'], materials: ['PAL'], systems: ['PUSH'] },
  // --- proiect-10635 ---
  { title: 'Bucatarie neagra cu insula de marmura', roomType: 'KITCHEN', project: 'proiect-10635', img: '61d6f5f0b85a4b18201229a7_ppggg-min.jpg', colors: ['BLACK', 'GRAY'], materials: ['MDF_VOPSIT'], systems: ['GOLA', 'AVENTOS'], featured: true },
  { title: 'Dormitor cu pat petrol si perete geometric', roomType: 'BEDROOM', project: 'proiect-10635', img: '61d6f5fa28804833e181242e_One%20Eliade%20T1-12-min.jpg', colors: ['BLUE', 'GRAY'], materials: ['MDF_FURNIR'], systems: ['PUSH'] },
  // --- proiect-10698 ---
  { title: 'Dulap de hol bleu, stil clasic', roomType: 'HALLWAY', project: 'proiect-10698', img: '62c6ad4b280efc4af23bb43e__MG_9400%20copy-min.jpg', colors: ['BLUE'], materials: ['MDF_VOPSIT'], systems: ['MANER'] },
  { title: 'Biblioteca clasica crem cu TV', roomType: 'LIVING', project: 'proiect-10698', img: '62c6ad4b280efc66f63bb446__MG_9383%20copy-min.jpg', colors: ['BEIGE'], materials: ['MDF_VOPSIT'], systems: ['MANER'] },
  // --- proiect-10712 ---
  { title: 'Living cu riflaje verzi si canapea teracota', roomType: 'LIVING', project: 'proiect-10712', img: '632982332421a62d26c8c4c7_Living-min.jpg', colors: ['GREEN', 'RED'], materials: ['MDF_FURNIR'], systems: [], featured: true },
  // --- proiect-10863 (spatii de birouri) ---
  { title: 'Sala de training cu scaune galbene', roomType: 'OFFICE', project: 'proiect-10863', img: '636915715089973c8ebac90b_DSC_4633-min.png', colors: ['BLACK', 'YELLOW'], materials: ['PAL'], systems: ['MANER'] },
  { title: 'Lounge de birou cu canapele petrol', roomType: 'OFFICE', project: 'proiect-10863', img: '636915717bdfad75d8a9bed5_DSC_4657-min.png', colors: ['GREEN', 'YELLOW'], materials: ['PAL'], systems: [] },
  // --- proiect-10930 ---
  { title: 'Dressing walk-in din stejar cu LED', roomType: 'DRESSING', project: 'proiect-10930', img: '64bfda482655df9626749523__MG_2079-min.jpg', colors: ['NATURAL_WOOD'], materials: ['MDF_FURNIR'], systems: ['GLISANTE'], featured: true },
  { title: 'Dormitor cu panou din sipci de lemn', roomType: 'BEDROOM', project: 'proiect-10930', img: '64bfda84ae2c07d0914599cb__MG_2068-min.jpg', colors: ['NATURAL_WOOD', 'GRAY'], materials: ['MDF_FURNIR'], systems: ['PUSH'] },
  { title: 'Dulap gri cu manere frezate', roomType: 'DRESSING', project: 'proiect-10930', img: '64bfdb83a425d59dde9190ee__MG_2117-min.jpg', colors: ['GRAY'], materials: ['MDF_VOPSIT'], systems: ['MANER'] },
  // --- proiect-11011 ---
  { title: 'Living cu bucatarie verde si canapea cognac', roomType: 'LIVING', project: 'proiect-11011', img: '65c90cc852c798105c4a800f_livinglivIMG_0834.jpg', colors: ['GREEN', 'BROWN'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  { title: 'Dormitor cu pat teracota si usa glisanta', roomType: 'BEDROOM', project: 'proiect-11011', img: '65c90ccd41307db45d561beb_dorm%20matrimonialmodifica-min.jpg', colors: ['RED', 'GRAY'], materials: ['MDF_VOPSIT'], systems: ['GLISANTE'] },
  { title: 'Bucatarie verde salvie cu accente cupru', roomType: 'KITCHEN', project: 'proiect-11011', img: '65c90ccd5358e5ac623faf17_livinglivmodif-min.jpg', colors: ['GREEN', 'WHITE'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  // --- proiect-11044 ---
  { title: 'Dulap alb cu nisa TV in dormitor', roomType: 'BEDROOM', project: 'proiect-11044', img: '65c9087a4ccb405f868b3d8b__RGC6906-HDR.jpg', colors: ['WHITE'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Dormitor bej cu noptiere riflate negre', roomType: 'BEDROOM', project: 'proiect-11044', img: '65c9087f6a04bc152d6bdaeb__RGC6913-min.jpg', colors: ['BEIGE', 'BLACK'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  // --- proiect-11047 ---
  { title: 'Perete TV cu riflaje de stejar', roomType: 'LIVING', project: 'proiect-11047', img: '663b998cd143b35ccf0c0a4a_213123-min.png', colors: ['NATURAL_WOOD'], materials: ['MDF_FURNIR'], systems: ['PUSH'] },
  { title: 'Birou integrat in dulap alb', roomType: 'OFFICE', project: 'proiect-11047', img: '663b998f2b107c7f925cdba9__MG_4232-min.png', colors: ['WHITE', 'NATURAL_WOOD'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Dulap cu fronturi de sticla fumurie', roomType: 'DRESSING', project: 'proiect-11047', img: '663b998f386581473c5e6ae7__MG_4248-min.png', colors: ['BROWN', 'NATURAL_WOOD'], materials: ['MDF_FURNIR'], systems: ['GLISANTE'] },
  { title: 'Biblioteca alba langa dining', roomType: 'LIVING', project: 'proiect-11047', img: '663b998f42b10f76153d6128__MG_4270-min.png', colors: ['WHITE'], materials: ['MDF_VOPSIT'], systems: [] },
  // --- proiect-11053 ---
  { title: 'Vitrina de dressing cu rama neagra', roomType: 'DRESSING', project: 'proiect-11053', img: '688a230b14eccd4a64e5d4ef__MG_5062-min.png', colors: ['NATURAL_WOOD', 'BLACK'], materials: ['MDF_FURNIR'], systems: ['MANER'] },
  { title: 'Dormitor cu dulapuri albe pe tot peretele', roomType: 'BEDROOM', project: 'proiect-11053', img: '688a230b3a9873bc4ac6be36__MG_5053-min.png', colors: ['WHITE', 'GREEN'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Bucatarie gri deschis fara manere', roomType: 'KITCHEN', project: 'proiect-11053', img: '688a230b4b50ae9ac2fbdf00__MG_5007-min.png', colors: ['GRAY', 'WHITE'], materials: ['MDF_VOPSIT'], systems: ['GOLA'] },
  { title: 'Insula de bucatarie cu blat in trepte', roomType: 'KITCHEN', project: 'proiect-11053', img: '688a230b57c24a5b44a8bae8__MG_5010-min.png', colors: ['GRAY', 'WHITE'], materials: ['MDF_VOPSIT'], systems: ['PUSH', 'AVENTOS'] },
  // --- proiect-11055 ---
  { title: 'Living antracit cu accente galbene', roomType: 'LIVING', project: 'proiect-11055', img: '67128eeac409d9f6f70fbe7c_123-min.png', colors: ['GRAY', 'BLACK', 'YELLOW'], materials: ['MDF_VOPSIT'], systems: ['PUSH'] },
  { title: 'Dormitor antracit cu benzi LED', roomType: 'BEDROOM', project: 'proiect-11055', img: '67128f0a357ef468cf3d102f__MG_4935-min.png', colors: ['BLACK', 'GRAY'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Hol antracit cu nisa de spalatorie', roomType: 'HALLWAY', project: 'proiect-11055', img: '67128f0a47a508f72a727df3__MG_4910-min.png', colors: ['BLACK', 'GRAY'], materials: ['PAL'], systems: ['PUSH'] },
  { title: 'Bucatarie antracit cu stejar', roomType: 'KITCHEN', project: 'proiect-11055', img: '67128f0a8887efb8c31c98b6__MG_4908-min.png', colors: ['BLACK', 'NATURAL_WOOD'], materials: ['PAL'], systems: ['PUSH'] },
  // --- proiect-15311 ---
  { title: 'Perete TV cu piatra si finisaje calde', roomType: 'LIVING', project: 'proiect-15311', img: '697bb2602ffc7c1c50eeacb0__MG_7414%201.png', colors: ['BEIGE', 'NATURAL_WOOD'], materials: ['MDF_FURNIR'], systems: ['PUSH'], featured: true },
  { title: 'Bucatarie alba cu insula si parchet chevron', roomType: 'KITCHEN', project: 'proiect-15311', img: '697bb2694cd704616f2058ab__MG_7387%201.png', colors: ['WHITE'], materials: ['MDF_VOPSIT'], systems: ['GOLA', 'AVENTOS'] },
  // --- vinarie-bucuresti ---
  { title: 'Crama cu rafturi din lemn masiv', roomType: 'PANTRY', project: 'vinarie-bucuresti', img: '60f5cb8f7628f60bf79f08c9_A24-2-min.jpg', colors: ['BROWN'], materials: ['LEMN_MASIV'], systems: [] },
];

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
