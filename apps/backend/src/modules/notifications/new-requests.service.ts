import { Injectable, Logger } from '@nestjs/common';
import { resolvePlanFeatures } from '@marketplace/shared';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { claimableStatuses } from '../claims/claims.constants';
import { EntitlementsService, activeSubscriptionWhere, type CompanyEntitlements } from '../entitlements/entitlements.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { OutboxService } from '../outbox/outbox.service';
import { NotificationEmailsService, type NewRequestDigestItem } from './notification-emails.service';

// g1-2 (PO, etapa 9): firmele afla de cererile noi din zona lor:
// 1) CLOPOTEL imediat ce cererea le devine vizibila (scanare la un minut). Vizibilitatea NU se
//    rescrie aici: e chiar lista din marketplace (MarketplaceService.list) cu intarzierea planului
//    (0 / 30 / 60 min), raza, excluderile si locurile libere — firma primeste anuntul doar pentru
//    ce ar vedea si in lista. Eligibilitatea firmei = aceleasi garzi ca ruta marketplace-ului
//    (firma aprobata / suspendare expirata + abonament activ cu MARKETPLACE_ACCESS).
//    Exact-o-data pe (cerere, firma): cheia outbox `request.new_in_area:<cerere>:<firma>`.
//    Cost (revizie M1): lista din marketplace se cere pentru o firma DOAR cand o cerere tocmai i-a
//    devenit vizibila (publicare + intarzierea planului ei in ultimele SCAN_CATCH_UP_MS) si perechea
//    nu a fost deja verificata; o rulare fara nimic nou = 1 interogare.
// 2) REZUMAT ZILNIC pe e-mail (08:00, ora Romaniei): cererile anuntate firmei in ultimele 24 h,
//    inca vizibile, intr-un singur e-mail catre proprietar + manageri. Nicio cerere de doua ori:
//    fiecare cerere are un singur rand outbox pe firma, iar companies.new_requests_digest_until
//    tine minte pana unde a mers rezumatul (revendicat chiar inainte de trimitere → fara dubluri).

export const NEW_IN_AREA_EVENT = 'request.new_in_area';
// Recuperare: o pereche (cerere, firma) devenita vizibila in ultimele 20 min e inca prinsa — acopera
// o rulare sarita, o repornire sau o coada blocata pana la 20 de minute.
export const SCAN_CATCH_UP_MS = 20 * 60 * 1000;
// Ceasul aplicatiei vs ceasul bazei (lista foloseste now() din SQL): perechea devine „scadenta” la
// 30 s dupa momentul vizibilitatii, ca lista sa o arate sigur.
export const VISIBILITY_SETTLE_MS = 30 * 1000;
// Firmele eligibile (abonament + plan) se recitesc cel mult o data la 5 minute.
export const ELIGIBLE_CACHE_MS = 5 * 60 * 1000;
// Intarzierea maxima presupusa pana la prima citire a planurilor
const DEFAULT_MAX_GATING_MIN = 60;
export const DIGEST_WINDOW_MS = 24 * 60 * 60 * 1000;

export function newInAreaKey(requestId: string, companyId: string): string {
  return `${NEW_IN_AREA_EVENT}:${requestId}:${companyId}`;
}

export interface EligibleCompany {
  id: string;
  name: string;
  gatingMinutes: number;
  digestUntil: Date | null;
}

@Injectable()
export class NewRequestsService {
  private readonly logger = new Logger(NewRequestsService.name);
  private eligibleCache: { at: number; companies: EligibleCompany[] } | null = null;
  private maxGatingMin = DEFAULT_MAX_GATING_MIN;
  // perechile (cerere, firma) deja verificate in aceasta instanta → cheie → momentul verificarii
  private readonly checked = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly marketplace: MarketplaceService,
    private readonly outbox: OutboxService,
    private readonly emails: NotificationEmailsService,
  ) {}

  // Firmele care pot deschide azi marketplace-ul (in oglinda cu CompanyApprovedGuard +
  // SubscriptionActiveGuard), cu intarzierea planului. O singura interogare (cu relatiile ei),
  // indiferent de numarul de firme: abonamentul activ cel mai lung + planul + functiile lui, exact
  // ca EntitlementsService.forCompany (acelasi predicat activeSubscriptionWhere, aceeasi rezolvare
  // a functiilor), iar MARKETPLACE_ACCESS se verifica prin EntitlementsService.has.
  async eligibleCompanies(now: Date = new Date()): Promise<EligibleCompany[]> {
    const companies = await this.prisma.company.findMany({
      where: {
        deletedAt: null,
        OR: [{ status: 'APPROVED' }, { status: 'SUSPENDED', suspendedUntil: { lte: now } }],
        subscriptions: { some: activeSubscriptionWhere(now) },
      },
      select: {
        id: true,
        name: true,
        newRequestsDigestUntil: true,
        subscriptions: {
          where: activeSubscriptionWhere(now),
          orderBy: { expiresAt: 'desc' },
          take: 1,
          select: { plan: { select: { marketplaceGatingDelayMin: true, features: true } } },
        },
      },
    });
    const out: EligibleCompany[] = [];
    for (const c of companies) {
      const plan = c.subscriptions[0]?.plan;
      if (!plan) continue;
      const e = { features: resolvePlanFeatures(plan.features) } as CompanyEntitlements;
      if (!this.entitlements.has(e, 'MARKETPLACE_ACCESS')) continue;
      out.push({ id: c.id, name: c.name, gatingMinutes: plan.marketplaceGatingDelayMin ?? 0, digestUntil: c.newRequestsDigestUntil });
    }
    return out;
  }

  private async cachedEligible(now: Date): Promise<EligibleCompany[]> {
    if (this.eligibleCache && now.getTime() - this.eligibleCache.at < ELIGIBLE_CACHE_MS) return this.eligibleCache.companies;
    const companies = await this.eligibleCompanies(now);
    this.eligibleCache = { at: now.getTime(), companies };
    return companies;
  }

  private recentRequests(now: Date, maxGatingMin: number) {
    return this.prisma.request.findMany({
      where: {
        deletedAt: null,
        // multimea larga (cu „dupa prima oferta”); regula exacta o aplica lista din marketplace
        status: { in: claimableStatuses(true) },
        publishedAt: { gte: new Date(now.getTime() - maxGatingMin * 60_000 - SCAN_CATCH_UP_MS - VISIBILITY_SETTLE_MS) },
      },
      select: { id: true, publishedAt: true },
    });
  }

  // Clopotelul „cerere noua in zona ta”. Intoarce cate anunturi noi s-au scris.
  async scanNewInArea(now: Date = new Date()): Promise<number> {
    this.pruneChecked(now);
    let windowMin = this.maxGatingMin;
    let recent = await this.recentRequests(now, windowMin);
    if (recent.length === 0) return 0; // cazul obisnuit: o singura interogare
    const companies = await this.cachedEligible(now);
    if (companies.length === 0) return 0;
    this.maxGatingMin = Math.max(DEFAULT_MAX_GATING_MIN, ...companies.map((c) => c.gatingMinutes));
    if (this.maxGatingMin > windowMin) {
      // un plan cu intarziere mai mare decat fereastra folosita → recitire o data, cu fereastra corecta
      windowMin = this.maxGatingMin;
      recent = await this.recentRequests(now, windowMin);
    }

    // perechile scadente: cererea a devenit vizibila firmei in (acum − recuperare, acum − 30 s]
    const dueByCompany = new Map<string, Set<string>>();
    const dueKeys: string[] = [];
    const latest = now.getTime() - VISIBILITY_SETTLE_MS;
    const earliest = latest - SCAN_CATCH_UP_MS;
    for (const company of companies) {
      for (const r of recent) {
        if (!r.publishedAt) continue;
        const visibleAt = r.publishedAt.getTime() + company.gatingMinutes * 60_000;
        if (visibleAt > latest || visibleAt <= earliest) continue;
        const key = newInAreaKey(r.id, company.id);
        if (this.checked.has(key)) continue;
        const set = dueByCompany.get(company.id) ?? new Set<string>();
        set.add(r.id);
        dueByCompany.set(company.id, set);
        dueKeys.push(key);
      }
    }
    if (dueKeys.length === 0) return 0;

    // deja anuntate (alta instanta / inainte de repornire) → o singura interogare pentru toate
    const done = new Set(
      (await this.prisma.domainEventOutbox.findMany({ where: { eventKey: { in: dueKeys } }, select: { eventKey: true } }))
        .map((r) => r.eventKey),
    );
    for (const key of done) this.checked.set(key, now.getTime());

    let written = 0;
    for (const company of companies) {
      const due = dueByCompany.get(company.id);
      if (!due) continue;
      const pending = [...due].filter((id) => !done.has(newInAreaKey(id, company.id)));
      if (pending.length === 0) continue;
      // lista din marketplace = regula de vizibilitate (intarziere, raza, excluderi, locuri)
      const pendingSet = new Set(pending);
      const visible = (await this.marketplace.list(company.id, company.gatingMinutes)).filter((i) => pendingSet.has(i.id));
      // verificata (vizibila sau nu — in afara razei, exclusa, plina) → nu se mai cere lista pentru ea
      for (const id of pending) this.checked.set(newInAreaKey(id, company.id), now.getTime());
      if (visible.length === 0) continue;
      const members = await this.prisma.companyMember.findMany({
        where: { companyId: company.id, user: { deletedAt: null, blockedAt: null } },
        select: { userId: true },
      });
      if (members.length === 0) continue;
      const memberIds = members.map((m) => m.userId);
      await runTx(this.prisma, 'write', async (tx) => {
        for (const item of visible) {
          // titlul e cel mascat din marketplace (dispecerul il rehidrateaza; EventBus il mascheaza din nou)
          await this.outbox.record(tx, newInAreaKey(item.id, company.id), NEW_IN_AREA_EVENT,
            { requestId: item.id, requestTitle: item.title, companyId: company.id },
            memberIds,
          );
        }
      });
      written += visible.length;
    }
    return written;
  }

  // perechile mai vechi decat fereastra de recuperare nu mai pot fi scadente → afara din memorie
  private pruneChecked(now: Date): void {
    const limit = now.getTime() - SCAN_CATCH_UP_MS - 2 * VISIBILITY_SETTLE_MS - ELIGIBLE_CACHE_MS;
    for (const [key, at] of this.checked) if (at < limit) this.checked.delete(key);
  }

  // Rezumatul zilnic pe e-mail. Intoarce cate firme au primit rezumatul.
  async sendDailyDigest(now: Date = new Date()): Promise<number> {
    const windowStart = new Date(now.getTime() - DIGEST_WINDOW_MS);
    const rows = await this.prisma.domainEventOutbox.findMany({
      where: { eventType: NEW_IN_AREA_EVENT, createdAt: { gt: windowStart, lte: now } },
      select: { payload: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    if (rows.length === 0) return 0; // nimic nou → niciun e-mail
    const byCompany = new Map<string, { requestId: string; createdAt: Date }[]>();
    for (const row of rows) {
      const p = (row.payload ?? {}) as Record<string, unknown>;
      if (typeof p.companyId !== 'string' || typeof p.requestId !== 'string') continue;
      const list = byCompany.get(p.companyId) ?? [];
      list.push({ requestId: p.requestId, createdAt: row.createdAt });
      byCompany.set(p.companyId, list);
    }
    let sentCompanies = 0;
    for (const company of await this.eligibleCompanies(now)) {
      const entries = byCompany.get(company.id);
      if (!entries) continue;
      const since = company.digestUntil && company.digestUntil > windowStart ? company.digestUntil : windowStart;
      const fresh = entries.filter((e) => e.createdAt > since);
      if (fresh.length === 0) continue;
      const freshIds = new Set(fresh.map((e) => e.requestId));
      // revizie m1: INTAI lista (o eroare aici nu misca marcajul → reluarea jobului trimite rezumatul),
      // doar cererile inca vizibile, cu datele din lista marketplace-ului (titlu mascat)
      const items: NewRequestDigestItem[] = (await this.marketplace.list(company.id, company.gatingMinutes))
        .filter((i) => freshIds.has(i.id))
        .map((i) => ({ requestId: i.id, title: i.title, city: i.city, county: i.county }));
      if (items.length === 0) continue;
      // revendicare conditionata IMEDIAT inainte de trimitere: doua rulari suprapuse (retry, doua
      // instante) nu trimit acelasi rezumat
      const claimed = await this.prisma.company.updateMany({
        where: { id: company.id, newRequestsDigestUntil: company.digestUntil },
        data: { newRequestsDigestUntil: now },
      });
      if (claimed.count !== 1) continue;
      const sent = await this.emails.sendNewRequestsDigest({ id: company.id, name: company.name }, items);
      if (sent > 0) sentCompanies += 1;
      else this.logger.warn(`rezumatul cererilor noi pentru firma ${company.id} nu a plecat la niciun destinatar (${items.length} cereri)`);
    }
    this.logger.debug(`rezumat cereri noi: ${sentCompanies} firme`);
    return sentCompanies;
  }
}
