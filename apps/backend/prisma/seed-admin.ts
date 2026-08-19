// Creeaza (sau roteste parola) contului ADMIN de productie — FARA date demo.
// Ruleaza: ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm -F backend seed:admin
// (pe prod: railway run --service Postgres -- sau DATABASE_URL=<public url>).
// - Daca emailul nu exista: creeaza user ADMIN cu emailul verificat.
// - Daca exista si e ADMIN: roteste parola DOAR cu ADMIN_RESET_PASSWORD=1.
// - Daca exista cu alt rol: refuza (nu promovam conturi din greseala).
// Parola: min 12 caractere, nu e logata niciodata.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL lipseste sau e invalid');
  }
  if (!password || password.length < 12 || password.length > 72) {
    throw new Error('ADMIN_PASSWORD lipseste sau nu are 12-72 caractere');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'ADMIN') {
    throw new Error(`${email} exista deja cu rolul ${existing.role} — nu il promovez automat`);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        name,
        role: 'ADMIN',
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Admin creat: ${email}`);
    return;
  }
  if (process.env.ADMIN_RESET_PASSWORD !== '1') {
    console.log(`Admin ${email} exista deja. Pentru rotire parola: ADMIN_RESET_PASSWORD=1`);
    return;
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: existing.id }, data: { passwordHash, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() } }),
    // sesiunile vechi cad — parola noua = familie noua de tokenuri
    prisma.refreshToken.updateMany({ where: { userId: existing.id, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  console.log(`Parola admin rotita pentru ${email}; sesiunile active au fost revocate`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
