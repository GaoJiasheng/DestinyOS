import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
// DESIGN-GAP: Android Play App Signing SHA-256 certificates are not provided in §12; generate the static association from deployment configuration and fail closed with [] until configured.
const fingerprints = z
  .array(z.string().regex(/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/))
  .parse((process.env.MOBILE_ANDROID_CERT_SHA256 ?? '').split(',').filter(Boolean));
writeFileSync(
  resolve(__dirname, '../public/.well-known/assetlinks.json'),
  JSON.stringify(
    fingerprints.length
      ? [
          {
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
              namespace: 'android_app',
              package_name: 'pub.gavin.tianji',
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [],
    null,
    2,
  ) + '\n',
);
