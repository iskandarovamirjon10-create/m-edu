import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { GoogleProfile } from './types';
import { normalizeEmail } from './auth.utils';

/**
 * Google OAuth 2.0 strategy.
 *
 * Security model:
 *  - `state: true` — passport generates a cryptographically random CSRF
 *    state and stores it in `req.session` (express-session, PostgreSQL-
 *    backed — see oauth-session.ts), then validates the state echoed back
 *    on the callback. Callbacks without a matching state fail before any
 *    token exchange. State protection is therefore ENABLED end-to-end.
 *  - The OAuth2 authorization-code exchange with our client secret proves
 *    the token was issued for OUR client (audience). Google's token
 *    endpoint validates code + token signature; the userinfo profile is
 *    fetched over TLS from Google.
 *  - The profile's `sub` (googleSubject) and `email_verified` claims are
 *    asserted in `validate()`; AuthService.googleLogin enforces the
 *    account-linking policy and inactive-account protection.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(configService: ConfigService) {
    const clientId = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL =
      configService.get<string>('GOOGLE_CALLBACK_URL') ||
      'http://localhost:3001/api/auth/google/callback';

    super({
      clientID: clientId || 'PLACEHOLDER_CLIENT_ID',
      clientSecret: clientSecret || 'PLACEHOLDER_CLIENT_SECRET',
      callbackURL,
      scope: ['email', 'profile'],
      passReqToCallback: true,
      // CSRF state: enabled. Passport persists the nonce in req.session
      // (express-session middleware registered in main.ts) and verifies it
      // on the callback. Do NOT disable this.
      state: true,
    });

    if (!clientId || !clientSecret) {
      this.logger.warn(
        'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured — Google OAuth will not work until these are set.',
      );
    }
    if (process.env.NODE_ENV === 'production') {
      try {
        const url = new URL(callbackURL);
        if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
          this.logger.warn(
            `GOOGLE_CALLBACK_URL is not HTTPS (${callbackURL}). Google requires an https redirect URI in production.`,
          );
        }
      } catch {
        this.logger.warn(`GOOGLE_CALLBACK_URL is not a valid URL: ${callbackURL}`);
      }
    }
  }

  async validate(
    _req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: GoogleProfile) => void,
  ) {
    const { id, emails, name, photos } = profile;

    // Claim assertions (defense in depth). `id` is Google's immutable sub.
    if (!id || typeof id !== 'string') {
      return done(new Error('Invalid Google identity: missing subject ID'));
    }
    const email = emails?.[0]?.value;
    if (!email || typeof email !== 'string') {
      return done(new Error('Google account must have an email address'));
    }
    // Only verified Google emails may drive account linking/creation.
    if (emails?.[0]?.verified !== true) {
      return done(new Error('Google email must be verified'));
    }

    done(null, {
      googleSubject: id,
      email: normalizeEmail(email),
      emailVerified: true,
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      avatar: photos?.[0]?.value || null,
      accessToken,
    });
  }
}
