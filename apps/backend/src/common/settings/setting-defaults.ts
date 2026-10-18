import { CLAIM_COST_DEFAULTS } from '@marketplace/shared';

// Valori implicite pentru cheile system_settings citite si de enforcement si de pagina publica
// "Reguli pentru firme" (E-company-9). O singura sursa: fallback-ul din cod nu poate diverge de cel afisat.
export const SETTING_DEFAULTS = {
  company_penalty_threshold: 12,
  company_suspension_months: 6,
  max_claims_per_request: 3,
  // E-admin-platform-10: cererea ramane claimabila dupa prima oferta (varianta A) — OPRIT
  // pana la decizia PO (invarianta 3.1 ramane literala).
  claims_open_after_first_offer: false,
  // E-company-3 (DECIZIE NECESARA PO): implicitele pastreaza W1 (contacte la claim) si I18
  // (gratia de 30 min). AFTER_GRACE ascunde contactele in gratie; 0 = fara prag dupa livrare.
  claim_contact_reveal_policy: 'ON_CLAIM',
  completed_claim_contact_retention_days: 0,
  // E-admin-platform-45 (DECIZIE NECESARA PO): contacte scrise in texte libere. MASK = publicarea
  // trece, firmele fara acces vad tokenul; BLOCK = publicarea/editarea e refuzata (400).
  pre_claim_contact_text_policy: 'MASK',
  // E-client-9 (DECIZIE NECESARA PO): distanta pre-claim in km intregi (BAND = doar benzi),
  // plafon de locatii per firma si schimbari de locatii pe 24h (anti-trilaterare).
  marketplace_distance_display: 'KM',
  company_locations_max: 10,
  company_location_changes_per_day: 20,
  // E-company-21, 0 = fara plafon; DECIZIE NECESARA PO (valorile min/max ale costului unei preluari)
  credit_value_ron: CLAIM_COST_DEFAULTS.creditValueRon,
  claim_cost_min: 1,
  claim_cost_max: 0,
  trial_enabled: true,
  trial_plan: 'GOLD',
  trial_duration_days: 30,
  trial_bonus_credits: 10,
  // E-company-24 DECIZIE NECESARA PO: zile pana la reminder / anulare automata a comenzilor
  // platite prin transfer bancar; 0 = oprit
  bank_transfer_reminder_days: 0,
  bank_transfer_expiry_days: 0,
  // Hotfix 2026-10-04 (PO): re-acceptarea Termenilor/Politicii pentru conturile existente —
  // OPRITA pana la revizuirea avocatului (conturile noi accepta oricum la inregistrare)
  legal_reaccept_existing_users: false,
} as const;
