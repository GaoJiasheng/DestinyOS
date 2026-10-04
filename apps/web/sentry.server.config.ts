import * as Sentry from '@sentry/nextjs';
import { beforeSend } from './lib/sentry';
import { sanitize } from './lib/privacy';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
  },
  beforeSend,
  beforeBreadcrumb: (breadcrumb) => sanitize(breadcrumb) as typeof breadcrumb,
});
