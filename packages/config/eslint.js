import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.open-next/**',
      '**/.wrangler/**',
      '**/dist/**',
      '**/.turbo/**',
      'apps/mobile/.expo/**',
      'apps/mobile/ios/**',
      'apps/mobile/android/**',
      'docs/**',
      '.codex-runs/**',
      'test-results/**',
      'playwright-report/**',
      '**/next-env.d.ts',
      'apps/web/public/workers/**',
    ],
  },
  {
    files: ['apps/web/lib/**/*.{ts,tsx}', 'packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='console']",
          message: 'Use the redacting logger; console can leak sensitive data.',
        },
      ],
    },
  },
  { files: ['apps/web/lib/platform/logger.ts'], rules: { 'no-restricted-syntax': 'off' } },
  js.configs.recommended,
  {
    files: ['apps/mobile/**/*.cjs'],
    languageOptions: {
      globals: { require: 'readonly', module: 'readonly', __dirname: 'readonly' },
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }],
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-nocheck': true }],
    },
  },
  // DESIGN-GAP: Metro/Jest load their configuration through CommonJS; permit require only in these config files.
  { files: ['apps/mobile/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
);

// DESIGN-GAP: This single console sink serializes already-redacted Workers telemetry.
