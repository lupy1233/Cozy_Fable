import { ServiceUnavailableException } from '@nestjs/common';
import {
  PdfBrowserHolder,
  documentRenderFailed,
  isDocumentRenderFailed,
  launchWithFallback,
  localBrowserCandidates,
  reportPdfRenderFailure,
  resetPdfAlertMemoryForTests,
} from './pdf-browser';

// g4 (etapa 7) — Chrome pentru PDF: fallback local doar in afara productiei; alerta o data pe zi.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const browser = { connected: true } as Any;
const logger = () => ({ warn: jest.fn() });

describe('launchWithFallback', () => {
  it('Chrome-ul puppeteer exista → il foloseste, fara cale explicita', async () => {
    const launch = jest.fn().mockResolvedValue(browser);
    await expect(launchWithFallback(launch, { env: {} })).resolves.toBe(browser);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch.mock.calls[0][0].executablePath).toBeUndefined();
  });

  it('local: Chrome-ul versiunii lipseste → Edge instalat, cu avertisment', async () => {
    const launch = jest.fn().mockRejectedValueOnce(new Error('Could not find Chrome (ver. 149)')).mockResolvedValue(browser);
    const log = logger();
    const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    await expect(
      launchWithFallback(launch, { env: { NODE_ENV: 'development' }, platform: 'win32', exists: (p) => p === edge, logger: log }),
    ).resolves.toBe(browser);
    expect(launch.mock.calls[1][0].executablePath).toBe(edge);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining(edge));
  });

  it('productie sau cale data explicit → eroarea originala, fara alt browser', async () => {
    const boom = new Error('no chromium');
    for (const env of [{ NODE_ENV: 'production' }, { PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium' }]) {
      const launch = jest.fn().mockRejectedValue(boom);
      await expect(launchWithFallback(launch, { env, platform: 'win32', exists: () => true })).rejects.toBe(boom);
      expect(launch).toHaveBeenCalledTimes(1);
    }
  });

  it('local fara niciun browser instalat → eroarea originala', async () => {
    const boom = new Error('no chrome');
    const launch = jest.fn().mockRejectedValue(boom);
    await expect(launchWithFallback(launch, { env: {}, platform: 'linux', exists: () => false })).rejects.toBe(boom);
  });

  it('candidatii depind de sistem', () => {
    expect(localBrowserCandidates('win32').some((p) => p.endsWith('msedge.exe'))).toBe(true);
    expect(localBrowserCandidates('linux')).toContain('/usr/bin/chromium');
  });
});

describe('reportPdfRenderFailure', () => {
  beforeEach(() => resetPdfAlertMemoryForTests());

  it('revizie m6: a doua ratare in aceeasi zi → doar jurnalul, fara tranzactie; ziua urmatoare → din nou', async () => {
    const d = deps();
    const day1 = new Date('2026-11-14T10:00:00Z');
    await reportPdfRenderFailure(d, 'quote', new Error('x'), day1);
    await reportPdfRenderFailure(d, 'quote', new Error('x'), new Date('2026-11-14T12:00:00Z'));
    expect(d.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(d.logger.warn).toHaveBeenCalledTimes(2);
    await reportPdfRenderFailure(d, 'quote', new Error('x'), new Date('2026-11-15T10:00:00Z'));
    expect(d.prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('revizie m6: slotul standby (doar citiri) → doar jurnalul, nicio scriere', async () => {
    const d = deps();
    await reportPdfRenderFailure(d, 'invoice', new Error('x'), new Date(), { DEPLOYMENT_MODE: 'standby' });
    expect(d.prisma.$transaction).not.toHaveBeenCalled();
    expect(d.logger.warn).toHaveBeenCalledTimes(1);
  });

  function deps() {
    const tx = { user: { findMany: jest.fn().mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]) } };
    const prisma = { $transaction: jest.fn((fn: Any) => fn(tx)) } as Any;
    const outbox = { record: jest.fn().mockResolvedValue(undefined) } as Any;
    return { prisma, outbox, logger: logger(), tx };
  }

  it('avertisment in jurnal + un clopotel pe zi catre admini (cheie cu data Bucuresti, fara date personale)', async () => {
    const d = deps();
    // 23:30 UTC pe 14 nov = 15 nov in Bucuresti
    await reportPdfRenderFailure(d, 'proforma', new Error('launch failed'), new Date('2026-11-14T23:30:00Z'));
    expect(d.logger.warn).toHaveBeenCalledWith(expect.stringContaining('PDF proforma nu s-a putut genera'));
    expect(d.outbox.record).toHaveBeenCalledWith(
      expect.anything(),
      'documents.pdf_failed:2026-11-15',
      'documents.pdf_failed',
      { day: '2026-11-15', kind: 'proforma' },
      ['a1', 'a2'],
    );
  });

  it('alerta care pica nu arunca (eroarea originala ramane cea vazuta de om)', async () => {
    const d = deps();
    d.prisma.$transaction.mockRejectedValue(new Error('db down'));
    await expect(reportPdfRenderFailure(d, 'quote', new Error('x'))).resolves.toBeUndefined();
    expect(d.logger.warn).toHaveBeenCalledTimes(2);
  });
});

describe('PdfBrowserHolder (revizie m7)', () => {
  it('doua cereri simultane → o singura pornire; browserul conectat se refoloseste', async () => {
    const b = { connected: true, close: jest.fn().mockResolvedValue(undefined) } as Any;
    let release!: (v: Any) => void;
    const launch = jest.fn(() => new Promise<Any>((r) => (release = r)));
    const holder = new PdfBrowserHolder(launch);
    const p1 = holder.get();
    const p2 = holder.get();
    release(b);
    await expect(Promise.all([p1, p2])).resolves.toEqual([b, b]);
    await holder.get();
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('reset dupa eroare → inchide browserul si urmatoarea cerere porneste altul', async () => {
    const b1 = { connected: true, close: jest.fn().mockResolvedValue(undefined) } as Any;
    const b2 = { connected: true, close: jest.fn().mockResolvedValue(undefined) } as Any;
    const launch = jest.fn().mockResolvedValueOnce(b1).mockResolvedValueOnce(b2);
    const holder = new PdfBrowserHolder(launch);
    await holder.get();
    await holder.reset();
    expect(b1.close).toHaveBeenCalled();
    await expect(holder.get()).resolves.toBe(b2);
  });

  it('pornirea care pica nu ramane in memorie (urmatoarea cerere reincearca)', async () => {
    const b = { connected: true, close: jest.fn() } as Any;
    const launch = jest.fn().mockRejectedValueOnce(new Error('no chrome')).mockResolvedValue(b);
    const holder = new PdfBrowserHolder(launch);
    await expect(holder.get()).rejects.toThrow('no chrome');
    await expect(holder.get()).resolves.toBe(b);
  });
});

describe('documentRenderFailed', () => {
  it('503 cu codul DOCUMENT_RENDER_FAILED; recunoscut de isDocumentRenderFailed', () => {
    const e = documentRenderFailed();
    expect(e).toBeInstanceOf(ServiceUnavailableException);
    expect(e.getStatus()).toBe(503);
    expect(e.getResponse()).toMatchObject({ code: 'DOCUMENT_RENDER_FAILED' });
    expect(isDocumentRenderFailed(e)).toBe(true);
    expect(isDocumentRenderFailed(new ServiceUnavailableException({ code: 'BILLING_NOT_READY' }))).toBe(false);
    expect(isDocumentRenderFailed(new Error('x'))).toBe(false);
  });
});
