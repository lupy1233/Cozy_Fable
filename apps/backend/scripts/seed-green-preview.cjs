/* Date sintetice exclusiv pentru preview-ul Green izolat. Nu ruleaza la boot. */
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

assert.equal(process.env.RUN_GREEN_ACCEPTANCE, '1', 'Explicit Green acceptance opt-in required');
assert.equal(process.env.GREEN_ISOLATED_PREVIEW, 'true', 'Isolated preview flag required');
assert.equal(process.env.DEPLOYMENT_SLOT, 'green', 'Green slot required');
const database = new URL(process.env.DATABASE_URL || '');
assert.equal(database.hostname, 'green-postgres.railway.internal', 'Refusing a production database');
assert.equal(database.pathname, '/green_preview', 'Refusing a production database name');
assert.equal(process.env.REDIS_HOST, 'green-redis.railway.internal', 'Isolated Redis required');
assert.equal(process.env.S3_BUCKET, 'green-preview', 'Isolated bucket required');
assert.equal(process.env.SMTP_HOST, 'green-mail.railway.internal', 'Captured email required');
assert(!process.env.STRIPE_SECRET_KEY, 'Payments must be disabled in the preview');
assert(process.env.DEMO_PASSWORD?.length >= 24, 'Explicit strong test password required');

const prisma = new PrismaClient();
async function main() {
  const email = 'green-form-audit@example.test';
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email, name: 'Green form audit', role: 'CLIENT', languagePreference: 'EN',
      passwordHash: await bcrypt.hash(process.env.DEMO_PASSWORD, 12),
      emailVerifiedAt: new Date(), termsAcceptedAt: new Date(),
    },
  });
  const queryKey = ['Green form audit only', 'Bucuresti', 'Bucuresti', 'ro']
    .map((value) => value.trim().toLowerCase().replace(/\s+/g, ' ')).join('|');
  const location = {
    lat: 44.4268, lng: 26.1025, displayName: 'Isolated Green test location',
    expiresAt: new Date(Date.now() + 90 * 86400000),
  };
  await prisma.geocodingCache.upsert({ where: { queryKey }, update: location, create: { queryKey, ...location } });
  console.log(JSON.stringify({ isolated: true, testUserId: user.id, locationPrepared: true }));
}
main().catch((error) => { console.error(error.code || error.name); process.exitCode = 1; }).finally(() => prisma.$disconnect());
