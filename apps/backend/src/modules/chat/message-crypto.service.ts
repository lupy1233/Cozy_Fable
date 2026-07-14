import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Criptare la stocare pentru corpul mesajelor (PO r6): AES-256-GCM cu cheie de
// server (MESSAGE_ENCRYPTION_KEY, 32 bytes hex). Formatul stocat:
//   enc.v1.<iv base64url>.<ciphertext+tag base64url>
// Dual-read: valorile fara prefix (mesajele istorice sau dev fara cheie) se
// intorc ca atare — nu e nevoie de backfill.
//
// DECIZIE (documentata in docs/16): NU este end-to-end encryption. Cheia sta pe
// server pentru ca (a) regula 4.18 cere ca adminul sa poata citi chatul in
// dispute si (b) conversatiile trebuie sa ramana recuperabile la schimbarea
// device-ului. Criptarea protejeaza continutul mesajelor la accesul direct in
// baza de date (dump/backup furat), in plus fata de TLS pe transport.
const PREFIX = 'enc.v1.';
const IV_BYTES = 12;

@Injectable()
export class MessageCryptoService {
  private readonly logger = new Logger(MessageCryptoService.name);
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const hex = config.get<string>('MESSAGE_ENCRYPTION_KEY');
    this.key = hex ? Buffer.from(hex, 'hex') : null;
    if (!this.key) {
      this.logger.warn(
        'MESSAGE_ENCRYPTION_KEY lipseste — mesajele de chat se stocheaza necriptat (ok in dev)',
      );
    }
  }

  encrypt(plain: string | null): string | null {
    if (plain == null || !this.key) return plain;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const withTag = Buffer.concat([encrypted, cipher.getAuthTag()]);
    return `${PREFIX}${iv.toString('base64url')}.${withTag.toString('base64url')}`;
  }

  decrypt(stored: string | null): string | null {
    if (stored == null || !stored.startsWith(PREFIX)) return stored;
    if (!this.key) {
      // mesaj criptat dar cheia lipseste din env — nu putem afisa continutul
      this.logger.error('mesaj criptat fara MESSAGE_ENCRYPTION_KEY in env');
      return null;
    }
    try {
      const [ivB64, dataB64] = stored.slice(PREFIX.length).split('.');
      const iv = Buffer.from(ivB64, 'base64url');
      const withTag = Buffer.from(dataB64, 'base64url');
      const tag = withTag.subarray(withTag.length - 16);
      const ciphertext = withTag.subarray(0, withTag.length - 16);
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch (e) {
      // continut corupt sau cheie gresita — nu propaga eroarea in tot chatul
      this.logger.error(`decriptare mesaj esuata: ${(e as Error).message}`);
      return null;
    }
  }
}
