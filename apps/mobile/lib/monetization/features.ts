/** Public native build switch; an absent or malformed value disables membership. */
export function membershipEnabled(): boolean {
  return process.env.EXPO_PUBLIC_FEATURE_MEMBERSHIP === 'true';
}
