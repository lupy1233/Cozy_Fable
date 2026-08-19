// Seed demo numit (docs/06 §7) — date realiste pentru demo end-to-end.
// Idempotent: daca admin@demo.ro exista, nu mai ruleaza. Ruleaza pe DB cu config seed-uit
// (DEMO_PASSWORD=... pnpm -F backend exec tsx prisma/seed-demo.ts).
// DOAR pentru dev/demo: in productie refuza fara ALLOW_DEMO_SEED=1 (audit 2026-08-19);
// parolele vin OBLIGATORIU din env (DEMO_PASSWORD, optional DEMO_ADMIN_PASSWORD).
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

const prisma = new PrismaClient();

const CITY: Record<string, { lat: number; lng: number; county: string }> = {
  Bucuresti: { lat: 44.4268, lng: 26.1025, county: 'Bucuresti' },
  Cluj: { lat: 46.7712, lng: 23.6236, county: 'Cluj' },
  Timisoara: { lat: 45.7489, lng: 21.2087, county: 'Timis' },
  Iasi: { lat: 47.1585, lng: 27.6014, county: 'Iasi' },
  Brasov: { lat: 45.658, lng: 25.6012, county: 'Brasov' },
};
// PO r5: cost = scorul de baza (1 credit = 1.000 lei din bugetul minim estimat)
const SIZE = {
  SMALL: { size: 'SMALL' as const, score: 10, cost: 10 },
  MEDIUM: { size: 'MEDIUM' as const, score: 20, cost: 20 },
  LARGE: { size: 'LARGE' as const, score: 35, cost: 35 },
};
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000);
const daysAhead = (d: number) => new Date(Date.now() + d * 86400000);

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== '1') {
    throw new Error('seed-demo refuzat in productie (seteaza ALLOW_DEMO_SEED=1 doar daca chiar vrei date demo pe prod)');
  }
  if (await prisma.user.findUnique({ where: { email: 'admin@demo.ro' } })) {
    console.log('Demo already seeded (admin@demo.ro exists). Skipping.');
    return;
  }
  // Parolele demo vin din env — fara default in repo (adminul separat de restul)
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword || demoPassword.length < 8) {
    throw new Error('DEMO_PASSWORD lipseste (min 8 caractere) — nu exista parola implicita');
  }
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? demoPassword;
  const hash = await bcrypt.hash(demoPassword, 12);
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const plans = {
    SILVER: await prisma.subscriptionPlan.findFirstOrThrow({ where: { tier: 'SILVER' } }),
    GOLD: await prisma.subscriptionPlan.findFirstOrThrow({ where: { tier: 'GOLD' } }),
    PLATINUM: await prisma.subscriptionPlan.findFirstOrThrow({ where: { tier: 'PLATINUM' } }),
  };

  const mkUser = (email: string, name: string, role: 'CLIENT' | 'COMPANY_USER' | 'ADMIN') =>
    prisma.user.create({
      data: {
        email,
        name,
        role,
        passwordHash: role === 'ADMIN' ? adminHash : hash,
        emailVerifiedAt: daysAgo(60),
      },
    });

  // ===== 7.1 admin + clienti =====
  const admin = await mkUser('admin@demo.ro', 'Admin Demo', 'ADMIN');
  const ana = await mkUser('ana.popescu@demo.ro', 'Ana Popescu', 'CLIENT');
  const mihai = await mkUser('mihai.ionescu@demo.ro', 'Mihai Ionescu', 'CLIENT');
  const elena = await mkUser('elena.dumitru@demo.ro', 'Elena Dumitru', 'CLIENT');
  const radu = await mkUser('radu.stanescu@demo.ro', 'Radu Stanescu', 'CLIENT');
  const ioana = await mkUser('ioana.marinescu@demo.ro', 'Ioana Marinescu', 'CLIENT');

  // ===== 7.1 firme =====
  interface CompanySpec {
    name: string; city: string; status: 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    plan?: 'SILVER' | 'GOLD' | 'PLATINUM'; subExpired?: boolean; credits?: number; coverage?: number;
    riskFlags?: string[]; rejectedDaysAgo?: number; suspendedMonths?: number; penaltyPoints?: number;
    ownerName: string; ownerEmail: string;
  }
  const companySpecs: CompanySpec[] = [
    // PO r5 (2026-07-13): toate firmele demo pornesc cu 200 de credite
    { name: 'A Mobila Premium', city: 'Bucuresti', status: 'APPROVED', plan: 'GOLD', credits: 200, ownerName: 'Andrei A', ownerEmail: 'owner.a@demo.ro' },
    { name: 'B DesignWood', city: 'Bucuresti', status: 'APPROVED', plan: 'PLATINUM', credits: 200, coverage: 100, ownerName: 'Florin B', ownerEmail: 'owner.b@demo.ro' },
    { name: 'C CasaMea', city: 'Cluj', status: 'APPROVED', plan: 'SILVER', credits: 200, penaltyPoints: 3, ownerName: 'Calin C', ownerEmail: 'owner.c@demo.ro' },
    { name: 'D Atelier Bucov', city: 'Bucuresti', status: 'PENDING_VERIFICATION', ownerName: 'Doru D', ownerEmail: 'owner.d@demo.ro' },
    { name: 'E Lemn & Stil', city: 'Brasov', status: 'PENDING_VERIFICATION', riskFlags: ['LOW_RATING', 'INSUFFICIENT_REVIEWS', 'NO_PORTFOLIO'], ownerName: 'Emil E', ownerEmail: 'owner.e@demo.ro' },
    { name: 'F FastFurniture', city: 'Iasi', status: 'REJECTED', rejectedDaysAgo: 30, ownerName: 'Fane F', ownerEmail: 'owner.f@demo.ro' },
    { name: 'G MobMaster', city: 'Timisoara', status: 'SUSPENDED', plan: 'GOLD', credits: 200, suspendedMonths: 6, penaltyPoints: 12, ownerName: 'Gelu G', ownerEmail: 'owner.g@demo.ro' },
    { name: 'H VintageHaus', city: 'Bucuresti', status: 'APPROVED', plan: 'GOLD', subExpired: true, credits: 200, ownerName: 'Horia H', ownerEmail: 'owner.h@demo.ro' },
  ];

  const companies: Record<string, { id: string; ownerId: string }> = {};
  for (const s of companySpecs) {
    const owner = await mkUser(s.ownerEmail, s.ownerName, 'COMPANY_USER');
    const c = CITY[s.city];
    const company = await prisma.company.create({
      data: {
        name: s.name, cui: `RO${1000000 + Math.floor(Math.random() * 8999999)}`, regComNumber: `J40/${100 + Math.floor(Math.random() * 900)}/2021`,
        status: s.status, addressText: `Str. ${s.name} nr. 1`, county: c.county, city: s.city, lat: c.lat, lng: c.lng,
        rejectedAt: s.rejectedDaysAgo ? daysAgo(s.rejectedDaysAgo) : null,
        rejectionReason: s.status === 'REJECTED' ? 'Documente incomplete' : null,
        suspendedAt: s.suspendedMonths ? daysAgo(5) : null,
        suspendedUntil: s.suspendedMonths ? daysAhead(s.suspendedMonths * 30 - 5) : null,
      },
    });
    await prisma.companyMember.create({ data: { companyId: company.id, userId: owner.id, role: 'OWNER' } });
    await prisma.companyLocation.create({
      data: { companyId: company.id, addressText: `Str. ${s.name} nr. 1`, county: c.county, city: s.city, lat: c.lat, lng: c.lng, coverageRadiusKm: s.coverage ?? 50 },
    });
    await prisma.companyVerificationProfile.create({
      data: {
        companyId: company.id, riskFlags: s.riskFlags ?? [],
        reviewedByUserId: s.status === 'APPROVED' || s.status === 'SUSPENDED' ? admin.id : s.status === 'REJECTED' ? admin.id : null,
        reviewedAt: s.status === 'PENDING_VERIFICATION' ? null : daysAgo(40),
      },
    });
    await prisma.companyCreditWallet.create({ data: { companyId: company.id, balance: s.credits ?? 0, reserved: 0 } });
    // matrice permisiuni oferta pentru firmele APPROVED (ca demo-ul sa poata trimite oferte live)
    if (s.status === 'APPROVED') {
      for (const role of ['OWNER', 'MANAGER', 'EMPLOYEE_TRUSTED', 'EMPLOYEE_MANAGED'] as const) {
        for (const fieldKey of ['PRICE', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY', 'DESCRIPTION'] as const) {
          const canEdit = role === 'OWNER' || role === 'MANAGER' || (role === 'EMPLOYEE_TRUSTED' && fieldKey !== 'PRICE');
          await prisma.companyOfferFieldPermission.create({ data: { companyId: company.id, role, fieldKey, canEdit } });
        }
      }
    }
    if (s.plan) {
      await prisma.subscription.create({
        data: {
          companyId: company.id, planId: plans[s.plan].id, status: s.subExpired ? 'EXPIRED' : 'ACTIVE',
          startedAt: daysAgo(s.subExpired ? 60 : 20), expiresAt: s.subExpired ? daysAgo(30) : daysAhead(20),
        },
      });
    }
    if (s.penaltyPoints) {
      const n = Math.ceil(s.penaltyPoints / 3);
      for (let i = 0; i < n; i++) {
        await prisma.penaltyEvent.create({
          data: { scope: 'COMPANY', companyId: company.id, ruleKey: 'SLA_MISS', points: 3, reason: 'SLA breach (demo)', appliedAt: daysAgo(10 + i), expiresAt: daysAhead(170 - i) },
        });
      }
    }
    companies[s.name[0]] = { id: company.id, ownerId: owner.id };
  }

  // echipe pentru A si B (docs 7.1)
  const teamA = companies['A'];
  for (const [name, email, role] of [
    ['Bogdan A', 'mgr.a@demo.ro', 'MANAGER'], ['Cristina A', 'trusted1.a@demo.ro', 'EMPLOYEE_TRUSTED'],
    ['Dan A', 'trusted2.a@demo.ro', 'EMPLOYEE_TRUSTED'], ['Elena A', 'managed.a@demo.ro', 'EMPLOYEE_MANAGED'],
  ] as const) {
    const u = await mkUser(email, name, 'COMPANY_USER');
    await prisma.companyMember.create({ data: { companyId: teamA.id, userId: u.id, role } });
  }
  for (const [name, email, role] of [
    ['Gina B', 'mgr.b@demo.ro', 'MANAGER'], ['Trusted1 B', 'trusted1.b@demo.ro', 'EMPLOYEE_TRUSTED'],
    ['Trusted2 B', 'trusted2.b@demo.ro', 'EMPLOYEE_TRUSTED'], ['Trusted3 B', 'trusted3.b@demo.ro', 'EMPLOYEE_TRUSTED'],
  ] as const) {
    const u = await mkUser(email, name, 'COMPANY_USER');
    await prisma.companyMember.create({ data: { companyId: companies['B'].id, userId: u.id, role } });
  }

  // ===== 7.2 cereri (15) =====
  type RoomType = 'KITCHEN' | 'DRESSING' | 'LIVING' | 'OFFICE' | 'BEDROOM' | 'BATHROOM';
  async function mkRequest(opts: {
    client: { id: string; email?: string }; city: string; status: any; roomType: RoomType; size: keyof typeof SIZE;
    paidDesign?: boolean; published?: number; expiresInDays?: number; draft?: boolean; repostUsed?: boolean;
  }) {
    const c = CITY[opts.city];
    const sz = SIZE[opts.size];
    const token = opts.draft ? randomBytes(16).toString('hex') : null;
    const req = await prisma.request.create({
      data: {
        clientUserId: opts.client.id, draftTokenHash: token ? createHash('sha256').update(token).digest('hex') : null,
        status: opts.status, title: `${opts.roomType} ${opts.city}`, description: `Proiect ${opts.roomType.toLowerCase()} demo.`,
        budgetRange: 'FROM_5K_TO_15K', includesPaidDesign: !!opts.paidDesign, hasOwnProject: false,
        addressText: `Str. Client nr. 1`, county: c.county, city: opts.city, lat: c.lat, lng: c.lng,
        sizeScore: opts.draft ? null : sz.score, projectSize: opts.draft ? null : sz.size, creditCost: opts.draft ? null : sz.cost,
        publishedAt: opts.draft ? null : daysAgo(opts.published ?? 5),
        expiresAt: opts.draft ? null : daysAhead(opts.expiresInDays ?? 3),
        repostUsed: !!opts.repostUsed,
      },
    });
    await prisma.requestRoom.create({
      data: {
        requestId: req.id, roomType: opts.roomType, lengthM: 3, widthM: 2.5, heightM: 2.6,
        items: { create: [{ name: 'Corp principal', material: 'PAL', systems: ['PUSH'], quantity: 3 }] },
      },
    });
    // enum ContactChannel = EMAIL | PHONE (rework configurator 2026-07); CHAT si priority nu mai exista
    await prisma.requestContactPreference.create({
      data: { requestId: req.id, channel: 'EMAIL', value: opts.client.email ?? 'client@demo.ro' },
    });
    return req;
  }

  // helper claim (+ optional quote/version). no-offer claims: assignedTo=null (evita indexul partial).
  async function mkClaim(req: { id: string }, comp: { id: string; ownerId: string }, opts: {
    slotStatus: any; size: keyof typeof SIZE; clientId?: string;
    withQuote?: { status: any; currency?: 'RON' | 'EUR'; paidDesign?: boolean; changePending?: boolean; accepted?: boolean };
  }) {
    const sz = SIZE[opts.size];
    const slot = await prisma.claimSlot.create({
      data: {
        requestId: req.id, companyId: comp.id, claimedByUserId: comp.ownerId,
        assignedToUserId: opts.withQuote ? comp.ownerId : null, status: opts.slotStatus,
        projectSizeSnapshot: sz.size, projectScoreSnapshot: sz.score, claimCostCreditsSnapshot: sz.cost,
        slaDeadlineAt: daysAhead(2),
      },
    });
    await prisma.chatThread.create({ data: { claimSlotId: slot.id, lastClientMessageAt: daysAgo(1) } });
    let quote = null;
    if (opts.withQuote) {
      quote = await prisma.quote.create({
        data: { claimSlotId: slot.id, requestId: req.id, companyId: comp.id, currency: opts.withQuote.currency ?? 'RON', status: opts.withQuote.status, acceptedAt: opts.withQuote.accepted ? daysAgo(2) : null },
      });
      const v = await prisma.quoteVersion.create({
        data: {
          quoteId: quote.id, version: 1, price: 8500, designFee: opts.withQuote.paidDesign ? 1200 : null,
          deliveryTerm: '30 zile', warranty: '24 luni', description: 'Ofertă demo completă.',
          validUntil: daysAhead(14), createdByUserId: comp.ownerId,
        },
      });
      await prisma.claimSlot.update({ where: { id: slot.id }, data: { quoteId: quote.id } });
      if (opts.withQuote.changePending) {
        await prisma.quoteChangeRequest.create({ data: { quoteVersionId: v.id, clientUserId: opts.clientId ?? comp.ownerId, requestedText: 'Vreau alt furnir.', status: 'PENDING' } });
      }
    }
    return { slot, quote };
  }

  const A = companies['A'], B = companies['B'], C = companies['C'];

  // R1 DRAFT (ioana)
  await mkRequest({ client: ioana, city: 'Brasov', status: 'DRAFT', roomType: 'DRESSING', size: 'SMALL', draft: true });
  // R2 IN_MARKETPLACE (ana)
  await mkRequest({ client: ana, city: 'Bucuresti', status: 'IN_MARKETPLACE', roomType: 'KITCHEN', size: 'MEDIUM' });
  // R3 IN_MARKETPLACE (radu)
  await mkRequest({ client: radu, city: 'Iasi', status: 'IN_MARKETPLACE', roomType: 'LIVING', size: 'SMALL' });
  // R4 IN_MARKETPLACE (elena)
  await mkRequest({ client: elena, city: 'Timisoara', status: 'IN_MARKETPLACE', roomType: 'OFFICE', size: 'SMALL' });
  // R5 CLAIMED_PARTIAL (ana) — 1 claim A
  const r5 = await mkRequest({ client: ana, city: 'Bucuresti', status: 'CLAIMED_PARTIAL', roomType: 'BEDROOM', size: 'MEDIUM' });
  await mkClaim(r5, A, { slotStatus: 'ACTIVE', size: 'MEDIUM' });
  // R6 CLAIMED_PARTIAL (mihai) — 1 claim C
  const r6 = await mkRequest({ client: mihai, city: 'Cluj', status: 'CLAIMED_PARTIAL', roomType: 'KITCHEN', size: 'LARGE' });
  await mkClaim(r6, C, { slotStatus: 'ACTIVE', size: 'LARGE' });
  // R7 CLAIMED_FULL (radu) — 3 claims A,B,C
  const r7 = await mkRequest({ client: radu, city: 'Iasi', status: 'CLAIMED_FULL', roomType: 'DRESSING', size: 'MEDIUM' });
  for (const comp of [A, B, C]) await mkClaim(r7, comp, { slotStatus: 'ACTIVE', size: 'MEDIUM' });
  // R8 CLAIMED_FULL (elena) — 3 claims
  const r8 = await mkRequest({ client: elena, city: 'Timisoara', status: 'CLAIMED_FULL', roomType: 'KITCHEN', size: 'LARGE' });
  for (const comp of [A, B, C]) await mkClaim(r8, comp, { slotStatus: 'ACTIVE', size: 'LARGE' });
  // R9 OFFERS_RECEIVED (elena) — 3 oferte (una EUR), paid-design
  const r9 = await mkRequest({ client: elena, city: 'Timisoara', status: 'OFFERS_RECEIVED', roomType: 'BATHROOM', size: 'SMALL', paidDesign: true });
  await mkClaim(r9, A, { slotStatus: 'OFFER_SENT', size: 'SMALL', withQuote: { status: 'SENT', paidDesign: true } });
  await mkClaim(r9, B, { slotStatus: 'OFFER_SENT', size: 'SMALL', withQuote: { status: 'SENT', currency: 'EUR', paidDesign: true } });
  await mkClaim(r9, C, { slotStatus: 'OFFER_SENT', size: 'SMALL', withQuote: { status: 'SENT', paidDesign: true } });
  // R10 NEGOTIATION (mihai) — 1 oferta B + change request pending
  const r10 = await mkRequest({ client: mihai, city: 'Cluj', status: 'NEGOTIATION', roomType: 'LIVING', size: 'MEDIUM' });
  await mkClaim(r10, B, { slotStatus: 'OFFER_SENT', size: 'MEDIUM', clientId: mihai.id, withQuote: { status: 'SENT', changePending: true } });
  // R11 ACCEPTED → IN_EXECUTION (ana) — winner A
  const r11 = await mkRequest({ client: ana, city: 'Bucuresti', status: 'IN_EXECUTION', roomType: 'KITCHEN', size: 'LARGE' });
  await mkClaim(r11, A, { slotStatus: 'OFFER_SENT', size: 'LARGE', withQuote: { status: 'ACCEPTED', accepted: true } });
  // R12 DELIVERED_BY_COMPANY (elena) — winner B
  const r12 = await mkRequest({ client: elena, city: 'Timisoara', status: 'DELIVERED_BY_COMPANY', roomType: 'BEDROOM', size: 'MEDIUM' });
  await mkClaim(r12, B, { slotStatus: 'OFFER_SENT', size: 'MEDIUM', withQuote: { status: 'ACCEPTED', accepted: true } });
  // R13 COMPLETED review 5★ (mihai) — winner A
  const r13 = await mkRequest({ client: mihai, city: 'Cluj', status: 'COMPLETED', roomType: 'KITCHEN', size: 'MEDIUM' });
  const c13 = await mkClaim(r13, A, { slotStatus: 'COMPLETED', size: 'MEDIUM', withQuote: { status: 'ACCEPTED', accepted: true } });
  await prisma.review.create({ data: { requestId: r13.id, companyId: A.id, clientUserId: mihai.id, rating: 5, comment: 'Lucrare impecabilă, recomand!' } });
  void c13;
  // R14 COMPLETED review 2★ → DISPUTED (radu) — winner C, paid-design
  const r14 = await mkRequest({ client: radu, city: 'Iasi', status: 'DISPUTED', roomType: 'OFFICE', size: 'LARGE', paidDesign: true });
  await mkClaim(r14, C, { slotStatus: 'COMPLETED', size: 'LARGE', withQuote: { status: 'ACCEPTED', accepted: true, paidDesign: true } });
  const rev14 = await prisma.review.create({ data: { requestId: r14.id, companyId: C.id, clientUserId: radu.id, rating: 2, comment: 'Întârzieri și finisaje slabe.' } });
  await prisma.reviewDispute.create({ data: { reviewId: rev14.id, status: 'OPEN' } });
  // R15 EXPIRED (radu) — repost permis
  await mkRequest({ client: radu, city: 'Iasi', status: 'EXPIRED', roomType: 'DRESSING', size: 'SMALL', published: 10, expiresInDays: -3, repostUsed: false });

  // ===== facturi demo (revenue KPI) =====
  const vat = 21;
  for (const [comp, credits, base, num] of [[A, 50, 400], [B, 100, 700]] as const) {
    const vatAmt = Math.round(base * vat) / 100;
    await prisma.mockBillingOrder.create({
      data: {
        companyId: comp.id, orderType: 'CREDIT_PACKAGE', status: 'CONFIRMED', credits,
        baseAmountRon: base, vatRate: vat, vatAmountRon: vatAmt, totalRon: base + vatAmt,
        invoiceSeries: 'MM', invoiceNumber: num, confirmedAt: daysAgo(15), paymentSource: 'admin',
        sellerSnapshot: { name: 'Marketplace Mobilier SRL', cui: 'RO12345678' } as Prisma.InputJsonValue,
      },
    });
  }

  // ===== 7.3 audit (50+) + notificari (30) =====
  const auditActions = ['COMPANY_APPROVED', 'COMPANY_REJECTED', 'PAYMENT_CONFIRMED', 'DISPUTE_RESOLVED', 'SETTING_UPDATED', 'PENALTY_RULE_UPDATED'];
  const auditRows: Prisma.AuditLogCreateManyInput[] = [];
  for (let i = 0; i < 52; i++) {
    auditRows.push({
      userId: admin.id, role: 'ADMIN', action: auditActions[i % auditActions.length],
      entityType: 'demo', entityId: `demo-${i}`, ipHash: 'demo-hash', createdAt: daysAgo(60 - i),
    });
  }
  await prisma.auditLog.createMany({ data: auditRows });

  // Notificarile de decor sunt TOATE citite (feedback PO item 5): cele necitite
  // din seed pareau notificari reale duplicate si nu puteau fi "citite" din UI.
  // Notificarile necitite ale demo-ului vin din actiunile live (claim/mesaj/oferta).
  const notifUsers = [ana.id, mihai.id, elena.id, radu.id, A.ownerId, B.ownerId, C.ownerId];
  const notifTypes = ['quote.created', 'quote.updated', 'request.status_changed', 'message.created', 'claim.created'];
  const notifRows: Prisma.NotificationCreateManyInput[] = [];
  for (let i = 0; i < 30; i++) {
    notifRows.push({
      userId: notifUsers[i % notifUsers.length], type: notifTypes[i % notifTypes.length],
      payload: { demo: true } as Prisma.InputJsonValue, readAt: daysAgo(2), createdAt: daysAgo(20 - (i % 20)),
    });
  }
  await prisma.notification.createMany({ data: notifRows });

  const counts = {
    users: await prisma.user.count(), companies: await prisma.company.count(),
    requests: await prisma.request.count(), claims: await prisma.claimSlot.count(),
    quotes: await prisma.quote.count(), audit: await prisma.auditLog.count(), notif: await prisma.notification.count(),
  };
  console.log('Demo seeded:', JSON.stringify(counts));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
