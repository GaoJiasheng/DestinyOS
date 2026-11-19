/** Server-side switch for the Zi Wei chart emphasis pilot (headline.emphasis on new natal reports).
 * Off unless FEATURE_EMPHASIS is exactly "true"; it stays off in production until the external
 * reviewer signs off the rule table. Mobile API paths never read it. */
export function emphasisEnabled(): boolean {
  return process.env.FEATURE_EMPHASIS === 'true';
}
