// Проверка правил ESLint: запрещённый импорт и Math.random() ломают сборку (этап А0, «Готово, когда»).
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });

async function errors(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.ruleId ?? '');
}

describe('граница платформы и игры', () => {
  it.each([
    ['dots/probe.ts', "import '../hub/main';"],
    ['dots/probe.ts', "import '../controller/x';"],
    ['dots/probe.ts', "import '../server/x';"],
    ['dots/probe.ts', "import '../space-war/x';"],
    ['space-war/sub/probe.ts', "export * from '../../dots/x';"],
    ['hub/probe.ts', "import '../dots/x';"],
    ['engine/probe.ts', "import '../hub/x';"],
    ['shared/probe.ts', "import '../dots/x';"],
  ])('%s: %s — ошибка', async (file, code) => {
    expect(await errors(file, code)).toContain('no-restricted-imports');
  });

  it.each([
    ['dots/probe.ts', "import '../engine/loop'; import '../shared/config';"],
    ['hub/probe.ts', "import '../engine/loop'; import '../shared/config';"],
    ['shared/games.ts', "import '../dots/x';"],
  ])('%s: %s — можно', async (file, code) => {
    expect(await errors(file, code)).not.toContain('no-restricted-imports');
  });
});

describe('Math.random()', () => {
  it.each(['dots/probe.ts', 'hub/probe.ts', 'engine/probe.ts'])('%s — ошибка', async (file) => {
    expect(await errors(file, 'export const x = Math.random();')).toContain('no-restricted-properties');
  });
});
