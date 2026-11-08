/**
 * Minimal local declaration for `cookie-parser` (no @types package is
 * installed, and enabling `noImplicitAny` surfaced TS7016 for it).
 *
 * Only the surface the API uses is declared: `app.use(cookieParser())` with an
 * optional secret and the standard cookie-parser options object. The runtime
 * signature is documented at https://github.com/expressjs/cookie-parser.
 */
declare module 'cookie-parser' {
  import type { RequestHandler } from 'express';

  interface CookieParseOptions {
    decode?: (val: string) => string;
  }

  function cookieParser(
    secret?: string | string[],
    options?: CookieParseOptions,
  ): RequestHandler;

  export = cookieParser;
}
