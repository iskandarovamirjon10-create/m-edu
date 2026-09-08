/**
 * OAuthRedirectException — a controlled "please send the browser here"
 * signal from the OAuth guard to the global exception filter.
 *
 * The Google guard must NOT write the response itself: responding inside a
 * guard and then returning through the Nest pipeline causes a second write
 * (uncaught ERR_HTTP_HEADERS_SENT or a mutated status code in logs). Instead
 * the guard throws this exception and the GlobalExceptionFilter turns it
 * into a single, clean 302 redirect — one write path, correct logging, no
 * secrets, no stack traces, no opaque 500s.
 */
export class OAuthRedirectException extends Error {
  constructor(
    public readonly url: string,
    public readonly statusCode: number = 302,
  ) {
    super(`OAuth redirect: ${statusCode} ${url}`);
    this.name = 'OAuthRedirectException';
  }
}
