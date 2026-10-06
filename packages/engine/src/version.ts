import enginePackage from '../package.json' with { type: 'json' };
// DESIGN-GAP: A metadata-only entry avoids evaluating every system when a client needs the engine version.
export const ENGINE_VERSION = enginePackage.version;
