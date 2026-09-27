// ESLint: граница платформы и игры (ARCADE_HUB_SPEC §3) и запрет Math.random() (§0 п. 4).
// Запускается в `npm run build`, поэтому нарушение ломает сборку.
import { readdirSync } from 'node:fs';
import js from '@eslint/js';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const PLATFORM_DIRS = ['hub', 'controller', 'server', 'engine', 'shared'];
const NOT_GAME_DIRS = new Set([...PLATFORM_DIRS, 'node_modules', 'dist', 'scripts', 'public']);

/** Игры — все папки в корне, кроме платформы и служебных. Новая игра подхватывается сама. */
export const GAME_DIRS = readdirSync(import.meta.dirname, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !NOT_GAME_DIRS.has(d.name))
  .map((d) => d.name);

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Путь импорта содержит одну из папок целым сегментом: '../hub/x', '../../dots', 'hub/y'. */
const dirSegment = (dirs) => `(^|/)(${dirs.map(escape).join('|')})(/|$)`;

const restrict = (files, dirs, message) =>
  dirs.length === 0
    ? []
    : [
        {
          files,
          rules: {
            'no-restricted-imports': ['error', { patterns: [{ regex: dirSegment(dirs), message }] }],
          },
        },
      ];

export default defineConfig(
  { ignores: ['dist/**', 'dist-server/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,js}'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Случайность — только через engine/rng.ts (сид — randomSeed()).',
        },
      ],
    },
  },
  { files: ['*.config.{js,ts}', 'scripts/**', 'server/**'], languageOptions: { globals: { ...globals.node } } },

  // Игра импортирует только engine/ и shared/: не хаб, не контроллер, не сервер и не другие игры.
  ...GAME_DIRS.flatMap((game) =>
    restrict(
      [`${game}/**/*.ts`],
      ['hub', 'controller', 'server', ...GAME_DIRS.filter((g) => g !== game)],
      'Игра импортирует только engine/ и shared/ (ARCADE_HUB_SPEC §3).',
    ),
  ),
  // Хаб, контроллер и сервер не импортируют код игр: только манифесты через shared/games.ts.
  ...restrict(
    ['hub/**/*.ts', 'controller/**/*.ts', 'server/**/*.ts'],
    GAME_DIRS,
    'Код игр не импортируется платформой — только манифесты через shared/games.ts (ARCADE_HUB_SPEC §3).',
  ),
  // Движок и shared — общие для всех: не зависят от хаба, контроллера, сервера и игр.
  // Исключение — реестр shared/games.ts: он подключает манифесты игр.
  ...restrict(
    ['engine/**/*.ts'],
    ['hub', 'controller', 'server', ...GAME_DIRS],
    'engine/ не зависит от хаба, контроллера, сервера и игр.',
  ),
  ...restrict(
    ['shared/**/*.ts'],
    ['hub', 'controller', 'server'],
    'shared/ не зависит от хаба, контроллера и сервера.',
  ).map((c) => ({ ...c, ignores: ['shared/games.ts'] })),
  ...restrict(
    ['shared/**/*.ts'],
    GAME_DIRS,
    'Игры подключаются только через реестр shared/games.ts.',
  ).map((c) => ({ ...c, ignores: ['shared/games.ts'] })),
);
