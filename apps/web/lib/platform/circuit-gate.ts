import { createTranslator } from 'next-intl';
import zh from '../../messages/zh.json';
import tw from '../../messages/zh-TW.json';
import en from '../../messages/en.json';
export interface CircuitStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}
/** Persisted manual mode overrides automatic state; no in-process cache can hide a new trip. */
export async function circuitOpen(store: CircuitStore): Promise<boolean> {
  const mode = await store.get('circuit:mode');
  if (mode === 'open') return true;
  if (mode === 'closed') return false;
  return (await store.get('circuit')) === 'open';
}
/** Only essential admin/auth/cron and signed payment callbacks bypass the cost gate. */
// DESIGN-GAP: Keep admin recovery, auth, health, Cron and RevenueCat callbacks reachable; all public actions and renderers receive 503 before Next.js dispatch.
export function circuitBypass(path: string): boolean {
  return (
    /^\/admin(?:\/|$)/.test(path) ||
    /^\/(?:zh|zh-TW|en)\/auth(?:\/|$)/.test(path) ||
    /^\/api\/auth(?:\/|$)/.test(path) ||
    /^\/api\/v1\/(?:health\/?|cron\/(?:daily-maintenance|cost-circuit)\/?|mobile\/webhooks\/revenuecat\/?)$/.test(
      path,
    )
  );
}
/** A static, script-free response translated with next-intl; served before OpenNext dispatch. */
export function maintenanceResponse(request: Request): Response {
  const url = new URL(request.url);
  const segment = url.pathname.split('/')[1];
  const preference = request.headers.get('accept-language') ?? '';
  const locale =
    segment === 'en' || segment === 'zh' || segment === 'zh-TW'
      ? segment
      : /zh-(?:TW|HK|Hant)/i.test(preference)
        ? 'zh-TW'
        : /^en/i.test(preference)
          ? 'en'
          : 'zh';
  const catalog = locale === 'en' ? en : locale === 'zh-TW' ? tw : zh;
  const t = createTranslator({
    locale,
    messages: {
      title: catalog['site.maintenance.title'],
      description: catalog['site.maintenance.description'],
    },
  });
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
    );
  return new Response(
    `<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(t('title'))}</title><style>body{background:#0b1022;color:#fff;font:18px system-ui;max-width:40rem;margin:20vh auto;padding:2rem}h1{font-size:2rem}</style><main><h1>${escape(t('title'))}</h1><p>${escape(t('description'))}</p></main></html>`,
    {
      status: 503,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': '3600',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}
