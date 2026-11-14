import {
  type AttachmentDto,
  ERROR_CODES,
  type PresignUploadResultDto,
} from '@marketplace/shared';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { isSanitizableImage } from './image-sanitizer';
import { PORTFOLIO_ENTITY_TYPE, UploadsService, type PresignInput } from './uploads.service';

// h1 (etapa 11): poza unei lucrari din portofoliul firmei — fisier PUBLIC (pagina Firme
// partenere), deci regulile sunt mai stricte decat la fisierele cererii:
//  - doar JPEG / PNG / WebP (fara PDF / ZIP / SVG), verificate si dupa continut la scan;
//  - cheia o face serverul, in spatiul firmei: company_portfolio/<companyId>/<attachmentId>/...;
//  - incarcarea sta intai "in asteptare" pe firma (entity_id = company_id) si se muta pe lucrare
//    (entity_id = item_id) doar dupa ce a trecut scanul (SAFE) — o singura poza pe lucrare;
//  - stergerea / inlocuirea lucrarii sterge si obiectul din storage.
// Invarianta 3.4: nimic nu trece prin Nest — presigned PUT la incarcare, presigned GET la citire.

// h1 (revizuire M2): plafonul de lucrari din portofoliu pe firma — hotararea coordonatorului,
// de confirmat de PO. Firmele care au deja mai multe nu pierd nimic, doar nu mai pot adauga.
export const MAX_PORTFOLIO_ITEMS = 30;
// cate incarcari neatasate poate avea o firma deodata (dialogul foloseste una)
export const MAX_STAGED_PORTFOLIO_UPLOADS = 3;
// incarcarile neatasate mai vechi de atat sunt abandonate → se sterg la urmatoarea incarcare
const STALE_STAGED_MS = 60 * 60 * 1000;

@Injectable()
export class PortfolioImagesService {
  private readonly logger = new Logger(PortfolioImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly storage: StorageService,
  ) {}

  async presign(companyId: string, input: PresignInput): Promise<PresignUploadResultDto> {
    // doar imagini; tipul declarat se mai verifica la PUT (Content-Type semnat), la confirm
    // (HEAD) si dupa continut la scan (octetii de inceput + decodare)
    if (!isSanitizableImage(input.mimeType)) {
      throw new BadRequestException({ code: ERROR_CODES.FILE_TYPE_NOT_ALLOWED, message: 'Only JPEG, PNG or WebP images are allowed' });
    }
    await this.removeStaleStaged(companyId);
    return this.uploads.presign(PORTFOLIO_ENTITY_TYPE, companyId, input, MAX_STAGED_PORTFOLIO_UPLOADS);
  }

  // Confirmarea cauta randul DOAR in spatiul firmei curente → un id din alta firma = 404.
  async confirm(companyId: string, attachmentId: string): Promise<AttachmentDto> {
    const attachment = await this.uploads.confirm(PORTFOLIO_ENTITY_TYPE, companyId, attachmentId);
    return { ...attachment, downloadUrl: null };
  }

  // Muta incarcarea SAFE a firmei pe lucrare si scoate pozele vechi ale lucrarii (in tx).
  // Intoarce cheile de sters din storage DUPA commit (nu stergem fisiere la un rollback).
  async attachInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    itemId: string,
    attachmentId: string,
  ): Promise<string[]> {
    // m3: doua atasari simultane pe aceeasi lucrare se executa pe rand (a doua vede poza primei
    // ca "veche" si o scoate) → ramane mereu o singura poza
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`portfolio_item:${itemId}`}, 0))::text`;
    const previous = await tx.attachment.findMany({
      where: { entityType: PORTFOLIO_ENTITY_TYPE, entityId: itemId },
      select: { id: true, storageKey: true },
    });
    // relink verifica: randul exista in spatiul firmei (altfel NOT_FOUND) si e SAFE
    await this.uploads.relink([attachmentId], PORTFOLIO_ENTITY_TYPE, companyId, itemId, tx);
    const old = previous.filter((p) => p.id !== attachmentId);
    if (old.length > 0) {
      await tx.attachment.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
    return old.map((o) => o.storageKey);
  }

  // Randurile + cheile pozelor unor lucrari (inainte de stergerea lucrarilor).
  async keysForItems(itemIds: string[], db: Prisma.TransactionClient = this.prisma): Promise<string[]> {
    if (itemIds.length === 0) return [];
    const rows = await db.attachment.findMany({
      where: { entityType: PORTFOLIO_ENTITY_TYPE, entityId: { in: itemIds } },
      select: { storageKey: true },
    });
    return rows.map((r) => r.storageKey);
  }

  async deleteRowsForItems(itemIds: string[], db: Prisma.TransactionClient = this.prisma): Promise<void> {
    if (itemIds.length === 0) return;
    await db.attachment.deleteMany({ where: { entityType: PORTFOLIO_ENTITY_TYPE, entityId: { in: itemIds } } });
  }

  // best-effort: un obiect ramas (storage indisponibil) nu mai e referit de niciun rand
  async deleteObjects(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((k) =>
        this.storage.deleteObject(k).catch(() => {
          // m9: cheia e neutra (company_portfolio/<companyId>/<attachmentId>/clean-<uuid>.<ext>, fara
          // nume de fisier sau date personale) → se scrie, ca obiectul sa poata fi sters de mana
          this.logger.warn(`Portfolio image object could not be deleted: ${k}`);
        }),
      ),
    );
  }

  // Legatura publica a pozei: presigned GET (5 min), doar pentru pozele SAFE ale lucrarilor date.
  async urlsForItems(itemIds: string[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    if (itemIds.length === 0) return urls;
    const rows = await this.prisma.attachment.findMany({
      where: { entityType: PORTFOLIO_ENTITY_TYPE, entityId: { in: itemIds }, status: 'SAFE' },
      select: { entityId: true, storageKey: true },
    });
    await Promise.all(
      rows.map(async (r) => {
        urls.set(r.entityId, await this.storage.getPresignedDownloadUrl(r.storageKey));
      }),
    );
    return urls;
  }

  private async removeStaleStaged(companyId: string): Promise<void> {
    const stale = await this.prisma.attachment.findMany({
      where: {
        entityType: PORTFOLIO_ENTITY_TYPE,
        entityId: companyId,
        createdAt: { lt: new Date(Date.now() - STALE_STAGED_MS) },
      },
      select: { id: true, storageKey: true },
    });
    if (stale.length === 0) return;
    // m2: stergerea e conditionata pe "inca neatasat" (entity_id = firma) si pe aceeasi cheie;
    // un rand atasat intre timp unei lucrari (sau rescris de scan) ramane, cu tot cu fisier
    const removed: string[] = [];
    for (const s of stale) {
      const res = await this.prisma.attachment.deleteMany({
        where: { id: s.id, entityType: PORTFOLIO_ENTITY_TYPE, entityId: companyId, storageKey: s.storageKey },
      });
      if (res.count > 0) removed.push(s.storageKey);
    }
    await this.deleteObjects(removed);
  }
}
