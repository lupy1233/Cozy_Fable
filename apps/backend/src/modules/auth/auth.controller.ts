import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ERROR_CODES } from '@marketplace/shared';
import type { Request, Response } from 'express';
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SEC,
  type AccessTokenPayload,
} from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TwoFactorVerifyDto } from './dto/two-factor.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { TwoFactorService } from './two-factor.service';

@Controller('auth')
export class AuthController {
  private readonly isProd: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
    config: ConfigService,
  ) {
    this.isProd = config.get('NODE_ENV') === 'production';
  }

  // Tokens DOAR in cookies httpOnly (3.5 socket auth cookie-based)
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      maxAge: ACCESS_TOKEN_TTL_SEC * 1000,
      path: '/',
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_TTL_SEC * 1000,
      path: REFRESH_COOKIE_PATH,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.register(dto);
    return { user };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.auth.verifyEmail(dto.token);
    return { verified: true };
  }

  // Rate limit 5/min (invarianta 3.13)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, accessToken, refreshToken } = await this.auth.login(dto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) {
      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: 'Missing refresh token',
      });
    }
    try {
      const { accessToken, refreshToken } = await this.auth.refresh(raw);
      this.setAuthCookies(res, accessToken, refreshToken);
      return { refreshed: true };
    } catch (err) {
      this.clearAuthCookies(res);
      throw err;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    this.clearAuthCookies(res);
    return { loggedOut: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AccessTokenPayload) {
    return { user: await this.auth.me(user.sub) };
  }

  // 2FA — rute implementate, blocate cat timp flagul e off (3.13)
  @Post('2fa/setup')
  async twoFactorSetup(@CurrentUser() user: AccessTokenPayload) {
    return this.twoFactor.setup(user.sub);
  }

  @Post('2fa/verify')
  @HttpCode(200)
  async twoFactorVerify(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: TwoFactorVerifyDto,
  ) {
    await this.twoFactor.verifyAndEnable(user.sub, dto.code);
    return { enabled: true };
  }
}
