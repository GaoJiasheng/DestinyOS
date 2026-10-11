import { createTranslator } from 'next-intl';
import zh from '../../messages/zh.json';
import tw from '../../messages/zh-TW.json';
import en from '../../messages/en.json';
export { circuitOpen, circuitBypass, type CircuitStore } from './circuit-policy';
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
