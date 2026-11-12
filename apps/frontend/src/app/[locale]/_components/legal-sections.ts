// E-admin-platform-2: ordinea sectiunilor din Legal.* (h + b in messages), comuna paginilor si testului de paritate.
export const TERMS_SECTIONS = [
  'intro',
  'accounts',
  'flow',
  'delivery',
  'reviews',
  'credits',
  'penalties',
  'liability',
  'ip',
  'changes',
  'law',
] as const;

export const PRIVACY_SECTIONS = [
  'intro',
  'data',
  'usage',
  'marketing',
  'sharing',
  'transfers',
  'rights',
  'retention',
  'cookies',
  'contact',
] as const;

// E-company-9: ordinea sectiunilor din Legal.firmRules.sections (pagina /firm-rules + testul de paritate).
export const FIRM_RULES_SECTIONS = [
  'verification',
  'trial',
  'credits',
  'settlement',
  'sla',
  'withdrawals',
  'penalties',
  'suspension',
  'changes',
] as const;

// Design 2026-11: randurile cardului „Pe scurt” (Legal.<pagina>.summary.*). Text nou, in afara
// lui `sections` (textul juridic versionat); fiecare rand reia o afirmatie din sectiunile de mai sus.
export const TERMS_SUMMARY = ['contract', 'claims', 'offers', 'reviews'] as const;

export const PRIVACY_SUMMARY = ['contacts', 'masked', 'accessEnds', 'marketing'] as const;

// Legal.firmRules.summary.rows.* — valorile vin din aceleasi argumente ca textul sectiunilor.
export const FIRM_RULES_SUMMARY = [
  'freeWithdrawal',
  'slaMiss',
  'voluntaryWithdrawal',
  'suspension',
  'reapply',
] as const;
