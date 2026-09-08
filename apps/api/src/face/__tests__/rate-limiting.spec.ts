import { describe, expect, it } from 'vitest';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AppModule } from '../../app.module';
import { FaceController } from '../face.controller';
import { SubmitAttemptDto } from '../dto/recognition.dto';

/**
 * Nest Throttler metadata key.
 *
 * This is intentionally kept local to the regression test because the
 * controller decorators expose the resolved metadata under this key.
 */
const LIMIT_META = 'THROTTLER:LIMITdefault';

/**
 * Reads an APP_GUARD provider from the AppModule metadata.
 *
 * The application currently registers global guards through APP_GUARD.
 * This helper keeps the assertion readable and avoids repeating the
 * metadata traversal.
 */
function getAppGuardProvider() {
  const providers =
    Reflect.getMetadata('providers', AppModule) ?? [];

  return providers.find(
    (provider: any) =>
      provider &&
      provider.provide === APP_GUARD,
  );
}

/**
 * Creates a valid-looking JPEG payload without allocating megabytes.
 *
 * The DTO is responsible for validating the transport representation;
 * this test intentionally verifies a realistic base64 JPEG byte sequence.
 */
function makeJpegBase64() {
  return Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
  ]).toString('base64');
}

/* -------------------------------------------------------------------------- */
/* Global throttler configuration                                              */
/* -------------------------------------------------------------------------- */

describe(
  'Rate limiting setup',
  () => {
    it(
      'registers ThrottlerGuard as the global APP_GUARD',
      async () => {
        const moduleRef =
          await Test.createTestingModule({
            imports: [AppModule],
          }).compile();

        try {
          const appGuard =
            getAppGuardProvider();

          expect(appGuard).toBeDefined();
          expect(appGuard.useClass).toBe(
            ThrottlerGuard,
          );
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'does not silently omit the global guard',
      async () => {
        const moduleRef =
          await Test.createTestingModule({
            imports: [AppModule],
          }).compile();

        try {
          const appGuard =
            getAppGuardProvider();

          expect(appGuard).toBeDefined();
          expect(
            appGuard?.provide,
          ).toBe(APP_GUARD);
        } finally {
          await moduleRef.close();
        }
      },
    );

    it(
      'sets the FaceController default limit to 30 requests/minute',
      () => {
        const limit =
          Reflect.getMetadata(
            LIMIT_META,
            FaceController,
          );

        expect(limit).toBe(30);
      },
    );

    it(
      'limits expensive capture endpoint to 10 requests/minute',
      () => {
        const limit =
          Reflect.getMetadata(
            LIMIT_META,
            FaceController.prototype
              .processCapture,
          );

        expect(limit).toBe(10);
      },
    );

    it(
      'limits expensive recognition-attempt endpoint to 10 requests/minute',
      () => {
        const limit =
          Reflect.getMetadata(
            LIMIT_META,
            FaceController.prototype
              .submitAttempt,
          );

        expect(limit).toBe(10);
      },
    );

    it(
      'keeps login endpoint at 10 requests/minute',
      async () => {
        const {
          AuthController,
        } = await import(
          '../../auth/auth.controller'
        );

        const limit =
          Reflect.getMetadata(
            LIMIT_META,
            AuthController.prototype.login,
          );

        expect(limit).toBe(10);
      },
    );
  },
);

/* -------------------------------------------------------------------------- */
/* SubmitAttemptDto                                                            */
/* -------------------------------------------------------------------------- */

describe(
  'SubmitAttemptDto image payload validation',
  () => {
    it(
      'accepts a valid JPEG base64 payload',
      async () => {
        const dto =
          plainToInstance(
            SubmitAttemptDto,
            {
              imageBase64:
                makeJpegBase64(),
            },
          );

        const errors =
          await validate(dto);

        expect(errors).toEqual([]);
      },
    );

    it(
      'accepts base64 containing standard padding',
      async () => {
        const payload =
          Buffer.from(
            'recognition-image',
          ).toString('base64');

        const dto =
          plainToInstance(
            SubmitAttemptDto,
            {
              imageBase64: payload,
            },
          );

        const errors =
          await validate(dto);

        expect(
          errors.some(
            (error) =>
              error.property ===
              'imageBase64',
          ),
        ).toBe(false);
      },
    );

    it(
      'rejects non-base64 input',
      async () => {
        const dto =
          plainToInstance(
            SubmitAttemptDto,
            {
              imageBase64:
                'not base64 !!!',
            },
          );

        const errors =
          await validate(dto);

        expect(errors.length).toBeGreaterThan(
          0,
        );

        expect(
          errors.some(
            (error) =>
              error.property ===
              'imageBase64',
          ),
        ).toBe(true);
      },
    );

    it(
      'rejects an empty image payload',
      async () => {
        const dto =
          plainToInstance(
            SubmitAttemptDto,
            {
              imageBase64: '',
            },
          );

        const errors =
          await validate(dto);

        expect(errors.length).toBeGreaterThan(
          0,
        );

        expect(
          errors.some(
            (error) =>
              error.property ===
              'imageBase64',
          ),
        ).toBe(true);
      },
    );

    it(
      'rejects a missing image payload',
      async () => {
        const dto =
          plainToInstance(
            SubmitAttemptDto,
            {},
          );

        const errors =
          await validate(dto);

        expect(errors.length).toBeGreaterThan(
          0,
        );

        expect(
          errors.some(
            (error) =>
              error.property ===
              'imageBase64',
          ),
        ).toBe(true);
      },
    );

    it(
      'rejects an oversized image payload',
      async () => {
        /*
         * A payload exceeding MAX_BASE64_LENGTH should be rejected.
         * We use a payload that is just over the limit to avoid
         * triggering regex stack overflow in the validator.
         */
        const oversized =
          'A'.repeat(12 * 1024 * 1024 + 10);

        const dto =
          plainToInstance(
            SubmitAttemptDto,
            {
              imageBase64: oversized,
            },
          );

        const errors =
          await validate(dto);

        expect(
          errors.some(
            (error) =>
              error.property ===
              'imageBase64',
          ),
        ).toBe(true);
      },
    );

    it(
      'rejects whitespace-only payloads',
      async () => {
        const dto =
          plainToInstance(
            SubmitAttemptDto,
            {
              imageBase64: '   ',
            },
          );

        const errors =
          await validate(dto);

        expect(errors.length).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      'rejects clearly malformed base64 characters',
      async () => {
        const dto =
          plainToInstance(
            SubmitAttemptDto,
            {
              imageBase64:
                '@@@###$$$%%%^^^',
            },
          );

        const errors =
          await validate(dto);

        expect(
          errors.some(
            (error) =>
              error.property ===
              'imageBase64',
          ),
        ).toBe(true);
      },
    );
  },
);