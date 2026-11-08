/**
 * M-EDU CORS Origin Validation Utility
 * Supports production allowlists, Telegram WebApp origins, and dynamic local development (localhost, 127.0.0.1, LAN IPs, Tunnels).
 */

export function isAllowedOrigin(origin: string | undefined, configuredList: string[] = []): boolean {
  if (!origin) return true;
  if (configuredList.includes(origin)) return true;

  // Allow the configured Telegram WebApp URL origin if set
  const webAppUrl = process.env.TELEGRAM_WEBAPP_URL;
  if (webAppUrl) {
    try {
      if (new URL(webAppUrl).origin === origin) return true;
    } catch {}
  }

  if (process.env.NODE_ENV !== 'production') {
    // In development mode, allow localhost, 127.0.0.1, and private LAN IP ranges:
    // 192.168.x.x, 10.x.x.x, 172.16-31.x.x on any port
    const isDevLanOrLocal =
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
        origin,
      );
    if (isDevLanOrLocal) return true;

    // Allow development tunneling services (Cloudflare Tunnel, ngrok, localtunnel)
    const isDevTunnel = /^https:\/\/[a-z0-9-]+\.(trycloudflare\.com|loca\.lt|ngrok-free\.app|ngrok\.io)$/i.test(
      origin,
    );
    if (isDevTunnel) return true;
  }

  return false;
}
