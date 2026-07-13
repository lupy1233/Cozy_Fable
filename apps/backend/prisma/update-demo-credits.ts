import { PrismaClient } from '@prisma/client';

// One-off PO r5 (2026-07-13), rulat pe prod via `railway run --service Postgres`:
//  1. toate firmele demo (owner cu email @demo.ro) primesc 200 de credite libere
//     (balance = 200; reserved ramane neatins — claim-urile active isi pastreaza rezervarea);
//  2. cererile deja publicate trec pe noua formula de cost:
//     1 credit = 1.000 lei din bugetul minim estimat ≈ size_score (minim 1).
//     Snapshot-urile claim-urilor existente NU se rescriu (istoric).
const prisma = new PrismaClient();

async function main() {
  const demoCompanies = await prisma.company.findMany({
    where: { members: { some: { user: { email: { endsWith: '@demo.ro' } } } } },
    select: { id: true, name: true },
  });
  for (const c of demoCompanies) {
    await prisma.companyCreditWallet.upsert({
      where: { companyId: c.id },
      update: { balance: 200 },
      create: { companyId: c.id, balance: 200, reserved: 0 },
    });
    console.log(`wallet 200 credite → ${c.name}`);
  }

  // size_score stocat = scorul TOTAL (camere + BUDGET + PAID_DESIGN); costul nou
  // se bazeaza pe scorul de BAZA → scadem inapoi ponderile de buget/design ale
  // fiecarei cereri, cu greutatile curente din project_sizing_config.
  const config = await prisma.projectSizingConfig.findMany();
  const w = (key: string, option: string) =>
    config.find((c) => c.key === key && c.option === option)?.weight ?? 0;
  const requests = await prisma.request.findMany({
    where: { sizeScore: { not: null } },
    select: { id: true, sizeScore: true, budgetRange: true, includesPaidDesign: true },
  });
  for (const r of requests) {
    const baseScore =
      (r.sizeScore ?? 0) -
      (r.budgetRange ? w('BUDGET', r.budgetRange) : 0) -
      (r.includesPaidDesign ? w('PAID_DESIGN', 'YES') : 0);
    await prisma.request.update({
      where: { id: r.id },
      data: { creditCost: Math.max(1, baseScore) },
    });
  }
  console.log(`firme demo: ${demoCompanies.length} · cereri cu cost recalculat: ${requests.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
