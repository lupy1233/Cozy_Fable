// E-admin-platform-14 — ceasul standard pentru specurile UNIT: timp inghetat cu fake timers
// moderni (Date.now/new Date deterministe), dar cu nextTick/setImmediate/queueMicrotask reale
// ca promisiunile mock-urilor sa se rezolve normal.
// NU se foloseste in *.integration.spec.ts: engine-ul Prisma si now() din Postgres merg pe
// timp real — acolo regulile de timp se testeaza prin coloane "date in trecut" (backdate).

export function freezeClock(at: Date | string): Date {
  const now = new Date(at);
  jest.useFakeTimers({ now, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  return now;
}

export function restoreClock(): void {
  jest.useRealTimers();
}

export const plusMs = (d: Date, ms: number): Date => new Date(d.getTime() + ms);
