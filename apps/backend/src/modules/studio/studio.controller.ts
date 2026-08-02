import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { AccessTokenPayload } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SaveStudioDraftDto } from './dto/studio.dto';
import { StudioService } from './studio.service';

// Drafturile Studio 3D ale contului — orice utilizator autentificat
// (guard-ul global JwtAuthGuard se aplica implicit, fara @Public).
@Controller('studio/drafts')
export class StudioController {
  constructor(private readonly studio: StudioService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.studio.list(user.sub);
  }

  @Get(':id')
  detail(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.studio.detail(user.sub, id);
  }

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: SaveStudioDraftDto) {
    return this.studio.create(user.sub, dto.name, dto.data);
  }

  @Put(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: SaveStudioDraftDto,
  ) {
    return this.studio.update(user.sub, id, dto.name, dto.data);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.studio.remove(user.sub, id);
  }
}
