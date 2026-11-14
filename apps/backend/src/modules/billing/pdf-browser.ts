import { ServiceUnavailableException, type Logger } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { ERROR_CODES } from '@marketplace/shared';
import type { Browser } from 'puppeteer';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { runTx } from '../../infra/prisma/tx';
import { safeErrorSummary } from '../../common/logging/safe-error';
import type { OutboxService } from '../outbox/outbox.service';
import { bucharestDate } from './ledger-check.service';
import { deploymentMode } from '../../config/deployment-mode';

// g4 (etapa 7) — pornirea Chrome-ului pentru PDF (oferta, proforma, factura) si alerta cand
// randarea pica. Pe productie imaginea seteaza PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
// (Dockerfile.app), pe care puppeteer il citeste singur. Local, puppeteer cauta Chrome-ul
// versiunii lui in ~/.cache/puppeteer; daca lipseste (ex. cache-ul are alta versiune), in afara
// productiei incercam un Chrome / Edge instalat, ca PDF-urile sa se poata testa local.

// puppeteer 25 e ESM-only; pastram import-ul dinamic real (vezi quote-pdf.service).
const loadPuppeteer = new Function('return import("puppeteer")') as () => Promise<
  typeof import('puppeteer')
>;

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox'];

// Cai uzuale ale unui browser instalat (doar in afara productiei, doar daca exista).
export function localBrowserCandidates(platform: NodeJS.Platform = process.platform): string[] {
  if (platform === 'win32') {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
  }
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  return ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/microsoft-edge'];
}

type LaunchFn = (opts: { headless: boolean; args: string[]; executablePath?: string }) => Promise<Browser>;

// Exportat pentru teste: launch + exists injectabile.
export async function launchWithFallback(
  launch: LaunchFn,
  opts: {
    env?: NodeJS.ProcessEnv;
    exists?: (p: string) => boolean;
    platform?: NodeJS.Platform;
    logger?: Pick<Logger, 'warn'>;
  } = {},
): Promise<Browser> {
  const env = opts.env ?? process.env;
  const exists = opts.exists ?? existsSync;
  try {
    return await launch({ headless: true, args: LAUNCH_ARGS });
  } catch (err) {
    // calea data explicit sau productia: nu ghicim alt browser
    if (env.PUPPETEER_EXECUTABLE_PATH || env.NODE_ENV === 'production') throw err;
    const fallback = localBrowserCandidates(opts.platform).find((p) => exists(p));
    if (!fallback) throw err;
    opts.logger?.warn(
      `PDF: Chrome-ul puppeteer lipseste (${safeErrorSummary(err)}); folosesc browserul local ${fallback}`,
    );
    return launch({ headless: true, args: LAUNCH_ARGS, executablePath: fallback });
  }
}

export async function launchPdfBrowser(logger?: Pick<Logger, 'warn'>): Promise<Browser> {
  const puppeteer = (await loadPuppeteer()).default;
  return launchWithFallback((o) => puppeteer.launch(o), { logger });
}

// g4 (revizie m7): un singur browser pe serviciu. Doua cereri simultane asteapta aceeasi pornire
// (o singura promisiune), iar dupa o eroare de randare browserul se inchide si se uita — un
// Chrome agatat dar "connected" nu mai blocheaza toate PDF-urile pana la repornire.
export class PdfBrowserHolder {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  constructor(
    private readonly launch: () => Promise<Browser>,
  ) {}

  async get(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;
    this.launching ??= this.launch()
      .then((b) => {
        this.browser = b;
        return b;
      })
      .finally(() => {
        this.launching = null;
      });
    return this.launching;
  }

  // dupa o randare ratata: inchide browserul (daca exista) ca urmatoarea cerere sa porneasca altul
  async reset(): Promise<void> {
    const b = this.browser;
    this.browser = null;
    await b?.close().catch(() => undefined);
  }

  async close(): Promise<void> {
    await this.reset();
  }
}

export type PdfDocumentKind = 'quote' | 'proforma' | 'invoice';

// g4 (revizie m6): frana in memorie — o singura incercare de alerta pe zi pe proces, ca o ruta GET
// ratata repetat sa nu deschida o tranzactie de scriere la fiecare cerere. Exportat pentru teste.
let alertedDay: string | null = null;
export function resetPdfAlertMemoryForTests(): void {
  alertedDay = null;
}

// Avertisment clar in jurnal + clopotelul adminilor, o data pe zi (cheia evenimentului are data
// zilei, Europe/Bucharest; outbox-ul ignora duplicatele). Payload fara date personale.
// Pe slotul standby (DEPLOYMENT_MODE=standby, doar citiri) — doar jurnalul, fara scriere.
// Nu arunca niciodata: alerta nu trebuie sa ascunda eroarea originala.
export async function reportPdfRenderFailure(
  deps: { prisma: PrismaService; outbox: OutboxService; logger: Pick<Logger, 'warn'> },
  kind: PdfDocumentKind,
  err: unknown,
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  deps.logger.warn(
    `PDF ${kind} nu s-a putut genera (Chrome/Chromium pentru PDF lipseste sau a cazut): ${safeErrorSummary(err)}`,
  );
  if (deploymentMode(env) === 'standby') return;
  const day = bucharestDate(now);
  if (alertedDay === day) return;
  alertedDay = day;
  try {
    await runTx(deps.prisma, 'write', async (tx) => {
      const admins = await tx.user.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } });
      await deps.outbox.record(tx, `documents.pdf_failed:${day}`, 'documents.pdf_failed', { day, kind }, admins.map((a) => a.id));
    });
  } catch (alertErr) {
    deps.logger.warn(`PDF: alerta catre admini nu s-a putut inregistra: ${safeErrorSummary(alertErr)}`);
  }
}

// Eroarea deja raportata de randare (alerta trimisa) — apelantii nu o mai raporteaza o data.
export function isDocumentRenderFailed(e: unknown): boolean {
  if (!(e instanceof ServiceUnavailableException)) return false;
  const body = e.getResponse();
  return typeof body === 'object' && body !== null && (body as { code?: string }).code === ERROR_CODES.DOCUMENT_RENDER_FAILED;
}

// Eroarea pentru om: 503 cu cod propriu (frontendul are mesaj RO/EN), nu 500 generic.
export function documentRenderFailed(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: ERROR_CODES.DOCUMENT_RENDER_FAILED,
    message: 'The PDF document could not be generated right now',
  });
}
