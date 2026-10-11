import { z } from 'zod';

// Versiunile textelor juridice publicate (Legal.* din messages). Se schimba DOAR la o modificare materiala revizuita juridic; orice schimbare cere re-acceptare de la toti userii.
export const LEGAL_TERMS_VERSION = '2026-09-29';
export const LEGAL_PRIVACY_VERSION = '2026-09-29';

export const legalAcceptSchema = z.object({
  termsVersion: z.string().min(1).max(32),
  privacyVersion: z.string().min(1).max(32),
});
export type LegalAcceptInput = z.infer<typeof legalAcceptSchema>;

// Identitatea operatorului, publica doar dupa ce PO a completat datele reale si a pus flagul legal_identity_published
export type LegalOperatorDto =
  | { published: false }
  | {
      published: true;
      name: string;
      cui: string;
      regCom: string;
      address: string;
      contactEmail: string;
    };

// E-company-9: valorile in vigoare din pagina publica "Reguli pentru firme" (citite live din setari + constantele de enforcement).
export type FirmRulesDto = {
  verification: { reapplyBlockMonths: number };
  trial: { enabled: boolean; plan: string; durationDays: number; bonusCredits: number };
  // openAfterFirstOffer (E-admin-platform-10): cererea ramane claimabila dupa prima oferta
  // contactRevealPolicy / completedContactRetentionDays (E-company-3): 0 = fara prag
  // claimCost (E-company-21): intervalul costului unei preluari; max null = fara plafon
  claims: {
    maxClaimsPerRequest: number;
    assignDeadlineMinutes: number;
    openAfterFirstOffer: boolean;
    contactRevealPolicy: 'ON_CLAIM' | 'AFTER_GRACE';
    completedContactRetentionDays: number;
    claimCost: { min: number; max: number | null };
  };
  sla: {
    workingDays: { SMALL: number; MEDIUM: number; LARGE: number };
    graceHours: number;
    clarificationExtensionWorkingDays: number;
  };
  withdrawals: { voluntaryGraceMinutes: number; clientUnresponsiveHours: number };
  penalties: {
    windowDays: number;
    companyThreshold: number;
    suspensionMonths: number;
    points: { SLA_MISS: number; VOLUNTARY_WITHDRAWAL: number };
  };
  delivery: { autoCompleteDays: number };
};
