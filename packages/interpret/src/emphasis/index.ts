// Browser-safe entry (`@tianji/interpret/emphasis`): types and renderers only, no evaluator or knowledge base.
export type {
  Emphasis,
  EmphasisBasis,
  EmphasisDimension,
  EmphasisLevel,
  EmphasisSupport,
} from './types';
export {
  renderEmphasisBasis,
  emphasisLevelLabel,
  emphasisDimLabel,
  emphasisDimSentence,
  emphasisOverview,
  emphasisTitle,
  emphasisFootnotes,
} from './render';
