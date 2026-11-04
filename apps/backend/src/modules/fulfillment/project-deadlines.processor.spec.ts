import { ProjectDeadlinesProcessor } from './project-deadlines.processor';
import { scheduleProjectDeadlineJobs, shiftDateOnly } from './project-deadlines';

// E-admin-platform-3: reminder de livrare / termen depasit — no-op pe proiect inchis, pe data
// schimbata sau inainte de termen; cheia outbox e determinista (exact-o-data).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
// calendar simplificat (ora de perete ≈ UTC) — ordinea termenelor e ce conteaza aici
const calendar: Any = {
  bucharestWallClock: (d: string, h: number) => new Date(`${d}T${String(h).padStart(2, '0')}:00:00.000Z`),
  endOfBucharestDate: (d: string) => new Date(`${d}T23:59:59.999Z`),
};

function harness(opts: { status?: string; deliveryDate?: string | null; acceptedAt?: Date } = {}) {
  const tx: Any = { companyMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'm1' }]) } };
  const dd = opts.deliveryDate === undefined ? iso(Date.now() + 2 * DAY) : opts.deliveryDate;
  const prisma: Any = {
    request: {
      findUnique: jest.fn().mockResolvedValue({ status: opts.status ?? 'ACCEPTED', deletedAt: null, clientUserId: 'u-client' }),
    },
    quote: {
      findFirst: jest.fn().mockResolvedValue({
        claimSlotId: 's1',
        companyId: 'c1',
        acceptedAt: opts.acceptedAt ?? new Date(Date.now() - 30 * DAY),
        versions: [{ deliveryDate: dd ? new Date(`${dd}T00:00:00Z`) : null }],
      }),
    },
    $transaction: jest.fn((fn: (t: Any) => Promise<unknown>) => fn(tx)),
  };
  const outbox: Any = { record: jest.fn().mockResolvedValue(undefined) };
  const settings: Any = { getInt: jest.fn().mockResolvedValue(3) };
  const proc = new ProjectDeadlinesProcessor(prisma, outbox, calendar, settings);
  return { proc, tx, outbox, dd };
}

describe('ProjectDeadlinesProcessor', () => {
  it('reminder scadent → project.delivery_reminder catre membrii firmei, cheie determinista', async () => {
    const { proc, tx, outbox, dd } = harness();
    await proc.process({ name: 'delivery-reminder', data: { requestId: 'r1', deliveryDate: dd } } as Any);
    expect(outbox.record).toHaveBeenCalledWith(tx, `project.delivery_reminder:r1:${dd}`, 'project.delivery_reminder',
      expect.objectContaining({ requestId: 'r1', claimSlotId: 's1', deliveryDate: dd }), ['m1']);
  });

  it('termen depasit → project.overdue catre firma + client', async () => {
    const past = iso(Date.now() - 2 * DAY);
    const { proc, tx, outbox } = harness({ deliveryDate: past });
    await proc.process({ name: 'delivery-overdue', data: { requestId: 'r1', deliveryDate: past } } as Any);
    expect(outbox.record).toHaveBeenCalledWith(tx, `project.overdue:r1:${past}`, 'project.overdue',
      expect.objectContaining({ deliveryDate: past, clientUserId: 'u-client' }), ['m1', 'u-client']);
  });

  it.each(['CANCELLED', 'DELIVERED_BY_COMPANY', 'COMPLETED'])('proiect %s → no-op', async (status) => {
    const past = iso(Date.now() - 2 * DAY);
    const { proc, outbox } = harness({ status, deliveryDate: past });
    await proc.process({ name: 'delivery-overdue', data: { requestId: 'r1', deliveryDate: past } } as Any);
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('data de livrare diferita de cea a jobului → no-op', async () => {
    const { proc, outbox } = harness();
    await proc.process({ name: 'delivery-reminder', data: { requestId: 'r1', deliveryDate: '2020-01-01' } } as Any);
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('inainte de termen: overdue pe o data viitoare si reminder inca nescadent → no-op', async () => {
    const far = iso(Date.now() + 20 * DAY);
    const { proc, outbox } = harness({ deliveryDate: far });
    await proc.process({ name: 'delivery-overdue', data: { requestId: 'r1', deliveryDate: far } } as Any);
    await proc.process({ name: 'delivery-reminder', data: { requestId: 'r1', deliveryDate: far } } as Any);
    expect(outbox.record).not.toHaveBeenCalled();
  });

  it('acceptata DUPA momentul reminderului → reminder sarit', async () => {
    const { proc, outbox, dd } = harness({ acceptedAt: new Date() });
    await proc.process({ name: 'delivery-reminder', data: { requestId: 'r1', deliveryDate: dd } } as Any);
    expect(outbox.record).not.toHaveBeenCalled();
  });
});

describe('scheduleProjectDeadlineJobs', () => {
  it('programeaza reminderul la 09:00 cu N zile inainte + depasirea dupa sfarsitul zilei, cu jobId determinist', async () => {
    const queue: Any = { add: jest.fn().mockResolvedValue(undefined) };
    const now = Date.parse('2026-10-01T12:00:00Z');
    await scheduleProjectDeadlineJobs(queue, calendar, 'r1', '2026-10-20', 3, now);
    expect(queue.add).toHaveBeenCalledWith('delivery-reminder', { requestId: 'r1', deliveryDate: '2026-10-20' },
      expect.objectContaining({ jobId: 'proj-rem-r1-2026-10-20', delay: Date.parse('2026-10-17T09:00:00Z') - now }));
    expect(queue.add).toHaveBeenCalledWith('delivery-overdue', { requestId: 'r1', deliveryDate: '2026-10-20' },
      expect.objectContaining({ jobId: 'proj-overdue-r1-2026-10-20', delay: Date.parse('2026-10-21T00:00:00Z') - now }));
  });

  it('accept in fereastra reminderului → doar jobul de depasire', async () => {
    const queue: Any = { add: jest.fn().mockResolvedValue(undefined) };
    await scheduleProjectDeadlineJobs(queue, calendar, 'r1', '2026-10-20', 3, Date.parse('2026-10-18T12:00:00Z'));
    expect(queue.add).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledWith('delivery-overdue', expect.anything(), expect.anything());
  });

  it('shiftDateOnly trece peste luni si ani', () => {
    expect(shiftDateOnly('2026-03-02', -3)).toBe('2026-02-27');
    expect(shiftDateOnly('2027-01-01', -1)).toBe('2026-12-31');
  });
});
