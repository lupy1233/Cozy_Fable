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
