import { ConfigService } from '@nestjs/config';
import { MessageCryptoService } from './message-crypto.service';

const KEY_HEX = 'a'.repeat(64);

function make(key?: string): MessageCryptoService {
  const config = { get: jest.fn().mockReturnValue(key) } as unknown as ConfigService;
  return new MessageCryptoService(config);
}

describe('MessageCryptoService (criptare mesaje la stocare, PO r6)', () => {
  it('roundtrip: encrypt → format enc.v1 → decrypt intoarce clarul', () => {
    const svc = make(KEY_HEX);
    const stored = svc.encrypt('Salut, putem discuta oferta?');
    expect(stored).toMatch(/^enc\.v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(svc.decrypt(stored)).toBe('Salut, putem discuta oferta?');
  });

  it('IV aleator: acelasi text → ciphertext diferit', () => {
    const svc = make(KEY_HEX);
    expect(svc.encrypt('acelasi')).not.toBe(svc.encrypt('acelasi'));
  });

  it('dual-read: mesajele istorice in clar trec neatinse', () => {
    const svc = make(KEY_HEX);
    expect(svc.decrypt('mesaj vechi in clar')).toBe('mesaj vechi in clar');
  });

  it('null ramane null (mesaj doar cu atasament)', () => {
    const svc = make(KEY_HEX);
    expect(svc.encrypt(null)).toBeNull();
    expect(svc.decrypt(null)).toBeNull();
  });

  it('fara cheie: stocheaza si citeste in clar (dev)', () => {
    const svc = make(undefined);
    expect(svc.encrypt('in clar')).toBe('in clar');
    expect(svc.decrypt('in clar')).toBe('in clar');
  });

  it('continut criptat corupt → null, fara exceptie', () => {
    const svc = make(KEY_HEX);
    expect(svc.decrypt('enc.v1.abc.defghij')).toBeNull();
  });

  it('cheie gresita → null, fara exceptie', () => {
    const stored = make(KEY_HEX).encrypt('secret');
    const alta = make('b'.repeat(64));
    expect(alta.decrypt(stored)).toBeNull();
  });
});
