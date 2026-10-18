import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { ERROR_CODES } from '@marketplace/shared';
import type { Request, Response } from 'express';
import { clientIpOf } from '../../common/http/client-ip';
import { UserThrottlerGuard } from '../../common/throttler/client-ip-throttler.guard';
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SEC,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TOKEN_TTL_SEC,
  SESSION_HINT_COOKIE,
  type AccessTokenPayload,
} from './auth.constants';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, EmailOnlyDto, ResetPasswordDto } from './dto/password.dto';
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
  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    role: AccessTokenPayload['role'],
  ): void {
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
    // indiciu de UI: headerul de pe server stie rolul de la primul paint (mm_access expira in 15 min,
    // iar mm_refresh are path limitat la /api/v1/auth, deci niciunul nu ajunge la cererile de pagina)
    res.cookie(SESSION_HINT_COOKIE, role, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_TTL_SEC * 1000,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    res.clearCookie(SESSION_HINT_COOKIE, { path: '/' });
  }

  // Rate limit dedicat 5/min (L0-A): register trimite email → anti mail-bombing
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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

  // Raspuns 200 uniform (anti-enumerare), indiferent daca emailul exista / e verificat
  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(200)
  async resendVerification(@Body() dto: EmailOnlyDto) {
    await this.auth.resendVerification(dto.email);
    return { sent: true };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body() dto: EmailOnlyDto) {
    await this.auth.forgotPassword(dto.email);
    return { sent: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { reset: true };
  }

  // JWT (orice rol): schimba parola, revoca celelalte sesiuni si re-emite
  // cookie-urile pentru dispozitivul curent (userul ramane autentificat).
  // E-admin-platform-5: 5/min per user (UserThrottlerGuard ruleaza dupa JwtAuthGuard global);
  // guard-ul global aplica in plus aceeasi limita per IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(UserThrottlerGuard)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.auth.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    this.setAuthCookies(res, accessToken, refreshToken, user.role);
    return { changed: true };
  }

  // Rate limit 5/min per IP client (invarianta 3.13) + blocare per email (E-admin-platform-5)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { user, accessToken, refreshToken } = await this.auth.login(dto, {
        ip: clientIpOf(req),
        userAgent: req.headers['user-agent'] ?? null,
      });
      this.setAuthCookies(res, accessToken, refreshToken, user.role);
      return { user };
    } catch (err) {
      // LOGIN_COOLDOWN: Retry-After ca la throttler (secundele raman si in details)
      const body = err instanceof HttpException ? (err.getResponse() as { code?: string; details?: { retryAfterSec?: number } }) : null;
      if (body?.code === ERROR_CODES.LOGIN_COOLDOWN && body.details?.retryAfterSec) {
        res.setHeader('Retry-After', String(body.details.retryAfterSec));
      }
      throw err;
    }
  }

  // Rate limit dedicat 30/min (L0-A)
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
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
      const { accessToken, refreshToken, role } = await this.auth.refresh(raw);
      this.setAuthCookies(res, accessToken, refreshToken, role);
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

  // SEC2-11: vizitatorul anonim (fara cookie-uri de sesiune / Bearer) primeste 200
  // { user: null }, deci frontendul nu mai declanseaza un /auth/refresh esuat pe fiecare pagina.
  // Cu material de sesiune (access expirat, doar refresh) raspunsul ramane 401 ca FE sa
  // reinnoiasca. OptionalJwtAuthGuard sterge req.user pentru tokenuri invalide/revocate.
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get('me')
  async me(
    @Req() req: Request & { user?: AccessTokenPayload },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.user) return { user: await this.auth.me(req.user.sub) };
    const hasSession = Boolean(
      req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE] || req.headers.authorization,
    );
    if (hasSession) {
      throw new UnauthorizedException({
        code: ERROR_CODES.UNAUTHORIZED,
        message: 'Invalid or expired access token',
      });
    }
    // indiciu ramas fara sesiune (cookie-uri sterse manual) → il stergem, altfel headerul
    // ar porni cu navigatia rolului la fiecare incarcare pana cand useMe se rezolva
    if (req.cookies?.[SESSION_HINT_COOKIE]) res.clearCookie(SESSION_HINT_COOKIE, { path: '/' });
    return { user: null };
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
