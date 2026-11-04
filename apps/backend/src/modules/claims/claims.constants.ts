import { SLA_WARNING_BEFORE_HOURS } from '@marketplace/shared';
import type { ClaimSlotStatus, RequestStatus } from '@prisma/client';

// docs 3.1/4.8 — maxim 3 claim-uri active per cerere: cheia system_settings
// max_claims_per_request, fallback SETTING_DEFAULTS (common/settings/setting-defaults.ts).

// Statusuri de cerere in care se poate da claim (3.1) — setul LITERAL din invarianta 3.1.
export const CLAIMABLE_STATUSES: RequestStatus[] = ['IN_MARKETPLACE', 'CLAIMED_PARTIAL'];

// E-admin-platform-10: varianta A (sloturi libere decid) e OPRITA implicit; invarianta 3.1
// ramane literala pana cand PO decide (DECIZIE NECESARA). CLAIMED_FULL nu intra niciodata:
// plinul il decide oricum numarul de sloturi.
export const SETTING_CLAIMS_OPEN_AFTER_FIRST_OFFER = 'claims_open_after_first_offer';
export const CLAIMABLE_STATUSES_AFTER_FIRST_OFFER: RequestStatus[] = ['OFFERS_RECEIVED', 'NEGOTIATION'];

// Setul de statusuri claimabile in functie de flag (folosit de claim si de SQL-ul din marketplace).
export function claimableStatuses(openAfterFirstOffer: boolean): RequestStatus[] {
  return openAfterFirstOffer
    ? [...CLAIMABLE_STATUSES, ...CLAIMABLE_STATUSES_AFTER_FIRST_OFFER]
    : CLAIMABLE_STATUSES;
}

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
  // E-admin-platform-3: proiect anulat dupa acceptare (sloturile sunt deja decontate)
  'CANCELLED',
];

// 4.9 / D2 — atribuire in 1h; warning la +30 min (ASSIGN_WARNING_BEFORE_DEADLINE_MS)
export const ASSIGN_DEADLINE_MS = 60 * 60 * 1000;
export const ASSIGN_WARNING_BEFORE_DEADLINE_MS = 30 * 60 * 1000;

// E-admin-platform-44 — sla.expiring_soon cu SLA_WARNING_BEFORE_HOURS (ore calendaristice,
// D-v6-9) inainte de sla_deadline_at. Joburile de avertizare ruleaza pe cozile existente
// (claim-assign / sla-breach) sub nume proprii; nu muta bani si nu schimba stari.
export const SLA_WARNING_BEFORE_MS = SLA_WARNING_BEFORE_HOURS * 60 * 60 * 1000;
export const ASSIGN_WARNING_JOB = 'warn-assign';
export const SLA_WARNING_JOB = 'warn-sla';
// E-company-13 — al doilea reminder SLA la inceputul gratiei (la sla_deadline_at); acelasi
// eveniment sla.expiring_soon cu phase=GRACE. Doar notificare, fara bani/stari.
export const SLA_GRACE_WARNING_JOB = 'warn-sla-grace';
export const SLA_WARNING_PHASE_GRACE = 'GRACE' as const;

// Timeout tranzactie claim (3.1) — definit in infra/prisma/tx-options.ts (profilul claim).
export { CLAIM_TX_TIMEOUT_MS } from '../../infra/prisma/tx-options';

// 4.11 / D-v6-4 — durata SLA in zile lucratoare per marime; grace 12h calendaristice (3.3).
export const SLA_DAYS: Record<'SMALL' | 'MEDIUM' | 'LARGE', number> = {
  SMALL: 3,
  MEDIUM: 3,
  LARGE: 5,
};
export const SLA_GRACE_MS = 12 * 60 * 60 * 1000;

// 4.11 — o clarificare ceruta clientului pune SLA pe pauza si prelungeste termenul cu +1 zi lucratoare.
export const CLARIFICATION_SLA_EXTENSION_WORKING_DAYS = 1;

// 4.15 — retragere voluntara fara penalizare in primele 30 min de la claim; motivul
// CLIENT_UNRESPONSIVE_48H e valid doar dupa 48h fara mesaj de la client.
export const VOLUNTARY_WITHDRAWAL_GRACE_MS = 30 * 60 * 1000;
export const CLIENT_UNRESPONSIVE_MS = 48 * 60 * 60 * 1000;

// E-company-3 — chei system_settings (docs/04 §5.4) pentru accesul la contactele clientului
// pe fisa de lucru; implicitele (SETTING_DEFAULTS) pastreaza W1 pana la decizia PO.
export const SETTING_CLAIM_CONTACT_REVEAL_POLICY = 'claim_contact_reveal_policy';
export const SETTING_COMPLETED_CLAIM_CONTACT_RETENTION_DAYS = 'completed_claim_contact_retention_days';

// 4.4 / D-v6-13 — re-publicare dupa ratare SLA in masa: ceas nou de 5 zile lucratoare.
export const REPUBLISH_EXPIRY_WORKING_DAYS = 5;

// E-admin-platform-3 — motivele noilor inchideri de slot (payload claim.withdrawn + ledger).
export const SETTLEMENT_REASON = {
  PROJECT_CANCELLED: 'PROJECT_CANCELLED',
  OFFER_EXPIRED_UNDECIDED: 'OFFER_EXPIRED_UNDECIDED',
} as const;

// E-admin-platform-3 — chei system_settings (docs/04 §5.4). Inchiderea automata a ofertelor
// expirate e OPRITA pana la decizia PO: procesorul e no-op daca enabled != 'true' SAU
// rezultatul creditelor nu e REFUND/CONSUME (valoarea implicita UNSET).
export const SETTING_EXPIRED_OFFER_AUTOCLOSE_ENABLED = 'expired_offer_autoclose_enabled';
export const SETTING_EXPIRED_OFFER_AUTOCLOSE_DAYS = 'expired_offer_autoclose_days';
export const SETTING_EXPIRED_OFFER_AUTOCLOSE_OUTCOME = 'expired_offer_autoclose_credit_outcome';
export const DEFAULT_EXPIRED_OFFER_AUTOCLOSE_DAYS = 14;
export const SETTING_DELIVERY_REMINDER_DAYS_BEFORE = 'delivery_reminder_days_before';
export const DEFAULT_DELIVERY_REMINDER_DAYS_BEFORE = 3;
