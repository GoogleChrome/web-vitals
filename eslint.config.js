import {defineConfig} from 'eslint/config';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    ignores: [
      '**/.DS_Store',
      '**/.vscode/',
      '**/node_modules/',
      '**/*.log',
      '**/tsconfig.tsbuildinfo',
      '**/dist/',
    ],
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.mocha,
      },

      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  {
    files: ['**/wdio.conf.js'],
    extends: compat.extends('eslint:recommended'),

    rules: {
      'max-len': 'off',
    },
  },
  {
    files: ['test/e2e/*.js'],
    extends: compat.extends('eslint:recommended'),

    languageOptions: {
      globals: {
        $: false,
        browser: false,
        __toSafeObject: false,
      },
    },

    rules: {
      'comma-dangle': ['error', 'always-multiline'],
      indent: ['error', 2],
      'no-invalid-this': 'off',

      'max-len': [
        2,
        {
          ignorePattern: '^\\s*import|= require\\(|^\\s*it\\(|^\\s*describe\\(',
          ignoreUrls: true,
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    extends: compat.extends('plugin:@typescript-eslint/recommended'),

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: 'module',
    },

    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'comma-dangle': ['error', 'always-multiline'],
      indent: ['error', 2],
      'no-dupe-class-members': 'off',
      'prefer-spread': 'off',
    },
  },
]);
