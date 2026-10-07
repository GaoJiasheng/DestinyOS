// DESIGN-GAP: Hermes lacks Intl.PluralRules on the tested iOS runtime; install a
// locale-scoped MIT polyfill before either ICU translator initializes.
import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/zh.js';
