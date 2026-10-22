import { Body, Controller, Get, HttpCode, Post, Put, UseInterceptors } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { Audit } from '../audit/audit.decorator';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AdminSizingService } from './admin-sizing.service';
import { UpdateSizingWeightsDto } from './dto/admin-sizing.dto';

// E-admin-platform-25: punctele optiunilor din chestionar (Admin -> Marime proiect).
// Previzualizarea e read-only (POST doar pentru body); salvarea e auditata.
@Controller('admin/sizing')
@Roles(UserRole.ADMIN)
@UseInterceptors(AuditInterceptor)
export class AdminSizingController {
  constructor(private readonly sizing: AdminSizingService) {}

  @Get('weights')
  weights() {
    return this.sizing.getWeights();
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: UpdateSizingWeightsDto) {
    return this.sizing.preview(dto.changes);
  }

  @Put('weights')
  @Audit('SIZING_WEIGHTS_UPDATED', 'project_sizing_config')
  updateWeights(@Body() dto: UpdateSizingWeightsDto) {
    return this.sizing.updateWeights(dto.changes);
  }
}
