import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PresignAttachmentDto } from '../requests/dto/request.dto';

// b5: DTO-ul verifica doar forma; valorile (tip, marime, gol) ajung in UploadsService.presign,
// care raspunde cu FILE_TYPE_NOT_ALLOWED / FILE_TOO_LARGE (vezi uploads.service.spec.ts).
const errorsFor = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(PresignAttachmentDto, body), { whitelist: true, forbidNonWhitelisted: true })
    .map((e) => e.property);

describe('PresignAttachmentDto (b5)', () => {
  it.each([
    { filename: 'note.txt', mimeType: 'text/plain', sizeBytes: 10 },
    { filename: 'poza.heic', mimeType: '', sizeBytes: 10 },
    { filename: 'mare.pdf', mimeType: 'application/pdf', sizeBytes: 30 * 1024 * 1024 },
    { filename: 'gol.pdf', mimeType: 'application/pdf', sizeBytes: 0 },
  ])('lasa valoarea sa ajunga la serviciu: %o', (body) => {
    expect(errorsFor(body)).toEqual([]);
  });

  it('forma gresita ramane VALIDATION_ERROR', () => {
    expect(errorsFor({ filename: '', mimeType: 'application/pdf', sizeBytes: 10 })).toEqual(['filename']);
    expect(errorsFor({ filename: 'a.pdf', mimeType: 42, sizeBytes: 10 })).toEqual(['mimeType']);
    expect(errorsFor({ filename: 'a.pdf', mimeType: 'x'.repeat(101), sizeBytes: 10 })).toEqual(['mimeType']);
    expect(errorsFor({ filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: '10' })).toEqual(['sizeBytes']);
    expect(errorsFor({ filename: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 10, extra: 1 })).toEqual(['extra']);
  });
});
