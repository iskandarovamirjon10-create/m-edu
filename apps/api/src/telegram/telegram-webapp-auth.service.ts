import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { TokenUser } from '../auth/types';
import { TelegramAttemptLimiter } from './telegram-attempt-limiter.service';

export interface TelegramInitDataUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface ValidatedTelegramWebAppData {
  user: TelegramInitDataUser;
  authDate: number;
  hash: string;
  queryId?: string;
  chatType?: string;
  chatInstance?: string;
}

@Injectable()
export class TelegramWebAppAuthService {
  private readonly logger = new Logger(TelegramWebAppAuthService.name);
  private readonly botToken: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly limiter: TelegramAttemptLimiter,
  ) {
    this.botToken = (this.config.get<string>('TELEGRAM_BOT_TOKEN') || '').trim();
  }

  /**
   * Cryptographically validates Telegram Mini App `initData` string
   * using the standard Telegram Bot API HMAC-SHA-256 algorithm.
   */
  validateInitData(initDataRaw: string): ValidatedTelegramWebAppData {
    if (!initDataRaw || typeof initDataRaw !== 'string') {
      throw new BadRequestException('Missing Telegram initData');
    }

    if (!this.botToken) {
      // In development / test mode with explicit opt-in, permit mock auth
      if (
        process.env.NODE_ENV === 'test' ||
        (process.env.NODE_ENV === 'development' && process.env.ALLOW_MOCK_TELEGRAM_AUTH === 'true')
      ) {
        if (initDataRaw.includes('mock=true')) {
          return {
            user: { id: 99999999, first_name: 'Mock', last_name: 'User', username: 'mockuser' },
            authDate: Math.floor(Date.now() / 1000),
            hash: 'mock-hash-dev',
          };
        }
      }
      throw new UnauthorizedException('Telegram Bot token is not configured on server');
    }

    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) {
      throw new UnauthorizedException('Missing hash in Telegram initData');
    }

    // 1. Remove hash from parameters
    params.delete('hash');

    // 2. Sort remaining keys in alphabetical order
    const sortedEntries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = sortedEntries.map(([k, v]) => `${k}=${v}`).join('\n');

    // 3. Derive secret key: HMAC_SHA256("WebAppData", botToken)
    const secretKey = createHmac('sha256', 'WebAppData').update(this.botToken).digest();

    // 4. Calculate HMAC_SHA256(secretKey, dataCheckString)
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // 5. Constant-time verification
    const receivedHashBuf = Buffer.from(hash, 'hex');
    const calculatedHashBuf = Buffer.from(calculatedHash, 'hex');

    if (
      receivedHashBuf.length !== calculatedHashBuf.length ||
      !timingSafeEqual(receivedHashBuf, calculatedHashBuf)
    ) {
      this.logger.warn('Invalid Telegram WebApp initData signature received');
      throw new UnauthorizedException('Invalid Telegram WebApp signature');
    }

    // 6. Validate auth_date freshness (replay attack prevention: max 10 minutes default)
    const authDateStr = params.get('auth_date');
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);
    const configMaxAge = parseInt(this.config.get<string>('TELEGRAM_AUTH_MAX_AGE_SECONDS') || '', 10);
    const MAX_AGE_SECONDS = Number.isFinite(configMaxAge) && configMaxAge > 0 ? configMaxAge : 600; // 10 minutes default

    if (!authDate || now - authDate > MAX_AGE_SECONDS || authDate > now + 300) {
      this.logger.warn(`Expired or future auth_date in Telegram WebApp: ${authDate}`);
      throw new UnauthorizedException('Telegram WebApp session has expired');
    }

    // 7. Parse user data
    const userJson = params.get('user');
    if (!userJson) {
      throw new BadRequestException('Missing user object in Telegram initData');
    }

    try {
      const user = JSON.parse(userJson) as TelegramInitDataUser;
      return {
        user,
        authDate,
        hash,
        queryId: params.get('query_id') || undefined,
        chatType: params.get('chat_type') || undefined,
        chatInstance: params.get('chat_instance') || undefined,
      };
    } catch {
      throw new BadRequestException('Malformed user JSON in Telegram initData');
    }
  }

  /**
   * Authenticate a Telegram WebApp session into M-EDU.
   * Derives principal from cryptographically verified Telegram user ID.
   */
  async authenticate(
    initDataRaw: string,
    clientMeta?: { userAgent?: string; ipAddress?: string },
  ) {
    const validated = this.validateInitData(initDataRaw);

    // Replay attack prevention via Redis/limiter tryClaimOnce
    const configMaxAge = parseInt(this.config.get<string>('TELEGRAM_AUTH_MAX_AGE_SECONDS') || '', 10);
    const ttlSeconds = Number.isFinite(configMaxAge) && configMaxAge > 0 ? configMaxAge : 600;
    const wonClaim = await this.limiter.tryClaimOnce(`webapp-auth:${validated.hash}`, ttlSeconds);
    if (!wonClaim) {
      this.logger.warn(`Replay attempt blocked for Telegram WebApp session hash: ${validated.hash}`);
      throw new UnauthorizedException('Telegram WebApp session has already been used');
    }

    const tgUserId = String(validated.user.id);

    // Look up active TelegramAccount mapping
    const account = await this.prisma.telegramAccount.findFirst({
      where: {
        telegramUserId: tgUserId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          include: { organization: true },
        },
        parentAccount: {
          include: { organization: true },
        },
      },
    });

    if (!account) {
      return {
        authenticated: false,
        telegramUser: validated.user,
        message: 'Telegram hisobi M-EDU tizimidagi birorta profilga ulanmagan.',
      };
    }

    // If mapped to a staff / student User
    if (account.user) {
      const dbUser = account.user;
      if (!dbUser.isActive) {
        throw new UnauthorizedException('Hisobingiz faol emas. Administratorga murojaat qiling.');
      }

      const tokenUser: TokenUser = {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
        organizationId: dbUser.organizationId,
        organization: dbUser.organization,
      };

      const { accessToken } = await this.authService.issueToken(tokenUser, clientMeta);

      // Update last seen
      await this.prisma.telegramAccount.update({
        where: { id: account.id },
        data: { lastSeenAt: new Date() },
      });

      return {
        authenticated: true,
        accessToken,
        user: tokenUser,
        role: tokenUser.role,
        organization: dbUser.organization,
      };
    }

    // If mapped to a ParentAccount
    if (account.parentAccount) {
      const parent = account.parentAccount;
      const tokenUser: TokenUser = {
        id: parent.id,
        email: parent.email || parent.phone || `parent_${parent.id}@medu.local`,
        firstName: parent.firstName,
        lastName: parent.lastName || '',
        role: 'PARENT',
        organizationId: parent.organizationId,
        organization: parent.organization,
      };

      const { accessToken } = await this.authService.issueToken(tokenUser, clientMeta);

      await this.prisma.telegramAccount.update({
        where: { id: account.id },
        data: { lastSeenAt: new Date() },
      });

      return {
        authenticated: true,
        accessToken,
        user: tokenUser,
        role: 'PARENT',
        organization: parent.organization,
      };
    }

    return {
      authenticated: false,
      telegramUser: validated.user,
      message: 'Ulanish ma\'lumotlari topilmadi.',
    };
  }
}
