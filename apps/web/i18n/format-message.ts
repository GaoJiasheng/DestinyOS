import formatOnly from 'use-intl/format-message/format-only';

// DESIGN-GAP: icu-minify 4.14.9 returns [] instead of '' when a message formats to nothing (e.g. "{text}" with an empty value); use-intl then reports INVALID_MESSAGE and renders the key. next.config.ts aliases the browser and SSR formatter to this wrapper.
const formatMessage: typeof formatOnly = Object.assign(
  (...args: Parameters<typeof formatOnly>) => {
    const result = formatOnly(...args);
    return Array.isArray(result) && result.length === 0 ? '' : result;
  },
  { raw: formatOnly.raw },
);
export default formatMessage;
