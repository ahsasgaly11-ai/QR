import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'public/**',
      'scripts/**',
      'patches/**',
      'next-env.d.ts',
      // سكربت تطوير لمعاينة أشكال اليد، لا يدخل في التطبيق
      '_grid.mts',
    ],
  },
];

export default eslintConfig;
