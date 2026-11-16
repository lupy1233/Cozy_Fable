/*
 * f6-3 (PO 2026-11-13): ciornele de test lasate de auditul din 2026-11-12 (marcajul "[TEST AUDIT"
 * — inclusiv variantele cu sufix, de ex. "[TEST AUDIT SD-01]"). Se porneste DOAR de PO, manual.
 * Nu ruleaza la boot si nu e importat de aplicatie.
 *
 * Ia DOAR randurile requests cu status DRAFT care contin fragmentul "[TEST AUDIT" (fara deosebire
 * de majuscule) in: titlu, mesaj (description), starea formularului (configurator_state: mesajul,
 * camerele, piesele, raspunsurile) sau camerele / piesele materializate. Lista arata unde s-a gasit.
 *
 *   fara --delete            : doar LISTEAZA (id, date, cont da/nu, fisiere, unde e marcajul) + scrie
 *                              copia JSON a randurilor. Nu scrie nimic in baza si nu atinge storage-ul.
 *   --delete --yes           : copia JSON, apoi pentru fiecare ciorna: DESCARCA fisierele ei din storage
 *                              in folderul de copie; doar daca toate s-au descarcat, sterge fisierele
 *                              din storage, randurile attachments si ciorna (camere, contacte etc. prin
 *                              cascada). Starea DRAFT + marcajul se reverifica sub lock inainte.
 *   --backup-dir <cale>      : OBLIGATORIU, in afara repo-ului (copia poate contine date de contact)
 *   --max <n>                : plafon de siguranta (implicit 200); peste el nu se sterge nimic
 *
 * Baza: DATABASE_URL sau, daca lipseste, DATABASE_PUBLIC_URL (din afara Railway se foloseste adresa
 * PUBLICA). Adresa nu se scrie niciodata in jurnal. Pentru --delete si S3_ENDPOINT (adresa publica
 * a storage-ului, daca rulati din afara Railway), S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET.
 *
 * Exemplu (PowerShell, din apps/backend, cu proiectul Railway legat):
 *   railway run --service backend -- powershell -NoProfile -Command "$env:DATABASE_URL=$env:DATABASE_PUBLIC_URL; node scripts/cleanup-test-audit-drafts.cjs --backup-dir E:\backup-test-audit"
 * (Daca serviciul backend nu expune DATABASE_PUBLIC_URL, se ia din serviciul Postgres:
 *  railway variables --service Postgres; nu o lipiti in jurnale / chat.)
 */
const fs = require('node:fs');
const path = require('node:path');

// ATENTIE: variabilele bazei se citesc INAINTE de require('@prisma/client') — clientul Prisma
// incarca singur apps/backend/.env (baza LOCALA) in process.env. Asa scriptul foloseste doar ce a
// fost pus explicit in mediu (DATABASE_URL, altfel DATABASE_PUBLIC_URL) si nu cade tacut pe .env.
const ENV_DB = process.env.DATABASE_URL
  ? { name: 'DATABASE_URL', url: process.env.DATABASE_URL }
  : process.env.DATABASE_PUBLIC_URL
    ? { name: 'DATABASE_PUBLIC_URL', url: process.env.DATABASE_PUBLIC_URL }
    : null;
const { PrismaClient } = require('@prisma/client');

const MARKER = '[test audit'; // comparat cu lower(...)
const ENTITY_TYPE_REQUEST = 'REQUEST';
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

function parseArgs(argv) {
  const args = { delete: false, yes: false, backupDir: null, max: 200 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--delete') args.delete = true;
    else if (a === '--yes') args.yes = true;
    else if (a === '--backup-dir') args.backupDir = argv[++i];
    else if (a === '--max') args.max = Number.parseInt(argv[++i], 10);
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!Number.isSafeInteger(args.max) || args.max < 1) throw new Error('--max must be a positive integer');
  if (args.delete && !args.yes) throw new Error('Deleting needs both --delete and --yes');
  if (!args.backupDir) throw new Error('--backup-dir <folder outside the repository> is required');
  const resolved = path.resolve(args.backupDir);
  const rel = path.relative(REPO_ROOT.toLowerCase(), resolved.toLowerCase());
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error('--backup-dir must be outside the repository (the backup may contain contact details)');
  }
  args.backupDir = resolved;
  return args;
}

function databaseUrl() {
  if (!ENV_DB) throw new Error('Missing DATABASE_URL / DATABASE_PUBLIC_URL in the environment (apps/backend/.env is ignored on purpose)');
  // doar numele variabilei, niciodata adresa
  console.log(`Baza: din ${ENV_DB.name}`);
  return ENV_DB.url;
}

// unde poate sta marcajul; aceeasi regula la listare si la reverificarea de dinaintea stergerii
const LOCATIONS_SQL = `
  strpos(lower(coalesce(r.title, '')), $1) > 0 AS in_title,
  strpos(lower(coalesce(r.description, '')), $1) > 0 AS in_description,
  strpos(lower(coalesce(r.configurator_state::text, '')), $1) > 0 AS in_form,
  EXISTS (
    SELECT 1 FROM request_rooms rr
    WHERE rr.request_id = r.id AND strpos(lower(coalesce(rr.answers::text, '')), $1) > 0
  ) OR EXISTS (
    SELECT 1 FROM request_items i JOIN request_rooms rr ON rr.id = i.room_id
    WHERE rr.request_id = r.id
      AND (strpos(lower(i.name), $1) > 0 OR strpos(lower(coalesce(i.description, '')), $1) > 0)
  ) AS in_rooms`;
const MATCH_SQL = `
  r.status = 'DRAFT'
  AND (
    strpos(lower(coalesce(r.title, '')), $1) > 0
    OR strpos(lower(coalesce(r.description, '')), $1) > 0
    OR strpos(lower(coalesce(r.configurator_state::text, '')), $1) > 0
    OR EXISTS (
      SELECT 1 FROM request_rooms rr
      WHERE rr.request_id = r.id AND strpos(lower(coalesce(rr.answers::text, '')), $1) > 0
    )
    OR EXISTS (
      SELECT 1 FROM request_items i JOIN request_rooms rr ON rr.id = i.room_id
      WHERE rr.request_id = r.id
        AND (strpos(lower(i.name), $1) > 0 OR strpos(lower(coalesce(i.description, '')), $1) > 0)
    )
  )`;

function s3Client() {
  const { S3Client, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
  for (const k of ['S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET']) {
    if (!process.env[k]) throw new Error(`Missing ${k}`);
  }
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
  });
  const Bucket = process.env.S3_BUCKET;
  return {
    // intoarce octetii sau null daca obiectul nu exista (de ex. o urcare neterminata)
    async getObject(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return Buffer.from(await res.Body.transformToByteArray());
      } catch (e) {
        if (e && (e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404))) return null;
        throw e;
      }
    },
    deleteObject: (key) => client.send(new DeleteObjectCommand({ Bucket, Key: key })),
    destroy: () => client.destroy(),
  };
}

const safeName = (s) => String(s).replace(/[^\w.-]+/g, '_').slice(0, 120) || 'file';

// copia fisierelor unei ciorne; false = cel putin o descarcare a esuat (ciorna NU se sterge)
async function backupFiles(storage, backupDir, requestId, attachments, report) {
  const dir = path.join(backupDir, 'files', requestId);
  fs.mkdirSync(dir, { recursive: true });
  for (const a of attachments) {
    try {
      const bytes = await storage.getObject(a.storageKey);
      if (bytes === null) {
        report.missing.push({ requestId, attachmentId: a.id });
        continue;
      }
      fs.writeFileSync(path.join(dir, `${a.id}-${safeName(path.basename(a.storageKey))}`), bytes, { flag: 'wx' });
    } catch (e) {
      console.error(`backup download failed: request=${requestId} attachment=${a.id} (${e.name || 'error'})`);
      return false;
    }
  }
  return true;
}

const lockedMatch = (tx, id) =>
  tx.$queryRawUnsafe(`SELECT r.id FROM requests r WHERE r.id = $2 AND ${MATCH_SQL} FOR UPDATE OF r`, MARKER, id);

async function deleteOne(prisma, storage, backupDir, id, report) {
  // (0) fisierele ciornei (citire; inca nu se schimba nimic)
  const attachments = await prisma.attachment.findMany({
    where: { entityType: ENTITY_TYPE_REQUEST, entityId: id },
    select: { id: true, storageKey: true },
  });
  // (1) copia fisierelor INAINTE de orice stergere (PO: "cu copie de rezerva inainte")
  if (!(await backupFiles(storage, backupDir, id, attachments, report))) return 'backupFailed';

  // (2) marcare sub lock: tokenul moare, ciorna nu mai poate fi salvata / publicata
  const marked = await prisma.$transaction(async (tx) => {
    const rows = await lockedMatch(tx, id);
    if (rows.length !== 1) return false;
    await tx.request.updateMany({
      where: { id, status: 'DRAFT', deletedAt: null },
      data: { deletedAt: new Date(), draftTokenHash: null },
    });
    return true;
  });
  if (!marked) return 'skipped';

  // (3) fisierele din storage — doar cheile copiate mai sus si nefolosite de alt rand
  const handled = [];
  for (const a of attachments) {
    const shared = await prisma.attachment.count({ where: { storageKey: a.storageKey, id: { not: a.id } } });
    if (shared === 0) {
      try {
        await storage.deleteObject(a.storageKey);
      } catch (e) {
        console.error(`storage delete failed: request=${id} attachment=${a.id} (${e.name || 'error'}) — ciorna ramane marcata; rulati din nou`);
        return 'failed';
      }
    }
    handled.push({ id: a.id, storageKey: a.storageKey });
  }

  // (4) randurile — din nou sub lock: doar DRAFT cu marcaj; un fisier aparut / schimbat intre timp
  // (alt rand sau alta cheie) opreste stergerea ciornei
  const deleted = await prisma.$transaction(async (tx) => {
    const rows = await lockedMatch(tx, id);
    if (rows.length !== 1) return false;
    if (handled.length > 0) {
      await tx.attachment.deleteMany({ where: { entityType: ENTITY_TYPE_REQUEST, entityId: id, OR: handled } });
    }
    const left = await tx.attachment.count({ where: { entityType: ENTITY_TYPE_REQUEST, entityId: id } });
    if (left > 0) return false;
    const res = await tx.request.deleteMany({ where: { id, status: 'DRAFT' } });
    return res.count === 1;
  });
  return deleted ? 'deleted' : 'skipped';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
  let storage = null;
  try {
    const found = await prisma.$queryRawUnsafe(
      `SELECT r.id, ${LOCATIONS_SQL} FROM requests r WHERE ${MATCH_SQL} ORDER BY r.created_at ASC`,
      MARKER,
    );
    const ids = found.map((r) => r.id);
    const whereBy = new Map(found.map((r) => [r.id, [
      r.in_title && 'titlu', r.in_description && 'mesaj', r.in_form && 'formular', r.in_rooms && 'camere/piese',
    ].filter(Boolean).join(', ')]));
    // citirea pentru copie: include si ciornele deja marcate sterse (fara middleware aici)
    const requests = await prisma.request.findMany({
      where: { id: { in: ids }, status: 'DRAFT' },
      include: {
        rooms: { include: { items: true } }, contactPreferences: true, versions: true, studioScenes: true,
        inspirationPhotos: true, contactDetections: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const attachments = await prisma.attachment.findMany({ where: { entityType: ENTITY_TYPE_REQUEST, entityId: { in: ids } } });
    const filesBy = new Map();
    for (const a of attachments) filesBy.set(a.entityId, (filesBy.get(a.entityId) || 0) + 1);

    // lista: fara date personale (id, date, cont da/nu, numar de fisiere, unde e marcajul)
    console.table(requests.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      deletedAt: r.deletedAt ? r.deletedAt.toISOString() : '',
      account: r.clientUserId ? 'da' : 'nu',
      files: filesBy.get(r.id) || 0,
      marker: whereBy.get(r.id) || '',
    })));
    console.log(`Ciorne DRAFT cu "[TEST AUDIT": ${requests.length}; fisiere: ${attachments.length}`);

    // copia randurilor se scrie mereu, inainte de orice stergere
    fs.mkdirSync(args.backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(args.backupDir, `test-audit-drafts-backup-${stamp}.json`);
    fs.writeFileSync(
      backupPath,
      JSON.stringify({ createdAt: new Date().toISOString(), marker: '[TEST AUDIT', requests, attachments }, null, 2),
      { encoding: 'utf8', flag: 'wx' },
    );
    console.log(`Copie de rezerva (randuri): ${backupPath}`);

    if (!args.delete) {
      console.log('Doar listare: nimic nu s-a schimbat in baza sau in storage. Pentru stergere: --delete --yes');
      return;
    }
    if (requests.length > args.max) {
      console.error(`Refuz: ${requests.length} ciorne > --max ${args.max}. Nimic nu a fost sters.`);
      process.exitCode = 2;
      return;
    }
    storage = s3Client();
    const fileDir = path.join(args.backupDir, `files-${stamp}`);
    const report = { deleted: [], skipped: [], failed: [], backupFailed: [], missing: [] };
    for (const r of requests) report[await deleteOne(prisma, storage, fileDir, r.id, report)].push(r.id);
    console.log(JSON.stringify({
      deleted: report.deleted.length,
      skipped: report.skipped,
      failed: report.failed,
      backupFailed: report.backupFailed,
      filesMissingInStorage: report.missing,
    }, null, 2));
    console.log(`Copie de rezerva (fisiere): ${fileDir}`);
    if (report.failed.length > 0 || report.backupFailed.length > 0) process.exitCode = 1;
  } finally {
    if (storage) storage.destroy();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // fara adrese / chei in jurnal: doar codul sau mesajul de eroare al scriptului
  const own = error instanceof Error && error.constructor === Error; // mesajele scriptului (fara adrese)
  console.error(error.code || error.errorCode || (own ? error.message : error.name));
  process.exitCode = 1;
});
