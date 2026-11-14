import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type RequestStatus } from '@prisma/client';
import { SettingsService } from '../../common/settings/settings.service';
import { SETTING_DEFAULTS } from '../../common/settings/setting-defaults';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { StorageService } from '../../infra/storage/storage.service';
import { ENTITY_TYPE_REQUEST } from './requests.constants';

// f6 (PO f6-1, 2026-11-13): ciornele neatinse (dupa updated_at) se sterg — ale vizitatorilor
// (fara cont) dupa 7 zile, ale clientilor cu cont dupa 90; ambele editabile din Admin.
export const SETTING_GUEST_DRAFT_RETENTION_DAYS = 'guest_draft_retention_days';
export const SETTING_CLIENT_DRAFT_RETENTION_DAYS = 'client_draft_retention_days';

// pe loturi mici, cu limita pe rulare: restul ramane pentru rularea de maine
export const DRAFT_CLEANUP_BATCH = 50;
export const DRAFT_CLEANUP_MAX_PER_RUN = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DraftCleanupResult = { deleted: number; failed: number; skipped: number };

type LockedDraftRow = {
  status: RequestStatus;
  deleted_at: Date | null;
  client_user_id: string | null;
  updated_at: Date;
};

type Cutoffs = { guest: Date; client: Date; deletedBefore: Date };

// revizie m1: o ciorna marcata stearsa se curata abia dupa cateva minute (o urcare prin URL
// presemnat sau o sigilare de fisier pornita chiar inainte de aruncare are timp sa se termine)
export const DRAFT_CLEANUP_DELETED_GRACE_MS = 30 * 60 * 1000;

// Reguli de fier (sarcina e9-drafts):
// - se ating DOAR randuri cu status DRAFT; starea se verifica din nou, sub FOR UPDATE, in
//   tranzactia care marcheaza ciorna si in cea care o sterge;
// - ordinea: (0) ciorna e marcata stearsa (tokenul moare → nu mai poate fi salvata / publicata),
//   (1) fisierele din storage, (2) randurile din attachments + ciorna (camere, contacte, scene
//   Studio etc. pleaca prin ON DELETE CASCADE);
// - un fisier se sterge din storage doar daca nicio alta inregistrare nu-i foloseste cheia;
// - esecul unui fisier lasa ciorna (marcata stearsa) pentru rularea urmatoare + o linie in
//   jurnal, doar cu id-uri (fara date personale);
// - idempotent: o rulare intrerupta se reia (ciornele marcate intra din nou pe ramura deleted_at;
//   stergerea unui obiect deja disparut din S3 nu e o eroare).
@Injectable()
export class DraftCleanupService {
  private readonly logger = new Logger(DraftCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  // zile >= 1; o valoare lipsa / stricata / sub 1 cade pe implicit (niciodata "sterge tot")
  private async retentionDays(key: string, fallback: number): Promise<number> {
    const n = await this.settings.getInt(key, fallback);
    return Number.isSafeInteger(n) && n >= 1 ? n : fallback;
  }

  async cutoffs(now: Date): Promise<Cutoffs> {
    const [guestDays, clientDays] = await Promise.all([
      this.retentionDays(SETTING_GUEST_DRAFT_RETENTION_DAYS, SETTING_DEFAULTS.guest_draft_retention_days),
      this.retentionDays(SETTING_CLIENT_DRAFT_RETENTION_DAYS, SETTING_DEFAULTS.client_draft_retention_days),
    ]);
    return {
      guest: new Date(now.getTime() - guestDays * DAY_MS),
      client: new Date(now.getTime() - clientDays * DAY_MS),
      deletedBefore: new Date(now.getTime() - DRAFT_CLEANUP_DELETED_GRACE_MS),
    };
  }

  async run(now = new Date()): Promise<DraftCleanupResult> {
    const cutoffs = await this.cutoffs(now);
    const result: DraftCleanupResult = { deleted: 0, failed: 0, skipped: 0 };
    let lastId: string | undefined;
    let seen = 0;
    while (seen < DRAFT_CLEANUP_MAX_PER_RUN) {
      const batch = await this.listCandidates(cutoffs, lastId, Math.min(DRAFT_CLEANUP_BATCH, DRAFT_CLEANUP_MAX_PER_RUN - seen));
      if (batch.length === 0) break;
      for (const { id } of batch) {
        const outcome = await this.deleteDraft(id, cutoffs, now).catch((e: unknown) => {
          this.logger.warn(`draft cleanup: request=${id} failed (${e instanceof Error ? e.name : 'error'})`);
          return 'failed' as const;
        });
        result[outcome] += 1;
      }
      seen += batch.length;
      lastId = batch[batch.length - 1].id;
      if (batch.length < DRAFT_CLEANUP_BATCH) break;
    }
    if (result.deleted > 0 || result.failed > 0) {
      this.logger.log(`draft cleanup: ${JSON.stringify(result)}`);
    }
    return result;
  }

  // Revizie M1: listarea trebuie sa vada si randurile cu deleted_at (ciorne aruncate / marcate de o
  // rulare intrerupta). Prisma findMany pe Request trece prin middleware-ul softDeleteReads, care
  // adauga mereu deleted_at IS NULL si ar anula ramura asta → SQL direct, cu acelasi filtru strict
  // pe status = 'DRAFT'. Starea se reverifica oricum sub lock in deleteDraft.
  async listCandidates(cutoffs: Cutoffs, lastId: string | undefined, take: number): Promise<{ id: string }[]> {
    const after = lastId ? Prisma.sql`AND id > ${lastId}` : Prisma.empty;
    return this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM requests
      WHERE status = 'DRAFT'
        AND (
          (deleted_at IS NOT NULL AND deleted_at < ${cutoffs.deletedBefore})
          OR (deleted_at IS NULL AND client_user_id IS NULL AND updated_at < ${cutoffs.guest})
          OR (deleted_at IS NULL AND client_user_id IS NOT NULL AND updated_at < ${cutoffs.client})
        )
        ${after}
      ORDER BY id ASC
      LIMIT ${take}`;
  }

  private static eligible(row: LockedDraftRow | undefined, cutoffs: Cutoffs): boolean {
    if (!row || row.status !== 'DRAFT') return false;
    // revizie m1: o ciorna aruncata chiar acum poate avea o urcare / sigilare de fisier in curs
    if (row.deleted_at !== null) return row.deleted_at.getTime() < cutoffs.deletedBefore.getTime();
    const cutoff = row.client_user_id === null ? cutoffs.guest : cutoffs.client;
    return row.updated_at.getTime() < cutoff.getTime();
  }

  // Intoarce 'deleted' / 'skipped' (nu mai e eligibila: publicata, atinsa intre timp) / 'failed'.
  async deleteDraft(id: string, cutoffs: Cutoffs, now: Date): Promise<keyof DraftCleanupResult> {
    // (0) re-verificare sub lock + marcare: dupa commit tokenul nu mai deschide ciorna, deci
    // publicarea / salvarea / atasamentele nu mai pot ajunge la ea (publish reverifica sub lock)
    const marked = await runTx(this.prisma, 'write', async (tx) => {
      const [row] = await tx.$queryRaw<LockedDraftRow[]>`
        SELECT status, deleted_at, client_user_id, updated_at FROM requests WHERE id = ${id} FOR UPDATE`;
      if (!DraftCleanupService.eligible(row, cutoffs)) return false;
      if (row.deleted_at === null) {
        await tx.request.updateMany({
          where: { id, status: 'DRAFT', deletedAt: null },
          data: { deletedAt: now, draftTokenHash: null },
        });
      }
      return true;
    });
    if (!marked) return 'skipped';

    // (1) fisierele din storage — doar cheile pe care nu le mai foloseste nimeni altcineva
    const attachments = await this.prisma.attachment.findMany({
      where: { entityType: ENTITY_TYPE_REQUEST, entityId: id },
      select: { id: true, storageKey: true },
    });
    // revizie m1: perechile (id, storageKey) chiar asa cum au fost sterse din storage
    const handled: { id: string; storageKey: string }[] = [];
    for (const a of attachments) {
      const shared = await this.prisma.attachment.count({ where: { storageKey: a.storageKey, id: { not: a.id } } });
      if (shared === 0) {
        try {
          await this.storage.deleteObject(a.storageKey);
        } catch (e) {
          this.logger.warn(`draft cleanup: request=${id} attachment=${a.id} storage delete failed (${e instanceof Error ? e.name : 'error'}); retry next run`);
          return 'failed';
        }
      }
      handled.push({ id: a.id, storageKey: a.storageKey });
    }

    // (2) randurile — din nou sub lock: doar o ciorna DRAFT marcata stearsa, fara fisiere noi
    const deleted = await runTx(this.prisma, 'write', async (tx) => {
      const [row] = await tx.$queryRaw<LockedDraftRow[]>`
        SELECT status, deleted_at, client_user_id, updated_at FROM requests WHERE id = ${id} FOR UPDATE`;
      if (!row || row.status !== 'DRAFT' || row.deleted_at === null) return false;
      // un rand a carui cheie s-a schimbat intre timp (sigilare / imagine curatata / urcare in curs)
      // ramane: left > 0 → 'skipped', ciorna se reia la rularea urmatoare (cheia noua nu ramane orfana)
      if (handled.length > 0) {
        await tx.attachment.deleteMany({
          where: { entityType: ENTITY_TYPE_REQUEST, entityId: id, OR: handled.map((h) => ({ id: h.id, storageKey: h.storageKey })) },
        });
      }
      const left = await tx.attachment.count({ where: { entityType: ENTITY_TYPE_REQUEST, entityId: id } });
      if (left > 0) return false;
      // camere, contacte, versiuni, scene Studio, poze de inspiratie: ON DELETE CASCADE
      const res = await tx.request.deleteMany({ where: { id, status: 'DRAFT', deletedAt: { not: null } } });
      return res.count === 1;
    });
    return deleted ? 'deleted' : 'skipped';
  }
}
