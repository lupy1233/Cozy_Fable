import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Query,
  StreamableFile,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ERROR_CODES } from '@marketplace/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AccessTokenPayload } from '../auth/auth.constants';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { BillingReadinessService } from './billing-readiness.service';
import { EInvoiceExportService } from './e-invoice-export.service';
import { SellerDetailsDto } from './dto/seller-details.dto';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

// E-admin-platform-4 — datele fiscale ale platformei (furnizor pe facturi) + starea de
// pregatire a facturarii + registrul lunar pentru contabil (ruta manuala e-Factura).
@Controller('admin/billing')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminBillingController {
  constructor(
    private readonly readiness: BillingReadinessService,
    private readonly exporter: EInvoiceExportService,
  ) {}

  @Get('readiness')
  getReadiness() {
    return this.readiness.getReadinessDto();
  }

  @Get('seller')
  getSeller() {
    return this.readiness.getSellerForAdmin();
  }

  // Auditul pastreaza doar ready/problems (field+reason) — valorile seller_* nu intra in audit.
  @Put('seller')
  @Audit('SELLER_DETAILS_UPDATED', 'system_setting')
  updateSeller(@CurrentUser() user: AccessTokenPayload, @Body() dto: SellerDetailsDto) {
    return this.readiness.updateSeller(dto, user.sub);
  }

  @Get('e-invoice-export')
  async export(@Query('month') month?: string) {
    if (!month || !MONTH.test(month)) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_ERROR, message: 'month must be YYYY-MM' });
    }
    return new StreamableFile(await this.exporter.monthCsv(month), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="facturi-${month}.csv"`,
    });
  }
}
