import { HEXAGRAM_DATA_UPPER } from './hexagram-data-upper';
import { HEXAGRAM_DATA_LOWER } from './hexagram-data-lower';
// Generated King Wen topology; provenance: packages/content/iching/source-audit.json.
export const HEXAGRAM_DATA = [...HEXAGRAM_DATA_UPPER, ...HEXAGRAM_DATA_LOWER] as const;
