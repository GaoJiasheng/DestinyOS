import { find } from 'geo-tz';
/** Query the original geo-tz all-history boundary dataset on Node. */
export async function nodeTimezone(lat: number, lng: number): Promise<string[]> {
  return find(lat, lng);
}
