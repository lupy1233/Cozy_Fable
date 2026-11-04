import { ConflictException, Injectable } from '@nestjs/common';
import {
  ERROR_CODES,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
  resolveClaimCostRules,
  type FirmRulesDto,
  type LegalOperatorDto,
} from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import { ASSIGN_DEADLINE_MS, CLARIFICATION_SLA_EXTENSION_WORKING_DAYS, CLIENT_UNRESPONSIVE_MS, SLA_DAYS, SLA_GRACE_MS, VOLUNTARY_WITHDRAWAL_GRACE_MS } from '../claims/claims.constants';
import { REAPPLY_BLOCK_MONTHS } from '../companies/companies.constants';
import { AUTO_COMPLETE_DAYS } from '../fulfillment/fulfillment.service';
import { PENALTY_FALLBACK_POINTS, PENALTY_WINDOW_DAYS } from '../penalties/penalties.service';
import type { AcceptLegalDto } from './dto/accept-legal.dto';
import {
  FIRM_RULES_PENALTY_KEYS,
  FIRM_RULES_SETTING_KEYS,
  LEGAL_OPERATOR_KEYS,
  SETTING_LEGAL_CONTACT_EMAIL,
  SETTING_LEGAL_IDENTITY_PUBLISHED,
} from './legal.constants';

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}

  // Doar citire (safe pe standby). O singura interogare: fiecare query costa ~150 ms cross-region.
  // Identitatea se publica DOAR cand flagul e 'true' si toate cele 5 valori sunt completate;
  // altfel nu iese nimic (nici valorile demo din seed).
  async getOperator(): Promise<LegalOperatorDto> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: [...LEGAL_OPERATOR_KEYS] } },
      select: { key: true, value: true },
    });
    const v = new Map(rows.map((r) => [r.key, (r.value ?? '').trim()]));
    if (v.get(SETTING_LEGAL_IDENTITY_PUBLISHED) !== 'true') return { published: false };
    const name = v.get('seller_name') ?? '';
    const cui = v.get('seller_cui') ?? '';
    const regCom = v.get('seller_reg_com') ?? '';
    const address = v.get('seller_address') ?? '';
    const contactEmail = v.get(SETTING_LEGAL_CONTACT_EMAIL) ?? '';
    if (!name || !cui || !regCom || !address || !contactEmail) return { published: false };
    return { published: true, name, cui, regCom, address, contactEmail };
  }

  // E-company-9: pagina publica "Reguli pentru firme". Doar citire (safe pe standby); doua interogari
  // in paralel (~150 ms fiecare cross-region). Parsarea replica SettingsService / PenaltiesService.pointsFor,
  // iar constantele sunt exact cele importate de codul care aplica regulile — pagina nu poate diverge de enforcement.
  async getFirmRules(): Promise<FirmRulesDto> {
    const [settingRows, ruleRows] = await Promise.all([
      this.prisma.systemSetting.findMany({
        where: { key: { in: [...FIRM_RULES_SETTING_KEYS] } },
        select: { key: true, value: true },
      }),
      this.prisma.penaltyRule.findMany({
        where: { ruleKey: { in: [...FIRM_RULES_PENALTY_KEYS] } },
        select: { ruleKey: true, points: true, isActive: true },
      }),
    ]);
    const raw = new Map(settingRows.map((r) => [r.key, r.value]));
    const int = (key: 'company_penalty_threshold' | 'company_suspension_months' | 'max_claims_per_request' | 'trial_duration_days' | 'trial_bonus_credits'): number => {
      const v = raw.get(key);
      const n = v === undefined ? NaN : Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : SETTING_DEFAULTS[key];
    };
    const trialEnabledRaw = raw.get('trial_enabled');
    const openAfterFirstOfferRaw = raw.get('claims_open_after_first_offer');
    const revealPolicyRaw = raw.get('claim_contact_reveal_policy');
    const retentionRaw = Number.parseInt(raw.get('completed_claim_contact_retention_days') ?? '', 10);
    // E-company-21: aceeasi rezolvare ca SizingService (valoare invalida = implicit)
    const cost = resolveClaimCostRules(Object.fromEntries(raw));
    const rules = new Map(ruleRows.map((r) => [r.ruleKey, r]));
    const points = (key: (typeof FIRM_RULES_PENALTY_KEYS)[number]): number => {
      const rule = rules.get(key);
      if (rule) return rule.isActive ? rule.points : 0;
      return PENALTY_FALLBACK_POINTS[key] ?? 0;
    };
    return {
      verification: { reapplyBlockMonths: REAPPLY_BLOCK_MONTHS },
      trial: {
        enabled: trialEnabledRaw === undefined ? SETTING_DEFAULTS.trial_enabled : trialEnabledRaw === 'true',
        plan: raw.get('trial_plan') ?? SETTING_DEFAULTS.trial_plan,
        durationDays: int('trial_duration_days'),
        bonusCredits: int('trial_bonus_credits'),
      },
      claims: {
        maxClaimsPerRequest: int('max_claims_per_request'),
        assignDeadlineMinutes: ASSIGN_DEADLINE_MS / 60_000,
        // E-admin-platform-10: pagina publica spune regula efectiv in vigoare
        openAfterFirstOffer:
          openAfterFirstOfferRaw === undefined
            ? SETTING_DEFAULTS.claims_open_after_first_offer
            : openAfterFirstOfferRaw === 'true',
        // E-company-3: aceeasi interpretare ca QuotesService.getClaimContext (valoare necunoscuta = implicit)
        contactRevealPolicy:
          revealPolicyRaw === 'ON_CLAIM' || revealPolicyRaw === 'AFTER_GRACE'
            ? revealPolicyRaw
            : SETTING_DEFAULTS.claim_contact_reveal_policy,
        completedContactRetentionDays:
          Number.isFinite(retentionRaw) && retentionRaw >= 0
            ? retentionRaw
            : SETTING_DEFAULTS.completed_claim_contact_retention_days,
        claimCost: { min: cost.min, max: cost.max },
      },
      sla: {
        workingDays: { ...SLA_DAYS },
        graceHours: SLA_GRACE_MS / 3_600_000,
        clarificationExtensionWorkingDays: CLARIFICATION_SLA_EXTENSION_WORKING_DAYS,
      },
      withdrawals: {
        voluntaryGraceMinutes: VOLUNTARY_WITHDRAWAL_GRACE_MS / 60_000,
        clientUnresponsiveHours: CLIENT_UNRESPONSIVE_MS / 3_600_000,
      },
      penalties: {
        windowDays: PENALTY_WINDOW_DAYS,
        companyThreshold: int('company_penalty_threshold'),
        suspensionMonths: int('company_suspension_months'),
        points: { SLA_MISS: points('SLA_MISS'), VOLUNTARY_WITHDRAWAL: points('VOLUNTARY_WITHDRAWAL') },
      },
      delivery: { autoCompleteDays: AUTO_COMPLETE_DAYS },
    };
  }

  // Clientul trimite versiunile pe care le-a afisat; un bundle vechi nu poate inregistra
  // acceptarea unui text pe care userul nu l-a vazut.
  async accept(userId: string, dto: AcceptLegalDto) {
    if (dto.termsVersion !== LEGAL_TERMS_VERSION || dto.privacyVersion !== LEGAL_PRIVACY_VERSION) {
      throw new ConflictException({
        code: ERROR_CODES.LEGAL_VERSION_MISMATCH,
        message: 'Legal texts were updated; reload and review them',
      });
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { termsVersion: dto.termsVersion, privacyVersion: dto.privacyVersion, termsAcceptedAt: new Date() },
      select: { id: true, termsVersion: true, privacyVersion: true, termsAcceptedAt: true },
    });
  }
}
