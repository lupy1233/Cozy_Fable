import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Audit } from '../audit/audit.decorator';
import {
  ConfirmInspirationImageDto,
  CreateInspirationPhotoDto,
  ListInspirationQueryDto,
  PresignInspirationImageDto,
  UpdateInspirationPhotoDto,
} from './dto/inspiration.dto';
import { InspirationService } from './inspiration.service';

// Galeria publica: oricine (inclusiv anonim) vede pozele publicate.
@Controller('inspiration')
@UseGuards(OptionalJwtAuthGuard)
export class InspirationController {
  constructor(private readonly inspiration: InspirationService) {}

  @Public()
  @Get()
  list(@Query() query: ListInspirationQueryDto) {
    return this.inspiration.listPublic(query);
  }
}

// Administrarea galeriei: doar ADMIN; scrierile sunt auditate.
@Controller('admin/inspiration')
@Roles(UserRole.ADMIN)
export class InspirationAdminController {
  constructor(private readonly inspiration: InspirationService) {}

  @Get()
  list() {
    return this.inspiration.listAdmin();
  }

  @Audit('INSPIRATION_PHOTO_CREATED', 'inspiration_photo')
  @Post()
  create(@Body() dto: CreateInspirationPhotoDto) {
    return this.inspiration.create(dto);
  }

  @Audit('INSPIRATION_PHOTO_UPDATED', 'inspiration_photo')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInspirationPhotoDto) {
    return this.inspiration.update(id, dto);
  }

  @Audit('INSPIRATION_PHOTO_DELETED', 'inspiration_photo')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inspiration.remove(id);
  }

  @Post(':id/image/presign')
  presignImage(@Param('id') id: string, @Body() dto: PresignInspirationImageDto) {
    return this.inspiration.presignImage(id, dto);
  }

  @Audit('INSPIRATION_PHOTO_IMAGE_SET', 'inspiration_photo')
  @Post(':id/image/confirm')
  confirmImage(@Param('id') id: string, @Body() dto: ConfirmInspirationImageDto) {
    return this.inspiration.confirmImage(id, dto.attachmentId);
  }
}
