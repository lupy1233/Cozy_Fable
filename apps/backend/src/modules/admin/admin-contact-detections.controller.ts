import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminContactDetectionsService } from './admin-contact-detections.service';
import { AdminContactDetectionsQueryDto } from './dto/admin-contact-detections.dto';

// E-admin-platform-45: date de contact detectate in texte libere. Doar GET (fara scrieri,
// deci fara @Audit); fragmentele sunt partial ascunse, fara valori brute.
@Controller('admin/contact-detections')
@Roles(UserRole.ADMIN)
export class AdminContactDetectionsController {
  constructor(private readonly detections: AdminContactDetectionsService) {}

  @Get()
  list(@Query() query: AdminContactDetectionsQueryDto) {
    return this.detections.list(query);
  }
}
