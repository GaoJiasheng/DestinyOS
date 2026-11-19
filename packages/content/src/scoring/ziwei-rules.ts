import data from './ziwei-rules.json' with { type: 'json' };
import type { CompiledScoringRules } from './types';
// content:validate checks this generated file against ziwei/scoring.yaml, so the literal union types hold.
export const ziweiScoringRules = data as CompiledScoringRules;
