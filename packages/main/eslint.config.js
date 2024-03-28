import {
  common,
  defineConfig,
  sources,
  tests,
} from '@setup-texlive-action/config/eslint';

export default defineConfig(
  {
    files: ['src/**/*.ts'],
    ignores: ['src/index.ts', 'src/**/*.d.ts'],
    extends: [...common, ...sources],
  },
  {
    files: ['tests/**/*.ts'],
    extends: [...common, ...tests],
  },
);
