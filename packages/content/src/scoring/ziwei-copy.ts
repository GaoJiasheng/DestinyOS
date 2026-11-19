import data from './ziwei-copy.json' with { type: 'json' };
import type { CompiledScoringCopy } from './types';
// content:validate checks this generated file against ziwei/scoring.yaml, so the literal union types hold.
export const ziweiScoringCopy = data as CompiledScoringCopy;
