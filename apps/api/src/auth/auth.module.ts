import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';
import { GoogleAuthGuard } from './google-auth.guard';
import { SyncGateway } from './sync.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { ParentPortalModule } from '../parent-portal/parent-portal.module';
import { ChatModule } from '../chat/chat.module';
import { authTtlSeconds } from './auth.ttl';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ParentPortalModule,
    forwardRef(() => ChatModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret = config.get('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET must be set in environment variables');
        }
        return {
          secret,
          // ONE duration source: authTtlMs() parses JWT_EXPIRES_IN in exactly
          // one place and this converts it to the seconds jsonwebtoken wants.
          // Session expiresAt and the cookie maxAge use the same parse.
          signOptions: { expiresIn: authTtlSeconds() },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, GoogleAuthGuard, SyncGateway],
  // JwtStrategy is exported so WebSocket gateways can reuse the same
  // session/revocation checks as the HTTP guard instead of trusting a
  // signature-only JWT payload.
  exports: [AuthService, JwtModule, JwtStrategy, SyncGateway],
})
export class AuthModule {}
