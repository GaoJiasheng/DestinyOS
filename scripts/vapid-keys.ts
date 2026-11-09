/**
 * Print a fresh VAPID (P-256) key pair for web push. Nothing is written to disk.
 * Usage: pnpm exec tsx scripts/vapid-keys.ts
 * Public key  -> NEXT_PUBLIC_VAPID_PUBLIC_KEY (build-time public variable)
 * Private key -> wrangler secret put VAPID_PRIVATE_KEY (never commit it)
 */
import { generateRawKeyPair } from '../apps/web/lib/web-push';

const pair = await generateRawKeyPair();
process.stdout.write(
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${pair.publicKey}\nVAPID_PRIVATE_KEY=${pair.privateKey}\n`,
);
