// E-company-24 — plata prin transfer bancar: reminder + anulare automata a comenzilor neplatite.
// DECIZIE NECESARA PO: numarul de zile (calendaristice, de la created_at); 0 = oprit.
export const SETTING_BANK_TRANSFER_REMINDER_DAYS = 'bank_transfer_reminder_days';
export const SETTING_BANK_TRANSFER_EXPIRY_DAYS = 'bank_transfer_expiry_days';

const DAY_MS = 86_400_000;

type BankOrderFields = {
  status: string;
  stripeSessionId: string | null;
  stripeCheckoutAttempt: unknown;
  testMode: boolean;
};

// Comanda "prin transfer bancar": PENDING, fara sesiune/incercare Stripe si nu e de test.
// Orice comanda Stripe are stripe_checkout_attempt scris inaintea apelului extern.
export function isBankOrder(o: BankOrderFields): boolean {
  return o.status === 'PENDING' && !o.stripeSessionId && o.stripeCheckoutAttempt === null && !o.testMode;
}

// Termenul anularii automate (null cand e oprita, cand firma a semnalat plata sau nu e transfer).
export function transferExpiresAt(
  o: BankOrderFields & { createdAt: Date; paymentClaimedAt: Date | null },
  expiryDays: number,
): Date | null {
  if (!(expiryDays > 0) || !isBankOrder(o) || o.paymentClaimedAt) return null;
  return new Date(o.createdAt.getTime() + expiryDays * DAY_MS);
}
