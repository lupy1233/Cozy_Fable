import type { Prisma } from '@prisma/client';

// k1 (PO 2026-11-13): firmele demo se ascund de pe paginile PUBLICE pana la lansare, cand se
// sterg cu prisma/cleanup-demo.ts. Aceeasi regula ca scriptul: o firma e „demo” daca MACAR UN
// membru are email @demo.ro, cu exceptia firmelor reale pastrate explicit (KEEP_COMPANY_NAMES).
// Conturile demo merg in continuare in rest (login, piata, preluari) — doar listele publice filtreaza.
// Sursa comuna a conventiei (cleanup-demo.ts si ledger-check.service.ts au copii locale; vezi raportul e2-auth).
export const DEMO_EMAIL_SUFFIX = '@demo.ro';
export const KEEP_COMPANY_NAMES: readonly string[] = ['Mobila Unicat'];

// where Prisma pentru „firma demo”; in listele publice se foloseste sub NOT
export const demoCompanyWhere: Prisma.CompanyWhereInput = {
  members: { some: { user: { email: { endsWith: DEMO_EMAIL_SUFFIX } } } },
  name: { notIn: [...KEEP_COMPANY_NAMES] },
};
