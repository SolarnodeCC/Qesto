// Flat ESLint config (ESLint 10).
//
// Scope note: `tsc --noEmit` already owns type correctness and the ratchet
// scripts in ops/ci/quality-gates.sh own architecture rules (raw env.AI.run,
// inline DB.prepare, `any`, …). ESLint's job here is the third category
// neither of those catches: unsound *runtime* patterns — above all the React
// hook rules, which are what protect the WebSocket state in src/hooks.
//
// Added RT-2026-09. Before that the repo had no linter at all, and the lint
// block in quality-gates.sh was dead twice over: guarded on an .eslintrc.json
// that never existed, and suffixed `|| true` so it could not fail.

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  {
    // Build output, vendored code, and generated artifacts are not ours to lint.
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'vendor/**',
      'contracts/generated/**',
      'packages/**/dist/**',
      'apps/**/dist/**',
      'tests/artifacts/**',
      '**/*.d.ts',
      // Documentation assets, not shipped app code: the design-system template
      // gallery under knowledge-base/ and the standalone embed/theme snippets
      // in public/ are hand-authored illustrative JS with their own conventions.
      'knowledge-base/**',
      'public/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // `any` has its own dedicated ratchet (scripts/check-no-any.mjs) with a
      // baseline count; duplicating it here would double-report the same debt.
      '@typescript-eslint/no-explicit-any': 'off',

      // Deliberate `_`-prefixed discards are an established convention in this
      // codebase (unused route params, destructured rest-omit).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // React hook correctness — the reason this config earns its place.
  {
    ...reactHooks.configs.flat.recommended,
    files: ['src/**/*.{ts,tsx}'],
  },

  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
)
