import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AccessTokenPayload } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Audit } from '../audit/audit.decorator';
import {
  BoardItemDto,
  BoardNameDto,
  ConfirmInspirationImageDto,
  CreateInspirationPhotoDto,
  ListInspirationQueryDto,
  PresignInspirationImageDto,
  UpdateInspirationPhotoDto,
} from './dto/inspiration.dto';
import { InspirationBoardsService } from './boards.service';
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

// Colectiile de salvari ale utilizatorului (item 8) — orice cont autentificat
// (guard-ul global JwtAuthGuard se aplica implicit, fara @Public).
@Controller('inspiration/boards')
export class InspirationBoardsController {
  constructor(private readonly boards: InspirationBoardsService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.boards.list(user.sub);
  }

  // starea "Salvat" a pin-urilor din galerie (toate salvarile utilizatorului)
  @Get('saved')
  saved(@CurrentUser() user: AccessTokenPayload) {
    return this.boards.savedRefs(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.boards.detail(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: BoardNameDto) {
    return this.boards.create(user.sub, dto.name);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: BoardNameDto,
  ) {
    return this.boards.rename(user.sub, id, dto.name);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.boards.remove(user.sub, id);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: BoardItemDto,
  ) {
    return this.boards.addItem(user.sub, id, dto.photoId);
  }

  @Delete(':id/items/:photoId')
  removeItem(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.boards.removeItem(user.sub, id, photoId);
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
