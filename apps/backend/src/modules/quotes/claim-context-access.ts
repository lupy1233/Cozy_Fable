import type { ClaimClientHiddenReason, ClaimContactRevealPolicy, ClaimContextVisibility } from '@marketplace/shared';
import type { ClaimSlotStatus, CompanyMemberRole } from '@prisma/client';
import {
  OCCUPYING_CLAIM_STATUSES,
  SETTING_CLAIM_CONTACT_REVEAL_POLICY,
  SETTING_COMPLETED_CLAIM_CONTACT_RETENTION_DAYS,
  VOLUNTARY_WITHDRAWAL_GRACE_MS,
} from '../claims/claims.constants';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';

const DAY_MS = 86_400_000;

interface ContactAccessSettingsReader {
  getString(key: string, fallback: string): Promise<string>;
  getInt(key: string, fallback: number): Promise<number>;
}

// E-company-3: setarile de acces la contacte; valoare necunoscuta = implicit (W1).
// E-client-9: partajata de fisa de lucru (quotes) si cardul "Cine vede cererea" (requests).
export async function readClaimContactAccessSettings(
  settings: ContactAccessSettingsReader,
): Promise<[ClaimContactRevealPolicy, number]> {
  const [policyRaw, retention] = await Promise.all([
    settings.getString(SETTING_CLAIM_CONTACT_REVEAL_POLICY, SETTING_DEFAULTS.claim_contact_reveal_policy),
    settings.getInt(SETTING_COMPLETED_CLAIM_CONTACT_RETENTION_DAYS, SETTING_DEFAULTS.completed_claim_contact_retention_days),
  ]);
  const policy: ClaimContactRevealPolicy = policyRaw === 'AFTER_GRACE' ? 'AFTER_GRACE' : 'ON_CLAIM';
  return [policy, retention >= 0 ? retention : SETTING_DEFAULTS.completed_claim_contact_retention_days];
}

export interface ClaimContextAccessInput {
  slotStatus: ClaimSlotStatus;
  requestDeletedAt: Date | null;
  slotCreatedAt: Date;
  slotUpdatedAt: Date;
  requestDeliveredAt: Date | null;
  claimedByUserId: string;
  assignedToUserId: string | null;
  memberRole: CompanyMemberRole;
  actingUserId: string;
  revealPolicy: ClaimContactRevealPolicy;
  retentionDays: number;
  now: number;
}

export interface ClaimContextAccess {
  visibility: ClaimContextVisibility;
  clientVisible: boolean;
  clientHiddenReason: ClaimClientHiddenReason | null;
  clientVisibleFrom: Date | null;
}

// E-company-3 (docs/03 4.2): cine vede ce pe fisa de lucru a unei preluari. Pura — ordinea
// verificarilor conteaza: cererea stearsa > slot neocupant > rol > prag dupa livrare > dezvaluire.
// Doar restrange citirea; nu muta credite si nu schimba W1/I18 cu setarile implicite.
export function resolveClaimContextAccess(i: ClaimContextAccessInput): ClaimContextAccess {
  if (i.requestDeletedAt) {
    return { visibility: 'TOMBSTONE', clientVisible: false, clientHiddenReason: 'REQUEST_DELETED', clientVisibleFrom: null };
  }
  if (!OCCUPYING_CLAIM_STATUSES.includes(i.slotStatus)) {
    return { visibility: 'REDACTED', clientVisible: false, clientHiddenReason: 'NOT_OCCUPYING', clientVisibleFrom: null };
  }
  const hidden = (reason: ClaimClientHiddenReason, from: Date | null = null): ClaimContextAccess => ({
    visibility: 'FULL',
    clientVisible: false,
    clientHiddenReason: reason,
    clientVisibleFrom: from,
  });
  // angajatul cu rol limitat lucreaza doar pe preluarile proprii (4.7 / D6)
  if (
    i.memberRole === 'EMPLOYEE_MANAGED' &&
    i.actingUserId !== i.claimedByUserId &&
    i.actingUserId !== i.assignedToUserId
  ) {
    return hidden('NOT_ASSIGNED_TO_YOU');
  }
  // prag dupa livrare (0 = oprit); conducerea firmei pastreaza accesul
  const leadership = i.memberRole === 'OWNER' || i.memberRole === 'MANAGER';
  if (i.slotStatus === 'COMPLETED' && i.retentionDays > 0 && !leadership) {
    const anchor = (i.requestDeliveredAt ?? i.slotUpdatedAt).getTime();
    if (anchor + i.retentionDays * DAY_MS <= i.now) return hidden('RETENTION_EXPIRED');
  }
  // AFTER_GRACE: contactele apar dupa gratia de retragere gratuita (aceeasi constanta ca I18)
  if (i.revealPolicy === 'AFTER_GRACE') {
    const visibleFrom = i.slotCreatedAt.getTime() + VOLUNTARY_WITHDRAWAL_GRACE_MS;
    if (i.now < visibleFrom) return hidden('REVEAL_PENDING', new Date(visibleFrom));
  }
  return { visibility: 'FULL', clientVisible: true, clientHiddenReason: null, clientVisibleFrom: null };
}
