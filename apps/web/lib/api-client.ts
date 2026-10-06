import { createApiClient } from '@tianji/api-client';

/** Same-origin Web transport; Auth.js cookies remain managed by the browser. */
export const apiClient = createApiClient();
