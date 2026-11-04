import { PrismaClient } from '@prisma/client';
import { MOVABLE_HOLIDAYS } from '../src/infra/calendar/movable-holidays';

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
  // piese individuale (tab separat in configurator, fara camera dedicata);
  // din 2026-07 = fallback "Alta piesa" cu formular liber
  { key: 'ROOM_TYPE', option: 'PIECES', weight: 1 },
  // camere noi (2026-07, decizie PO) — ponderi propuse, ajustabile din Admin
  { key: 'ROOM_TYPE', option: 'HALLWAY', weight: 3 },
  { key: 'ROOM_TYPE', option: 'LAUNDRY', weight: 2 },
  { key: 'ROOM_TYPE', option: 'PANTRY', weight: 2 },
  { key: 'ROOM_TYPE', option: 'BALCONY', weight: 2 },
  // piese ghidate individuale (2026-07) — flow propriu per piesa
  { key: 'ROOM_TYPE', option: 'PIECE_WARDROBE', weight: 3 },
  { key: 'ROOM_TYPE', option: 'PIECE_TV_UNIT', weight: 2 },
  { key: 'ROOM_TYPE', option: 'PIECE_BOOKCASE', weight: 2 },
  { key: 'ROOM_TYPE', option: 'PIECE_DESK', weight: 2 },
  { key: 'ROOM_TYPE', option: 'PIECE_BED', weight: 2 },
  { key: 'ROOM_TYPE', option: 'PIECE_DRESSER', weight: 1 },
  { key: 'ROOM_TYPE', option: 'PIECE_TABLE', weight: 1 },
  { key: 'ROOM_TYPE', option: 'PIECE_SHOE_CABINET', weight: 1 },
  { key: 'ROOM_TYPE', option: 'PIECE_NIGHTSTAND', weight: 1 },
  { key: 'ROOM_TYPE', option: 'PIECE_BENCH', weight: 1 },
  // ROOM_SIZE (metri liniari = length_m)
  { key: 'ROOM_SIZE', option: 'UNDER_2M', weight: 1 },
  { key: 'ROOM_SIZE', option: 'FROM_2_TO_4M', weight: 3 },
  { key: 'ROOM_SIZE', option: 'OVER_4M', weight: 5 },
  // MATERIAL (extindere 2026-07-08: variante MDF + ALTUL; MDF simplu ramane legacy)
  { key: 'MATERIAL', option: 'PAL', weight: 1 },
  { key: 'MATERIAL', option: 'MDF', weight: 2 },
  { key: 'MATERIAL', option: 'MDF_INFOLIAT', weight: 2 },
  { key: 'MATERIAL', option: 'MDF_VOPSIT', weight: 3 },
  { key: 'MATERIAL', option: 'MDF_FURNIR', weight: 3 },
  { key: 'MATERIAL', option: 'LEMN_MASIV', weight: 4 },
  { key: 'MATERIAL', option: 'ALTUL', weight: 2 },
  // SYSTEM (extindere 2026-07-08: MANER/GOLA/AVENTOS; BUTON_PRESIUNE ramane legacy)
  { key: 'SYSTEM', option: 'BUTON_PRESIUNE', weight: 1 },
  { key: 'SYSTEM', option: 'MANER', weight: 1 },
  { key: 'SYSTEM', option: 'PUSH', weight: 2 },
  { key: 'SYSTEM', option: 'GLISANTE', weight: 3 },
  { key: 'SYSTEM', option: 'GOLA', weight: 3 },
  { key: 'SYSTEM', option: 'AVENTOS', weight: 3 },
  // ITEM_QUANTITY (per camera)
  { key: 'ITEM_QUANTITY', option: 'QTY_1', weight: 0 },
  { key: 'ITEM_QUANTITY', option: 'QTY_2_3', weight: 2 },
  { key: 'ITEM_QUANTITY', option: 'QTY_4_PLUS', weight: 4 },
  // PAID_DESIGN
  { key: 'PAID_DESIGN', option: 'YES', weight: 2 },
  // Configurator — scoring per raspuns (referite din flow config prin ScoringRef)
  { key: 'KITCHEN_LAYOUT', option: 'STRAIGHT', weight: 1 },
  { key: 'KITCHEN_LAYOUT', option: 'L_SHAPE', weight: 2 },
  { key: 'KITCHEN_LAYOUT', option: 'U_SHAPE', weight: 3 },
  { key: 'KITCHEN_LAYOUT', option: 'PARALLEL', weight: 2 },
  { key: 'KITCHEN_ISLAND', option: 'YES', weight: 2 },
  // Configurator 2026-07 — categorii noi referite din flow-urile v2 + piese ghidate
  { key: 'DRESSING_LAYOUT', option: 'LINEAR', weight: 1 },
  { key: 'DRESSING_LAYOUT', option: 'L_SHAPE', weight: 2 },
  { key: 'DRESSING_LAYOUT', option: 'U_SHAPE', weight: 3 },
  { key: 'DRESSING_LAYOUT', option: 'WALK_IN', weight: 3 },
  { key: 'WARDROBE_TO_CEILING', option: 'YES', weight: 1 },
  { key: 'TV_MEDIA_WALL', option: 'YES', weight: 2 },
  { key: 'BED_STORAGE', option: 'LIFT_UP', weight: 1 },
  { key: 'BED_STORAGE', option: 'DRAWERS', weight: 1 },
  { key: 'TABLE_EXTENDABLE', option: 'YES', weight: 1 },
  // placeholder admin: blatul nu puncteaza in seed, dar e ajustabil fara deploy
  { key: 'KITCHEN_COUNTERTOP', option: 'LAMINATE', weight: 0 },
  { key: 'KITCHEN_COUNTERTOP', option: 'QUARTZ', weight: 0 },
  { key: 'KITCHEN_COUNTERTOP', option: 'GRANITE', weight: 0 },
  { key: 'KITCHEN_COUNTERTOP', option: 'WOOD', weight: 0 },
  // optiunile v2 din 2026-07-08 (PAL/HPL); LAMINATE/WOOD raman pentru kitchen v1
  { key: 'KITCHEN_COUNTERTOP', option: 'PAL', weight: 0 },
  { key: 'KITCHEN_COUNTERTOP', option: 'HPL', weight: 0 },
  // BUDGET
  { key: 'BUDGET', option: 'UNDER_5K', weight: 1 },
  { key: 'BUDGET', option: 'FROM_5K_TO_15K', weight: 3 },
  { key: 'BUDGET', option: 'OVER_15K', weight: 5 },
  // buget nedivulgat: nu influenteaza scorul
  { key: 'BUDGET', option: 'UNDISCLOSED', weight: 0 },
];

// PO r5 (2026-07-13): creditCost de pe praguri NU se mai foloseste la costul
// cererii (1 credit = 1.000 lei din bugetul minim estimat, vezi SizingService).
// Pragurile raman doar pentru clasificarea S/M/L (SLA, filtre marketplace).
// E-admin-platform-14: coloana legacy credit_cost e nullable si nu se mai scrie
// (DROP COLUMN = release separat, dupa decizia PO).
const THRESHOLDS: {
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  minScore: number;
  maxScore: number | null;
}[] = [
  { size: 'SMALL', minScore: 0, maxScore: 14 },
  { size: 'MEDIUM', minScore: 15, maxScore: 29 },
  { size: 'LARGE', minScore: 30, maxScore: null },
];

// docs/04 §5.3 + 4.10/4.16 — planuri abonament (seed initial, configurabil din Admin).
// E-admin-platform-58: identitatea = code (egal cu tier-ul legacy pentru cele 3 planuri seed-uite).
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

// docs/02 §3.3 — sarbatori mobile RO (Paste ortodox + Rusalii): lista unica in
// src/infra/calendar/movable-holidays.ts (aplicata si prin migrare in toate mediile).
// isWorkingDay=false. Adminul poate adauga/override (punti) ulterior.

// docs/04 §5.2 + 4.16 / Î8 — pachete top-up credite (discount progresiv).
const CREDIT_PACKAGES: { credits: number; priceRon: number }[] = [
  { credits: 10, priceRon: 100 },
  { credits: 50, priceRon: 400 },
  { credits: 100, priceRon: 700 },
];

// docs/04 §5.4 — chei system_settings (seed). Toate stocate ca string.
const SYSTEM_SETTINGS: Record<string, string> = {
  // 4.17 — date furnizor (platforma) pentru facturile RO + serie factura.
  // E-admin-platform-4: goale - adminul completeaza datele reale in Admin -> Setari -> Date fiscale; pana atunci cumpararile/confirmarile raspund 503 BILLING_NOT_CONFIGURED
  seller_name: '',
  seller_cui: '',
  seller_reg_com: '',
  seller_address: '',
  seller_iban: '',
  // E-admin-platform-2: contact juridic/GDPR + publicarea identitatii operatorului (seller_*) in Termeni/Politica/footer. 'false' pana cand PO completeaza datele reale.
  legal_contact_email: '',
  legal_identity_published: 'false',
  // Hotfix 2026-10-04 (PO): re-acceptarea Termenilor pentru conturile existente — OPRITA pana la
  // revizuirea avocatului; conturile noi accepta la inregistrare.
  legal_reaccept_existing_users: 'false',
  invoice_series: 'MM',
  quote_validity_default_days: '14',
  consultation_invite_expiry_days: '7',
  company_penalty_threshold: '12',
  company_suspension_months: '6',
  eur_ron_rate: '5.2',
  vat_rate: '21',
  trial_enabled: 'true',
  trial_plan: 'GOLD',
  trial_duration_days: '30',
  trial_bonus_credits: '10',
  max_claims_per_request: '3',
  // E-admin-platform-10: cererea ramane claimabila dupa prima oferta — OPRIT pana la decizia
  // PO (invarianta 3.1).
  claims_open_after_first_offer: 'false',
  // E-company-3: contactele clientului la claim (W1) si fara prag dupa livrare — pana la
  // decizia PO (DECIZIE NECESARA).
  claim_contact_reveal_policy: 'ON_CLAIM',
  completed_claim_contact_retention_days: '0',
  // E-admin-platform-45: telefon/email/link in texte libere — MASK (ascuns firmelor fara
  // acces) pana la decizia PO (DECIZIE NECESARA); BLOCK = publicare refuzata.
  pre_claim_contact_text_policy: 'MASK',
  // E-client-9: distanta pre-claim (KM | BAND), plafon locatii firma si schimbari pe 24h —
  // pana la decizia PO (DECIZIE NECESARA).
  marketplace_distance_display: 'KM',
  company_locations_max: '10',
  company_location_changes_per_day: '20',
  // E-company-21: costul unei preluari (PO r5 V1: 1 credit = 1000 lei din bugetul minim);
  // minim 1, fara plafon (0) pana la decizia PO (DECIZIE NECESARA: valorile min/max).
  credit_value_ron: '1000',
  claim_cost_min: '1',
  claim_cost_max: '0',
  // E-admin-platform-3: inchiderea automata a ofertelor expirate fara decizie — OPRITA pana
  // la decizia PO (zile placeholder, rezultat credite UNSET = procesor no-op).
  expired_offer_autoclose_enabled: 'false',
  expired_offer_autoclose_days: '14',
  expired_offer_autoclose_credit_outcome: 'UNSET',
  // reminder firma inainte de data de livrare din oferta acceptata (zile calendaristice)
  delivery_reminder_days_before: '3',
  // E-company-24 DECIZIE NECESARA PO: 0 = oprit (reminder / anulare automata comenzi transfer bancar)
  bank_transfer_reminder_days: '0',
  bank_transfer_expiry_days: '0',
};

async function main() {
  for (const c of SIZING_CONFIG) {
    await prisma.projectSizingConfig.upsert({
      where: { key_option: { key: c.key, option: c.option } },
      // ponderile sunt editabile din Admin -> Marime proiect; re-seed nu le suprascrie
      update: {},
      create: c,
    });
  }
  for (const t of THRESHOLDS) {
    await prisma.projectSizeThreshold.upsert({
      where: { size: t.size },
      update: { minScore: t.minScore, maxScore: t.maxScore },
      create: t,
    });
  }
  for (const p of SUBSCRIPTION_PLANS) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: { code: p.tier },
      update: {
        tier: p.tier,
        priceRon: p.priceRon,
        includedCredits: p.includedCredits,
        marketplaceGatingDelayMin: p.marketplaceGatingDelayMin,
      },
      create: { ...p, code: p.tier },
    });
    // E-admin-platform-58: planurile seed-uite dau acces la marketplace (ca inainte de functii);
    // update gol = nu suprascriem o alegere facuta din Admin
    await prisma.subscriptionPlanFeature.upsert({
      where: { planId_featureKey: { planId: plan.id, featureKey: 'MARKETPLACE_ACCESS' } },
      update: {},
      create: { planId: plan.id, featureKey: 'MARKETPLACE_ACCESS', enabled: true },
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
