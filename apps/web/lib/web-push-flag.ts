/** Both server and public build must opt in, matching the membership switch. */
export function webPushEnabled(): boolean {
  return (
    process.env.FEATURE_WEB_PUSH === 'true' && process.env.NEXT_PUBLIC_FEATURE_WEB_PUSH === 'true'
  );
}
/** The settings block also needs the build-time VAPID public key to subscribe with. */
export function webPushAvailable(): boolean {
  return webPushEnabled() && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}
