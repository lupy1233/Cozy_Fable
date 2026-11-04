import { IsIn, IsOptional, Matches } from 'class-validator';

// E-admin-platform-4 — ruta manuala e-Factura. Regula UPLOADED/VALIDATED => anafUploadId
// e verificata in PaymentsService.updateEInvoice.
export class UpdateEInvoiceDto {
  @IsIn(['PENDING', 'UPLOADED', 'VALIDATED', 'REJECTED'])
  status: 'PENDING' | 'UPLOADED' | 'VALIDATED' | 'REJECTED';

  @IsOptional()
  @Matches(/^\d{1,20}$/)
  anafUploadId?: string;

  @IsOptional()
  @Matches(/^\d{1,20}$/)
  anafDownloadId?: string;
}
