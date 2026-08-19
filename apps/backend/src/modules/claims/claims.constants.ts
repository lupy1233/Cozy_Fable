import type { ClaimSlotStatus, RequestStatus } from '@prisma/client';

// docs 3.1/4.8 — maxim 3 claim-uri active per cerere (configurabil via system_settings).
export const DEFAULT_MAX_CLAIMS = 3;

// Statusuri de cerere in care se poate da claim (3.1).
export const CLAIMABLE_STATUSES: RequestStatus[] = ['IN_MARKETPLACE', 'CLAIMED_PARTIAL'];

// Statusuri de claim care ocupa un slot (conteaza la max 3 + "deja claimat").
// Anularile/retragerile elibereaza slotul.
export const OCCUPYING_CLAIM_STATUSES: ClaimSlotStatus[] = ['ACTIVE', 'OFFER_SENT', 'COMPLETED'];

// Statusuri de claim "in lucru" (firma mai poate actiona: oferta, clarificare, retragere).
export const OPEN_CLAIM_STATUSES: ClaimSlotStatus[] = ['ACTIVE', 'OFFER_SENT'];

// L0-B — statusuri de cerere in care firmele mai pot trimite/revizui/reoferta (4.13).
// In afara lor (ex. ACCEPTED, DELIVERED_BY_COMPANY, EXPIRED) orice oferta noua e refuzata.
export const OFFERABLE_REQUEST_STATUSES: RequestStatus[] = [
  'CLAIMED_PARTIAL',
  'CLAIMED_FULL',
  'OFFERS_RECEIVED',
  'NEGOTIATION',
];

// L0-B — statusuri de cerere in care clientul poate accepta o oferta (sub lock FOR UPDATE).
export const ACCEPTABLE_REQUEST_STATUSES: RequestStatus[] = ['OFFERS_RECEIVED', 'NEGOTIATION'];

// L0-B — statusuri de cerere dupa care procesoarele de SLA / atribuire ies no-op:
// cererea a fost deja atribuita/livrata, sloturile nealese sunt inchise la accept.
export const REQUEST_SETTLED_STATUSES: RequestStatus[] = [
  'ACCEPTED',
  'IN_EXECUTION',
  'DELIVERED_BY_COMPANY',
  'COMPLETED',
  'DISPUTED',
];

// 4.9 — atribuire in 1h (ora calendaristica); warning la +30 min.
export const ASSIGN_DEADLINE_MS = 60 * 60 * 1000;
export const ASSIGN_WARNING_MS = 30 * 60 * 1000;

// Timeout tranzactie claim (3.1).
export const CLAIM_TX_TIMEOUT_MS = 10_000;

// 4.11 / D-v6-4 — durata SLA in zile lucratoare per marime; grace 12h calendaristice (3.3).
export const SLA_DAYS: Record<'SMALL' | 'MEDIUM' | 'LARGE', number> = {
  SMALL: 3,
  MEDIUM: 3,
  LARGE: 5,
};
export const SLA_GRACE_MS = 12 * 60 * 60 * 1000;

// 4.4 / D-v6-13 — re-publicare dupa ratare SLA in masa: ceas nou de 5 zile lucratoare.
export const REPUBLISH_EXPIRY_WORKING_DAYS = 5;
