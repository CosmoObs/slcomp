export default [
  {
    ignores: ['dist/', 'node_modules/', '*.config.js'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: await import('@typescript-eslint/parser').then(m => m.default),
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': await import('@typescript-eslint/eslint-plugin').then(m => m.default),
      'react-hooks': await import('eslint-plugin-react-hooks').then(m => m.default),
      'react-refresh': await import('eslint-plugin-react-refresh').then(m => m.default),
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];