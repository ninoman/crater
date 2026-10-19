import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'spikes', 'scripts', 'tests/fixtures'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.serviceworker, chrome: 'readonly' },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Feature code goes through our own wrappers in src/ui, never Radix directly.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@radix-ui/*'], message: 'Import the wrapper from src/ui instead.' },
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
