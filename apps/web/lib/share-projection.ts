// Shared birth-free projection keeps Web and native visibility levels identical.
export * from '@tianji/ui-core/share-projection';
import type { PublicShare } from '@tianji/ui-core/share-projection';
import type { PublicEmphasis } from './emphasis-schema';
/** Web share view: the shared projection plus, at most, the strongest emphasis dimension (band 4–5). */
export type WebPublicShare = PublicShare & { emphasis?: PublicEmphasis };
