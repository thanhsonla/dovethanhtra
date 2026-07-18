import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const typeChecked = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: ['**/*.ts', '**/*.tsx'],
}))

export default tseslint.config(
  {
    ignores: [
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      'database/migrations/**/*.cjs',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  eslint.configs.recommended,
  ...typeChecked,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx', 'tests/e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
)
