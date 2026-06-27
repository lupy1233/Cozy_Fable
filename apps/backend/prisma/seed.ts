import { PrismaClient } from '@prisma/client';

// Seed config scoring proiect (docs/sprint-0 §7). Idempotent (upsert).
const prisma = new PrismaClient();

// key = dimensiunea scorata; option = valoarea posibila; weight = scorul adaugat.
const SIZING_CONFIG: { key: string; option: string; weight: number }[] = [
  // ROOM_TYPE
  { key: 'ROOM_TYPE', option: 'KITCHEN', weight: 8 },
  { key: 'ROOM_TYPE', option: 'DRESSING', weight: 6 },
  { key: 'ROOM_TYPE', option: 'LIVING', weight: 5 },
  { key: 'ROOM_TYPE', option: 'BEDROOM', weight: 4 },
  { key: 'ROOM_TYPE', option: 'OFFICE', weight: 3 },
  { key: 'ROOM_TYPE', option: 'BATHROOM', weight: 3 },
  // ROOM_SIZE (metri liniari = length_m)
  { key: 'ROOM_SIZE', option: 'UNDER_2M', weight: 1 },
  { key: 'ROOM_SIZE', option: 'FROM_2_TO_4M', weight: 3 },
  { key: 'ROOM_SIZE', option: 'OVER_4M', weight: 5 },
  // MATERIAL
  { key: 'MATERIAL', option: 'PAL', weight: 1 },
  { key: 'MATERIAL', option: 'MDF', weight: 2 },
  { key: 'MATERIAL', option: 'LEMN_MASIV', weight: 4 },
  // SYSTEM
  { key: 'SYSTEM', option: 'BUTON_PRESIUNE', weight: 1 },
  { key: 'SYSTEM', option: 'PUSH', weight: 2 },
  { key: 'SYSTEM', option: 'GLISANTE', weight: 3 },
  // ITEM_QUANTITY (per camera)
  { key: 'ITEM_QUANTITY', option: 'QTY_1', weight: 0 },
  { key: 'ITEM_QUANTITY', option: 'QTY_2_3', weight: 2 },
  { key: 'ITEM_QUANTITY', option: 'QTY_4_PLUS', weight: 4 },
  // PAID_DESIGN
  { key: 'PAID_DESIGN', option: 'YES', weight: 2 },
  // BUDGET
  { key: 'BUDGET', option: 'UNDER_5K', weight: 1 },
  { key: 'BUDGET', option: 'FROM_5K_TO_15K', weight: 3 },
  { key: 'BUDGET', option: 'OVER_15K', weight: 5 },
];

const THRESHOLDS: {
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  minScore: number;
  maxScore: number | null;
  creditCost: number;
}[] = [
  { size: 'SMALL', minScore: 0, maxScore: 14, creditCost: 1 },
  { size: 'MEDIUM', minScore: 15, maxScore: 29, creditCost: 2 },
  { size: 'LARGE', minScore: 30, maxScore: null, creditCost: 4 },
];

// docs/04 §5.3 + 4.10/4.16 — planuri abonament (seed initial, configurabil din Admin).
const SUBSCRIPTION_PLANS: {
  tier: 'SILVER' | 'GOLD' | 'PLATINUM';
  priceRon: number;
  includedCredits: number;
  marketplaceGatingDelayMin: number;
}[] = [
  { tier: 'SILVER', priceRon: 149, includedCredits: 15, marketplaceGatingDelayMin: 60 },
  { tier: 'GOLD', priceRon: 399, includedCredits: 50, marketplaceGatingDelayMin: 30 },
  { tier: 'PLATINUM', priceRon: 899, includedCredits: 120, marketplaceGatingDelayMin: 0 },
];

// docs/04 §5.2 + 4.12 — reguli penalizare (cele 3 abateri MVP). Configurabile din Admin.
const PENALTY_RULES: { ruleKey: string; points: number }[] = [
  { ruleKey: 'SLA_MISS', points: 3 }, // oferta expirata / SLA ratat individual
  { ruleKey: 'MASS_SLA_MISS', points: 3 }, // toate firmele rateaza SLA (per firma)
  { ruleKey: 'VOLUNTARY_WITHDRAWAL', points: 2 }, // retragere voluntara dupa gratia de 30 min
];

// docs/02 §3.3 — sarbatori mobile RO (Paste ortodox + Rusalii), zile lucratoare care devin
// libere, 2025–2028. isWorkingDay=false. Adminul poate adauga/override (punti) ulterior.
const MOVABLE_HOLIDAYS: { date: string; name: string }[] = [
  { date: '2025-04-18', name: 'Vinerea Mare' },
  { date: '2025-04-21', name: 'A doua zi de Paste' },
  { date: '2025-06-09', name: 'A doua zi de Rusalii' },
  { date: '2026-04-10', name: 'Vinerea Mare' },
  { date: '2026-04-13', name: 'A doua zi de Paste' },
  { date: '2026-06-01', name: 'A doua zi de Rusalii' },
  { date: '2027-04-30', name: 'Vinerea Mare' },
  { date: '2027-05-03', name: 'A doua zi de Paste' },
  { date: '2027-06-21', name: 'A doua zi de Rusalii' },
  { date: '2028-04-14', name: 'Vinerea Mare' },
  { date: '2028-04-17', name: 'A doua zi de Paste' },
  { date: '2028-06-05', name: 'A doua zi de Rusalii' },
];

// docs/04 §5.2 + 4.16 / Î8 — pachete top-up credite (discount progresiv).
const CREDIT_PACKAGES: { credits: number; priceRon: number }[] = [
  { credits: 10, priceRon: 100 },
  { credits: 50, priceRon: 400 },
  { credits: 100, priceRon: 700 },
];

// docs/04 §5.4 — chei system_settings (seed). Toate stocate ca string.
const SYSTEM_SETTINGS: Record<string, string> = {
  // 4.17 — date furnizor (platforma) pentru facturile mock RO + serie factura.
  seller_name: 'Marketplace Mobilier SRL',
  seller_cui: 'RO12345678',
  seller_reg_com: 'J40/1234/2020',
  seller_address: 'Str. Exemplu nr. 1, Bucuresti, Romania',
  seller_iban: 'RO49AAAA1B31007593840000',
  invoice_series: 'MM',
  quote_validity_default_days: '14',
  consultation_invite_expiry_days: '7',
  employee_penalty_threshold: '9',
  employee_block_months: '3',
  company_penalty_threshold: '12',
  company_suspension_months: '6',
  eur_ron_rate: '5.2',
  vat_rate: '21',
  trial_enabled: 'true',
  trial_plan: 'GOLD',
  trial_duration_days: '30',
  trial_bonus_credits: '10',
  max_claims_per_request: '3',
};

async function main() {
  for (const c of SIZING_CONFIG) {
    await prisma.projectSizingConfig.upsert({
      where: { key_option: { key: c.key, option: c.option } },
      update: { weight: c.weight },
      create: c,
    });
  }
  for (const t of THRESHOLDS) {
    await prisma.projectSizeThreshold.upsert({
      where: { size: t.size },
      update: { minScore: t.minScore, maxScore: t.maxScore, creditCost: t.creditCost },
      create: t,
    });
  }
  for (const p of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { tier: p.tier },
      update: {
        priceRon: p.priceRon,
        includedCredits: p.includedCredits,
        marketplaceGatingDelayMin: p.marketplaceGatingDelayMin,
      },
      create: p,
    });
  }
  for (const [key, value] of Object.entries(SYSTEM_SETTINGS)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {}, // nu suprascriem valori ajustate din Admin
      create: { key, value },
    });
  }
  for (const r of PENALTY_RULES) {
    await prisma.penaltyRule.upsert({
      where: { ruleKey: r.ruleKey },
      update: { points: r.points },
      create: r,
    });
  }
  for (const h of MOVABLE_HOLIDAYS) {
    const date = new Date(`${h.date}T00:00:00.000Z`);
    await prisma.businessCalendarHoliday.upsert({
      where: { date },
      update: { name: h.name },
      create: { date, name: h.name, isWorkingDay: false },
    });
  }
  // credit_packages — fara cheie naturala unica; seed idempotent prin (credits, priceRon).
  for (const p of CREDIT_PACKAGES) {
    const existing = await prisma.creditPackage.findFirst({
      where: { credits: p.credits, priceRon: p.priceRon },
    });
    if (!existing) await prisma.creditPackage.create({ data: p });
  }
  console.log(
    `Seed: ${SIZING_CONFIG.length} config, ${THRESHOLDS.length} thresholds, ` +
      `${SUBSCRIPTION_PLANS.length} plans, ${Object.keys(SYSTEM_SETTINGS).length} settings, ` +
      `${PENALTY_RULES.length} penalty rules, ${MOVABLE_HOLIDAYS.length} holidays, ` +
      `${CREDIT_PACKAGES.length} credit packages.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
