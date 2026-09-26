// Load .env before anything else so startup validation sees real values.
// Existing process env (docker, orchestrators) always wins — dotenv never
// overrides variables that are already set.
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './filters/http-exception.filter';
import { RequestLoggerMiddleware } from './config/request-logger.middleware';
import { assertValidConfig, configWarnings } from './config/config.validate';
import { createOAuthSessionMiddleware } from './auth/oauth-session';
import {
  TELEGRAM_WEBHOOK_MAX_BODY_BYTES,
  TELEGRAM_WEBHOOK_PATH,
} from './telegram/telegram.constants';

// Maximum accepted JSON body. Face endpoints accept base64 images up to
// 8 MB decoded (~10.7 MB base64) — see face/image.util.ts MAX_IMAGE_BYTES —
// so the parser limit must comfortably exceed that. Everything else (CRM,
// auth, camera config) is far smaller. This is a hard upper bound, not a
// licence to send huge payloads: the DTO/image guards reject oversized
// images with a clear 4xx before any decoding happens.
const BODY_LIMIT = '12mb';

// Module-level logger so process-level error handlers (registered below)
// can report before/outside NestJS bootstrap.
const processLogger = new Logger('Process');

// Unhandled async rejections otherwise kill the process silently in
// production with a default Node abort (exit code 1, no NestJS stack).
process.on('unhandledRejection', (reason) => {
  processLogger.error(
    `Unhandled promise rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
  );
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  processLogger.error(`Uncaught exception: ${error.stack ?? error.message}`);
  process.exit(1);
});

async function bootstrap() {
  const bootstrapLogger = new Logger('Bootstrap');
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Fail fast on invalid/critical configuration (aggregated, never silent).
  assertValidConfig(nodeEnv);
  for (const w of configWarnings(nodeEnv)) {
    bootstrapLogger.warn(`${w.variable}: ${w.message}`);
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(cookieParser());
  // Tight, route-scoped parser for the Telegram webhook.
  //
  // The controller enforces the same cap from `Content-Length`, but a client
  // that omits or lies about that header (e.g. chunked transfer) would
  // otherwise fall through to the 12 MB global limit. body-parser skips any
  // request whose body it has already consumed, so this route gets the strict
  // cap and every other route keeps BODY_LIMIT.
  app.use(
    TELEGRAM_WEBHOOK_PATH,
    express.json({ limit: TELEGRAM_WEBHOOK_MAX_BODY_BYTES }),
  );
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
  // CORS origins — computed before helmet so CSP connectSrc can reference them.
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const corsOriginList = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim())
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:3000', 'http://localhost:5173'];

  // Security headers. Swagger UI is served under /api/docs — allow its
  // inline styles/scripts/eval only for that path so CSP does not break docs.
  // The API itself serves no HTML (SPA is a separate origin/static host), so
  // a strict default-src 'none' style policy is safe; connect-src must allow
  // the SPA origin when CORS_ORIGIN is configured (browser applies CSP on
  // navigation responses; fetch/XHR from the SPA are governed by CORS).
  const cspDirectives: Record<string, string[] | null> = {
    defaultSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
    // Swagger (dev only) needs inline styles/scripts; prod API returns JSON only.
    scriptSrc: process.env.NODE_ENV === 'production' ? ["'none'"] : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    styleSrc: process.env.NODE_ENV === 'production' ? ["'none'"] : ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    connectSrc: ["'self'", ...corsOriginList],
    fontSrc: ["'self'", 'data:'],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
  };
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: cspDirectives as never,
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  // OAuth state session (PostgreSQL-backed, tiny + short-lived) — must be
  // registered BEFORE passport so the Google strategy's state:true can
  // persist/verify its CSRF nonce in req.session.
  app.use(createOAuthSessionMiddleware());
  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Behind a reverse proxy (nginx in the Docker compose / a cloud LB) the
  // socket address is the proxy, so per-IP rate limiting (login, register,
  // bootstrap) would collapse every client into one bucket. TRUST_PROXY sets
  // how many proxy hops Express should trust when resolving req.ip
  // (0 = disabled; 1 = single nginx hop; higher for stacked LBs).
  const trustProxyRaw = process.env.TRUST_PROXY;
  if (trustProxyRaw && trustProxyRaw !== '0' && trustProxyRaw !== 'false') {
    const hops = Number(trustProxyRaw);
    const expressApp = app.getHttpAdapter().getInstance() as express.Express;
    expressApp.set('trust proxy', Number.isFinite(hops) && hops > 0 ? hops : true);
  }

  app.enableCors({
    origin: corsOriginList.length > 0 ? corsOriginList : false,
    credentials: true,
  });

  const requestLogger = new RequestLoggerMiddleware();
  app.use(requestLogger.use.bind(requestLogger));


  app.setGlobalPrefix('api', {
    // RootController owns the literal `/` and `/api` is the namespace for
    // every other route. Keeping RootController at `/` means visiting
    // http://localhost:3001/ shows the API banner instead of a 404.
    exclude: ['RootController'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('M-EDU CRM API')
      .setDescription('Education Center CRM platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port);
  bootstrapLogger.log(`Application is running on: http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    bootstrapLogger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
