// Curatare date DEMO de pe productie (decizie PO 2026-08-19: se sterge tot ce a
// creat seed-demo.ts, se PASTREAZA firma reala "Mobila Unicat" + galeria + config seed.ts).
//
// Ce sterge: userii `*@demo.ro` (inclusiv admin@demo.ro) si tot ce atarna de ei —
// firmele in care sunt membri (cu wallets, abonamente, tranzactii, facturi mock,
// locatii, penalizari, permisiuni, poze de inspiratie atribuite lor), cererile lor
// (cu camere, preluari, oferte, chat, recenzii, dispute, scene 3D, atasamente),
// notificari, chei de idempotenta, refresh tokens, colectii, drafturi studio.
// NU sterge: audit_logs (trigger append-only; raman cu user_id orfan — intentionat),
// geocoding_cache, system_settings, planuri/pachete/praguri/reguli, sarbatori.
//
// Obiectele din bucket (S3/MinIO) NU sunt sterse aici: scriptul scrie cheile in
// cleanup-demo-storage-keys.txt ca sa le stergi cu mc/aws cli (sau lasa-le orfane).
//
// Ruleaza intai DRY-RUN (doar numara): DATABASE_URL=... pnpm -F backend cleanup:demo
// Executa:                            DATABASE_URL=... CLEANUP_DEMO_CONFIRM=yes pnpm -F backend cleanup:demo
// Fa BACKUP inainte (pg_dump). Operatia e ireversibila.
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();
const DEMO_EMAIL_SUFFIX = '@demo.ro';
const KEEP_COMPANY_NAMES = ['Mobila Unicat'];

async function main() {
  const confirm = process.env.CLEANUP_DEMO_CONFIRM === 'yes';
  const dbHost = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host;
    } catch {
      return '?';
    }
  })();
  console.log(`${confirm ? 'EXECUTIE' : 'DRY-RUN'} pe DB host: ${dbHost}`);

  const demoUsers = await prisma.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_SUFFIX } },
    select: { id: true, email: true, role: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  const demoCompanies = await prisma.company.findMany({
    where: {
      members: { some: { userId: { in: demoUserIds } } },
      name: { notIn: KEEP_COMPANY_NAMES },
    },
    select: { id: true, name: true },
  });
  const demoCompanyIds = demoCompanies.map((c) => c.id);

  const demoRequests = await prisma.request.findMany({
    where: { clientUserId: { in: demoUserIds } },
    select: { id: true },
  });
  const demoRequestIds = demoRequests.map((r) => r.id);

  // claim-uri ale firmelor demo pe cereri NE-demo (teoretic 0 pe prod; le stergem explicit)
  const strayClaims = await prisma.claimSlot.findMany({
    where: { companyId: { in: demoCompanyIds }, requestId: { notIn: demoRequestIds } },
    select: { id: true, requestId: true },
  });

  // atasamente: cereri demo + threaduri de chat ale claim-urilor demo + versiuni de oferta demo
  const demoThreads = await prisma.chatThread.findMany({
    where: {
      OR: [
        { claimSlot: { requestId: { in: demoRequestIds } } },
        { claimSlot: { companyId: { in: demoCompanyIds } } },
        { companyId: { in: demoCompanyIds } },
      ],
    },
    select: { id: true },
  });
  const demoQuoteVersions = await prisma.quoteVersion.findMany({
    where: {
      quote: { OR: [{ requestId: { in: demoRequestIds } }, { companyId: { in: demoCompanyIds } }] },
    },
    select: { id: true },
  });
  const demoInspirationPhotos = await prisma.inspirationPhoto.findMany({
    where: { companyId: { in: demoCompanyIds } },
    select: { id: true },
  });
  const attachmentWhere = {
    OR: [
      { entityType: 'REQUEST', entityId: { in: demoRequestIds } },
      { entityType: 'MESSAGE', entityId: { in: demoThreads.map((t) => t.id) } },
      { entityType: 'QUOTE_VERSION', entityId: { in: demoQuoteVersions.map((q) => q.id) } },
      { entityType: 'inspiration_photo', entityId: { in: demoInspirationPhotos.map((p) => p.id) } },
    ],
  };
  const attachments = await prisma.attachment.findMany({
    where: attachmentWhere,
    select: { id: true, storageKey: true },
  });

  const counts = {
    users: demoUsers.length,
    companies: demoCompanies.length,
    requests: demoRequestIds.length,
    strayClaims: strayClaims.length,
    chatThreads: demoThreads.length,
    quoteVersions: demoQuoteVersions.length,
    attachments: attachments.length,
    mockBillingOrders: await prisma.mockBillingOrder.count({ where: { companyId: { in: demoCompanyIds } } }),
    notifications: await prisma.notification.count({ where: { userId: { in: demoUserIds } } }),
    idempotencyKeys: await prisma.idempotencyKey.count({ where: { userId: { in: demoUserIds } } }),
    refreshTokens: await prisma.refreshToken.count({ where: { userId: { in: demoUserIds } } }),
  };
  console.table(counts);
  console.log('Useri demo:', demoUsers.map((u) => `${u.email} (${u.role})`).join(', ') || '—');
  console.log('Firme demo:', demoCompanies.map((c) => c.name).join(', ') || '—');

  const keepCompanies = await prisma.company.findMany({
    where: { name: { in: KEEP_COMPANY_NAMES } },
    select: { name: true, cui: true, status: true },
  });
  console.log('Firme PASTRATE:', keepCompanies.map((c) => `${c.name} (CUI ${c.cui}, ${c.status})`).join(', ') || '—');

  if (!confirm) {
    console.log('\nDRY-RUN: nimic sters. Pentru executie seteaza CLEANUP_DEMO_CONFIRM=yes.');
    return;
  }
  if (demoUserIds.length === 0) {
    console.log('Nimic de sters.');
    return;
  }

  writeFileSync('cleanup-demo-storage-keys.txt', attachments.map((a) => a.storageKey).join('\n'));

  await prisma.$transaction(
    async (tx) => {
      // 1) atasamente (fara FK — explicit, inainte sa dispara entitatile-parinte)
      await tx.attachment.deleteMany({ where: attachmentWhere });
      // 2) cereri demo (cascade: rooms/items, preferences, versions, exclusions, scenes,
      //    claim_slots -> chat_threads/messages/reads/withdrawals/clarifications, quotes -> versions..., reviews -> disputes)
      await tx.request.deleteMany({ where: { id: { in: demoRequestIds } } });
      // 3) claim-uri ratacite ale firmelor demo pe cereri ne-demo
      if (strayClaims.length) {
        await tx.claimSlot.deleteMany({ where: { id: { in: strayClaims.map((c) => c.id) } } });
      }
      // 4) firme demo (cascade: members, locations, verification, portfolio, permissions,
      //    subscriptions, wallets, credit_transactions, penalty_events, mock_billing_orders,
      //    inspiration_photos (+ board items / request links), team chat threads, exclusions)
      await tx.company.deleteMany({ where: { id: { in: demoCompanyIds } } });
      // 5) ce atarna direct de useri fara cascade
      await tx.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
      await tx.idempotencyKey.deleteMany({ where: { userId: { in: demoUserIds } } });
      await tx.refreshToken.deleteMany({ where: { userId: { in: demoUserIds } } });
      await tx.chatThreadRead.deleteMany({ where: { userId: { in: demoUserIds } } });
      // claim-uri create/atribuite de useri demo pe cereri ramase (n-ar trebui sa existe)
      await tx.claimSlot.updateMany({ where: { assignedToUserId: { in: demoUserIds } }, data: { assignedToUserId: null } });
      const leftover = await tx.claimSlot.count({ where: { claimedByUserId: { in: demoUserIds } } });
      if (leftover > 0) {
        throw new Error(`${leftover} claim_slots create de useri demo pe cereri ne-demo — verifica manual`);
      }
      // 6) userii (cascade: studio_drafts, inspiration_boards)
      await tx.user.deleteMany({ where: { id: { in: demoUserIds } } });
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  console.log(`\nSters. Chei storage (${attachments.length}) scrise in cleanup-demo-storage-keys.txt`);
  const left = await prisma.user.count({ where: { email: { endsWith: DEMO_EMAIL_SUFFIX } } });
  console.log(`Verificare: useri @demo.ro ramasi = ${left}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
