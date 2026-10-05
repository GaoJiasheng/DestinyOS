import { isLocale } from '@/i18n/routing';
import { renderPublicOg } from '@/lib/public-og';
// DESIGN-GAP: Public OG images use /api/og/public with a trusted page registry; the task does not specify an image endpoint.
/** Public social cards accept only supported locales and registered public paths. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale');
  const path = url.searchParams.get('path') ?? '';
  if (!locale || !isLocale(locale) || path.length > 240) return new Response(null, { status: 404 });
  return (await renderPublicOg(locale, path)) ?? new Response(null, { status: 404 });
}
