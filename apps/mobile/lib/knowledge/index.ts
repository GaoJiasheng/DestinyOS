import { getLocalStore } from '../data/store';
import { bundledKnowledge } from './bundled';
import { KnowledgeCache } from './cache';
import { KnowledgeUpdater, createKnowledgeTransport } from './update';
import type { System } from '@tianji/shared';

/** Load offline interpretation content for one system, including shared/common units. */
export async function getOfflineKnowledge(system: System) {
  const store = await getLocalStore();
  const bundle = await new KnowledgeCache(store.database, bundledKnowledge()).load();
  return {
    ...bundle,
    units: bundle.units.filter((unit) => unit.system === system || unit.system === 'common'),
  };
}
/** Create the optional public update client with build-provisioned trust anchors (M09). */
export async function createKnowledgeUpdater(trustedKeys: Readonly<Record<string, Uint8Array>>) {
  const store = await getLocalStore();
  return new KnowledgeUpdater(
    new KnowledgeCache(store.database, bundledKnowledge()),
    createKnowledgeTransport(),
    trustedKeys,
  );
}
