import type { ArtSystem } from '@tianji/ui-core/art';
import { SystemArt } from '@/components/art/system-art';

/** Approved engraved bitmap used by system cards and editorial previews. */
export function SystemSymbol({ system }: { system: ArtSystem }) {
  return <SystemArt system={system} />;
}
