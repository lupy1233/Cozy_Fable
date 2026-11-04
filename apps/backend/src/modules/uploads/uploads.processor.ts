import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUE_UPLOADS } from '../../infra/queues/queues.module';
import { UploadsService } from './uploads.service';

// E-client-9 (C7-3): curatarea fisierelor REQUEST vechi (EXIF + nume in cheie), pornita la boot
// pe slotul activ; se re-programeaza singura cat mai sunt randuri (cursor pe id).
const LEGACY_SANITIZE_JOB = 'sanitize.legacy';
const LEGACY_SANITIZE_JOB_ID = 'upload-legacy-sanitize';
const LEGACY_SANITIZE_DELAY_MS = 5_000;

interface UploadsJobData {
  attachmentId?: string;
  cursor?: string;
}

@Processor(QUEUE_UPLOADS)
export class UploadsProcessor extends WorkerHost implements OnModuleInit {
  constructor(private readonly uploads: UploadsService, @InjectQueue(QUEUE_UPLOADS) private readonly queue: Queue) { super(); }

  async onModuleInit(): Promise<void> {
    const options = { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 1000 };
    await this.queue.add('reconcile.uploads', {}, { ...options, repeat: { every: 60_000 } });
    await this.queue.add('reconcile.uploads', {}, { ...options, jobId: 'upload-startup-reconciliation' });
    await this.queue.add(LEGACY_SANITIZE_JOB, {}, { ...options, jobId: LEGACY_SANITIZE_JOB_ID });
  }

  async process(job: Job<UploadsJobData>): Promise<void> {
    if (job.name === 'reconcile.uploads') await this.uploads.reconcileScans();
    else if (job.name === 'scan.upload' && job.data.attachmentId) await this.uploads.scan(job.data.attachmentId);
    else if (job.name === LEGACY_SANITIZE_JOB) {
      const { more, cursor } = await this.uploads.sanitizeLegacyRequestAttachments(undefined, job.data.cursor);
      // jobId diferit de cel curent (inca activ) — altfel BullMQ ignora adaugarea
      if (more && cursor) {
        await this.queue.add(LEGACY_SANITIZE_JOB, { cursor }, {
          jobId: `${LEGACY_SANITIZE_JOB_ID}-${cursor}`,
          delay: LEGACY_SANITIZE_DELAY_MS,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: 1000,
        });
      }
    }
  }
}
