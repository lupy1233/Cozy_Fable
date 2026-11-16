import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PresignChatAttachmentDto, SendMessageDto } from './chat.dto';

// g3 (etapa 7): conversatia arata pe ecran aceleasi limite ca serverul — 5.000 de caractere
// (MESSAGE_MAX_LENGTH in chat-panel.tsx), 5 fisiere pe mesaj si tipurile ATTACHMENT_ACCEPT.
// Daca limita de aici se schimba, se schimba si in pagina.

function errorsOf(cls: new () => object, body: Record<string, unknown>): string[] {
  const errors = validateSync(plainToInstance(cls, body), { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property).sort();
}

const uuid = (n: number) => `7d6f5f0e-6a7e-4c1b-9c39-0c2a7f1f2b${String(n).padStart(2, '0')}`;

describe('SendMessageDto — limitele afisate in conversatie (g3)', () => {
  it('5.000 de caractere → valid; 5.001 → refuzat', () => {
    expect(errorsOf(SendMessageDto, { body: 'a'.repeat(5000) })).toEqual([]);
    expect(errorsOf(SendMessageDto, { body: 'a'.repeat(5001) })).toEqual(['body']);
  });

  it('cel mult 5 fisiere pe mesaj', () => {
    expect(errorsOf(SendMessageDto, { attachmentIds: [1, 2, 3, 4, 5].map(uuid) })).toEqual([]);
    expect(errorsOf(SendMessageDto, { attachmentIds: [1, 2, 3, 4, 5, 6].map(uuid) })).toEqual(['attachmentIds']);
  });
});

describe('PresignChatAttachmentDto — tipurile din selectorul de fisiere (g3)', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/zip', 'application/x-zip-compressed'])(
    '%s → acceptat',
    (mimeType) => {
      expect(errorsOf(PresignChatAttachmentDto, { filename: 'f', mimeType, sizeBytes: 10 })).toEqual([]);
    },
  );

  it('tip nepermis → refuzat', () => {
    expect(
      errorsOf(PresignChatAttachmentDto, { filename: 'f.exe', mimeType: 'application/x-msdownload', sizeBytes: 10 }),
    ).toEqual(['mimeType']);
  });
});
