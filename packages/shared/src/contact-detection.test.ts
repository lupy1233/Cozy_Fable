import { describe, expect, it } from 'vitest';
import {
  CONTACT_MASK_TOKEN,
  detectContactInfo,
  isHideable,
  maskContactInfo,
  redactContactExcerpt,
} from './contact-detection';

const kinds = (s: string) => detectContactInfo(s).map((m) => m.kind);

describe('detectContactInfo — must match', () => {
  it.each([
    '0722 123 456',
    '0722123456',
    '0722-123-456',
    '0722.123.456',
    '+40 722 123 456',
    '+40722123456',
    '0040722123456',
    '021 312 34 56',
    '+44 20 7946 0958',
  ])('phone %s', (s) => {
    const m = detectContactInfo(`Sunati la ${s} dupa ora 17`);
    expect(m).toHaveLength(1);
    expect(m[0].kind).toBe('PHONE');
    expect(m[0].text).toBe(s);
  });

  it.each(['ana.popescu@gmail.com', 'ana [at] gmail [dot] com', 'ana arond yahoo.com'])(
    'email %s',
    (s) => {
      const m = detectContactInfo(`Scrieti-mi: ${s}, multumesc`);
      expect(m).toHaveLength(1);
      expect(m[0].kind).toBe('EMAIL');
      expect(m[0].text).toBe(s);
    },
  );

  it.each(['www.mobila-ana.ro', 'https://wa.me/40722123456'])('url %s', (s) => {
    const m = detectContactInfo(`Vezi ${s}.`);
    expect(m).toHaveLength(1);
    expect(m[0].kind).toBe('URL');
    expect(m[0].text).toBe(s);
  });

  it('splits phones glued by a space or preceded by a lone digit', () => {
    expect(detectContactInfo('0722123456 0733111222').map((m) => m.text)).toEqual(['0722123456', '0733111222']);
    expect(detectContactInfo('Piesa 0 0722123456').map((m) => m.text)).toEqual(['0722123456']);
    expect(detectContactInfo('0722 123 456 / 0733 111 222').map((m) => m.text)).toEqual(['0722 123 456', '0733 111 222']);
  });

  it('handle plus messenger mention', () => {
    expect(kinds('insta @ana.design')).toEqual(['MESSENGER', 'HANDLE']);
  });

  it('messenger mention only', () => {
    const m = detectContactInfo('scrie-mi pe WhatsApp');
    expect(m.map((x) => x.kind)).toEqual(['MESSENGER']);
    expect(isHideable(m[0])).toBe(false);
  });
});

describe('detectContactInfo — must not match', () => {
  it.each([
    '240 x 60 cm',
    '240x60x35',
    'L 2,40 m x l 0,60 m',
    '0.72 0.60 0.35 2.40',
    '2400 600 350 mm',
    'buget 15000-20000 lei',
    '01.10.2026-15.10.2026',
    '02.10.2026 - 15.10.2026',
    '03.10.2026-15.10.2026',
    '03.10.2026 15.10.2026',
    'termen 12.03.2026',
    '3f2a1b4c-1234-4567-8901-426614174000',
    'H=2.6m',
    'PAL 18mm',
    'blat 38 mm, 3 sertare de 60',
    '#A0B0C0',
    CONTACT_MASK_TOKEN,
    `Sunati la ${CONTACT_MASK_TOKEN} sau ${CONTACT_MASK_TOKEN}.`,
  ])('%s', (s) => {
    expect(detectContactInfo(s)).toEqual([]);
  });
});

describe('maskContactInfo', () => {
  it('replaces hideable matches and keeps dimensions and mentions', () => {
    const src = 'Sunati-ma la 0722 123 456 sau ana@example.com (WhatsApp). Corp 240 x 60 cm, blat 38 mm.';
    expect(maskContactInfo(src)).toBe(
      `Sunati-ma la ${CONTACT_MASK_TOKEN} sau ${CONTACT_MASK_TOKEN} (WhatsApp). Corp 240 x 60 cm, blat 38 mm.`,
    );
  });

  it('is idempotent', () => {
    const src = 'tel +40722123456, www.mobila-ana.ro, @ana.design, ana [at] gmail [dot] com';
    const once = maskContactInfo(src);
    expect(once).not.toMatch(/0722|mobila-ana|ana\.design|gmail/);
    expect(maskContactInfo(once)).toBe(once);
  });

  it('leaves text without contacts untouched', () => {
    const src = 'Corp 2400 x 600 x 350 mm, livrare 02.10.2026-15.10.2026';
    expect(maskContactInfo(src)).toBe(src);
    expect(maskContactInfo('')).toBe('');
  });
});

describe('redactContactExcerpt', () => {
  it('never contains the full number or email', () => {
    const src = 'Buna ziua, sunati la 0722 123 456 sau scrieti la ana.popescu@gmail.com. Corp 240 x 60 cm.';
    const [first] = detectContactInfo(src);
    const ex = redactContactExcerpt(src, first);
    expect(ex).toContain('07•• ••• •56');
    expect(ex).toContain('a•••@gmail.com');
    expect(ex).not.toContain('0722 123 456');
    expect(ex).not.toContain('ana.popescu@gmail.com');
  });

  it('keeps only the host of a URL and hides handles', () => {
    const src = 'https://wa.me/40722123456 si @ana.design';
    const [first] = detectContactInfo(src);
    const ex = redactContactExcerpt(src, first);
    expect(ex).toBe('wa.me/… si @a•••');
  });

  it('adds ellipses for long context and caps the length', () => {
    const src = `${'x'.repeat(300)} 0722123456 ${'y'.repeat(300)}`;
    const m = detectContactInfo(src)[0];
    const ex = redactContactExcerpt(src, m);
    expect(ex.startsWith('…')).toBe(true);
    expect(ex.endsWith('…')).toBe(true);
    expect(ex.length).toBeLessThanOrEqual(240);
    expect(ex).not.toContain('0722123456');
  });
});

describe('detectContactInfo — performanta', () => {
  // regresie: cuantificatorii nelimitati din EMAIL/BARE_DOMAIN dadeau O(n^2) (~3 s la 20k)
  it('stays linear on long texts without contacts', () => {
    for (const src of ['a'.repeat(20_000), 'a.'.repeat(10_000), `a@${'b.'.repeat(10_000)}`]) {
      const t0 = Date.now();
      maskContactInfo(src);
      expect(Date.now() - t0).toBeLessThan(500);
    }
  });
});
