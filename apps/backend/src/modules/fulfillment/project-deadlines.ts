import type { Queue } from 'bullmq';
import type { BusinessCalendarService } from '../../infra/calendar/business-calendar.service';

// E-admin-platform-3 — termenele proiectului acceptat (coada project-deadlines):
//  - reminder catre firma la 09:00 Bucuresti, cu N zile calendaristice inainte de data de
//    livrare din oferta acceptata (N = system_settings.delivery_reminder_days_before, implicit 3);
//  - anunt "termen depasit" catre client + firma la primul instant de dupa sfarsitul zilei de
//    livrare (ora Bucurestiului).
// Joburile au jobId determinist (cerere + data) → sweep-ul de reconciliere le poate re-inarma,
// iar cheia outbox determinista face notificarea exact-o-data. Procesorul re-verifica starea.

export interface ProjectDeadlineJob {
  requestId: string;
  // data de livrare (YYYY-MM-DD) pentru care a fost programat jobul
  deliveryDate: string;
}

export const DELIVERY_REMINDER_JOB = 'delivery-reminder';
export const DELIVERY_OVERDUE_JOB = 'delivery-overdue';
export const DELIVERY_REMINDER_HOUR = 9;
// Statusurile in care proiectul e "in lucru" (termenele au sens).
export const PROJECT_ACTIVE_STATUSES = ['ACCEPTED', 'IN_EXECUTION'] as const;

export function reminderJobId(requestId: string, deliveryDate: string): string {
  return `proj-rem-${requestId}-${deliveryDate}`;
}

export function overdueJobId(requestId: string, deliveryDate: string): string {
  return `proj-overdue-${requestId}-${deliveryDate}`;
}

// Data calendaristica (YYYY-MM-DD) deplasata cu `days` zile (aritmetica pe UTC, fara ore).
export function shiftDateOnly(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

// coloana delivery_date e DATE: Prisma o intoarce ca miezul noptii UTC → YYYY-MM-DD.
export function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function reminderAt(
  calendar: Pick<BusinessCalendarService, 'bucharestWallClock'>,
  deliveryDate: string,
  daysBefore: number,
): Date {
  return calendar.bucharestWallClock(shiftDateOnly(deliveryDate, -daysBefore), DELIVERY_REMINDER_HOUR);
}

export function overdueAt(
  calendar: Pick<BusinessCalendarService, 'endOfBucharestDate'>,
  deliveryDate: string,
): Date {
  return new Date(calendar.endOfBucharestDate(deliveryDate).getTime() + 1);
}

// Reminderul are sens doar daca proiectul era deja acceptat la momentul lui (acceptul in
// fereastra de N zile nu mai trimite reminder) si inainte de depasirea termenului.
export function reminderDue(
  calendar: Pick<BusinessCalendarService, 'bucharestWallClock' | 'endOfBucharestDate'>,
  deliveryDate: string,
  daysBefore: number,
  acceptedAt: Date | null,
  now: number = Date.now(),
): boolean {
  const at = reminderAt(calendar, deliveryDate, daysBefore).getTime();
  if (acceptedAt && acceptedAt.getTime() >= at) return false;
  return now >= at && now < overdueAt(calendar, deliveryDate).getTime();
}

const JOB_OPTIONS = {
  removeOnComplete: true,
  removeOnFail: 1000,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
} as const;

// Programare dupa commit-ul acceptului (best-effort; sweep-ul e plasa). Reminderul se sare
// daca momentul lui a trecut deja; jobul de depasire se programeaza mereu (delay >= 0).
export async function scheduleProjectDeadlineJobs(
  queue: Queue<ProjectDeadlineJob>,
  calendar: Pick<BusinessCalendarService, 'bucharestWallClock' | 'endOfBucharestDate'>,
  requestId: string,
  deliveryDate: string,
  daysBefore: number,
  now: number = Date.now(),
): Promise<void> {
  const data: ProjectDeadlineJob = { requestId, deliveryDate };
  const remindAt = reminderAt(calendar, deliveryDate, daysBefore).getTime();
  if (remindAt > now) {
    await queue.add(DELIVERY_REMINDER_JOB, data, {
      ...JOB_OPTIONS,
      delay: remindAt - now,
      jobId: reminderJobId(requestId, deliveryDate),
    });
  }
  await queue.add(DELIVERY_OVERDUE_JOB, data, {
    ...JOB_OPTIONS,
    delay: Math.max(0, overdueAt(calendar, deliveryDate).getTime() - now),
    jobId: overdueJobId(requestId, deliveryDate),
  });
}

// Anulare best-effort (proiect inchis); procesorul e oricum no-op in afara ACCEPTED/IN_EXECUTION.
export async function removeProjectDeadlineJobs(
  queue: Queue<ProjectDeadlineJob>,
  requestId: string,
  deliveryDate: string,
): Promise<void> {
  await queue.remove(reminderJobId(requestId, deliveryDate)).catch(() => undefined);
  await queue.remove(overdueJobId(requestId, deliveryDate)).catch(() => undefined);
}
