// E-admin-platform-2: cheile din system_settings care alcatuiesc identitatea publica a operatorului.
// seller_* sunt aceleasi chei folosite la facturi (docs/03 4.17, D-L0-1); legal_* sunt noi.
export const SETTING_LEGAL_CONTACT_EMAIL = 'legal_contact_email';
export const SETTING_LEGAL_IDENTITY_PUBLISHED = 'legal_identity_published';
// Hotfix 2026-10-04 (PO): re-acceptarea Termenilor/Politicii pentru conturile existente
// porneste doar cu 'true' (dupa revizuirea avocatului); conturile noi accepta la inregistrare.
export const SETTING_LEGAL_REACCEPT_EXISTING_USERS = 'legal_reaccept_existing_users';

export const LEGAL_OPERATOR_KEYS = [
  'seller_name',
  'seller_cui',
  'seller_reg_com',
  'seller_address',
  SETTING_LEGAL_CONTACT_EMAIL,
  SETTING_LEGAL_IDENTITY_PUBLISHED,
] as const;

// E-company-9: cheile din system_settings / penalty_rules pe care le citeste pagina publica "Reguli pentru firme".
// Restul valorilor vin din aceleasi constante pe care le folosesc modulele care aplica regulile.
export const FIRM_RULES_SETTING_KEYS = [
  'company_penalty_threshold',
  'company_suspension_months',
  'max_claims_per_request',
  'claims_open_after_first_offer',
  // E-company-3: pagina publica spune cand se vad contactele clientului
  'claim_contact_reveal_policy',
  'completed_claim_contact_retention_days',
  // E-company-21: intervalul costului unei preluari (propozitia apare doar cand exista o limita)
  'credit_value_ron',
  'claim_cost_min',
  'claim_cost_max',
  'trial_enabled',
  'trial_plan',
  'trial_duration_days',
  'trial_bonus_credits',
] as const;
export const FIRM_RULES_PENALTY_KEYS = ['SLA_MISS', 'VOLUNTARY_WITHDRAWAL'] as const;
