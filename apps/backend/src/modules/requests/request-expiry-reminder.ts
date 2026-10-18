import type { Queue } from 'bullmq';
import type { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';
import type { RequestExpirationJob } from './request-expiration.processor';

// E-admin-platform-44 — 4.4: reminder catre client cand cererea nu are nicio preluare dupa
// 3 zile lucratoare. Pe ceasul de 5 zile lucratoare, asta e dimineata (09:00 Bucuresti) primei
// din ultimele 2 zile lucratoare dinaintea lui expires_at. Derivat din expires_at (nu din
// published_at) → acopera automat si re-publicarile (D-v6-13, retrageri, auto-cancel).
// Jobul ruleaza pe coada request-expiration sub nume propriu; procesorul re-verifica starea.

export const REQUEST_EXPIRY_REMINDER_JOB = 'remind-expiry';
export const REQUEST_EXPIRY_REMINDER_WORKING_DAYS_BEFORE = 2;
export const REQUEST_EXPIRY_REMINDER_HOUR = 9;

export function requestExpiryReminderJobId(requestId: string, expiresAt: Date): string {
  return `req-rem-${requestId}-${expiresAt.getTime()}`;
}

export function requestExpiryReminderEventKey(requestId: string, expiresAt: Date): string {
  return `request.expiry_reminder:${requestId}:${expiresAt.getTime()}`;
}

export function requestExpiryReminderAt(
  calendar: Pick<BusinessCalendarService, 'workingDateBefore' | 'bucharestWallClock'>,
  expiresAt: Date,
): Date {
  return calendar.bucharestWallClock(
    calendar.workingDateBefore(expiresAt, REQUEST_EXPIRY_REMINDER_WORKING_DAYS_BEFORE - 1),
    REQUEST_EXPIRY_REMINDER_HOUR,
  );
}

// Programare dupa commit (publicare / repost / re-publicare). Best-effort: sweep-ul de
// reconciliere (ramura 10) e plasa de siguranta, deci erorile Redis se inghit.
export async function scheduleRequestExpiryReminder(
  queue: Queue<RequestExpirationJob>,
  calendar: Pick<BusinessCalendarService, 'workingDateBefore' | 'bucharestWallClock'>,
  requestId: string,
  expiresAt: Date,
  now: number = Date.now(),
): Promise<void> {
  if (now >= expiresAt.getTime()) return;
  try {
    const remindAt = requestExpiryReminderAt(calendar, expiresAt);
    await queue.add(
      REQUEST_EXPIRY_REMINDER_JOB,
      { requestId, expiresAt: expiresAt.toISOString(), remindAt: remindAt.toISOString() },
      {
        delay: Math.max(0, remindAt.getTime() - now),
        jobId: requestExpiryReminderJobId(requestId, expiresAt),
        removeOnComplete: true,
        removeOnFail: 1000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  } catch {
    // best-effort: ramura 10 a sweep-ului re-inarmeaza reminderul
  }
}
