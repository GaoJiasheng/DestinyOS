import learning from './learn-paths-generated.json';
const learn = new Set<string>(learning);
const landing =
  /^\/(?:zh|en|zh-TW)(?:\/(?:bazi|ziwei|iching|qimen|tarot|astrology|vedic|numerology|synastry|today|about|faq|privacy|terms|disclaimer|contact|credits))?$/;
/** Match build-owned public shells; unknown learning paths and private inputs stay dynamic. */
export function isStaticPublicPath(path: string): boolean {
  if (landing.test(path)) return true;
  const match = path.match(/^\/(?:zh|en|zh-TW)(\/learn(?:\/.*)?)$/);
  return !!match && learn.has(match[1]!);
}
