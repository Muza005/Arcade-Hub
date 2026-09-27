// Запуск игры: ленивая загрузка по манифесту, цикл, ввод, конец матча и уборка.
// Хаб знает об игре только манифест и контракт GameModule.
import { createKeyboardSource, InputHub, type KeyboardScheme } from '../engine/input';
import { FixedLoop } from '../engine/loop';
import { randomSeed } from '../engine/rng';
import type { GameManifest, GamePlayer, MatchResult, MatchSettings } from '../shared/game-manifest';

export interface LaunchOptions {
  players: readonly GamePlayer[];
  /** Какой раскладкой управляется клавиатурный игрок (по id). */
  keyboard: ReadonlyMap<string, KeyboardScheme>;
  mode?: string;
  settings?: MatchSettings;
}

/** Запускает матч и возвращает результаты, когда игра сообщит о конце. */
export async function runGame(manifest: GameManifest, mount: HTMLElement, options: LaunchOptions): Promise<MatchResult> {
  const game = await manifest.load();
  const input = new InputHub();
  for (const [id, scheme] of options.keyboard) input.add(createKeyboardSource(id, scheme));

  let finish!: (result: MatchResult) => void;
  const finished = new Promise<MatchResult>((resolve) => (finish = resolve));

  const loop = new FixedLoop({
    update: (dtS, tick) => game.update(dtS, tick),
    render: (alpha) => game.render(alpha),
  });

  const cleanup = (): void => {
    loop.stop();
    input.dispose();
    game.dispose();
    mount.replaceChildren();
  };

  try {
    await game.init({
      players: options.players,
      settings: options.settings ?? {},
      mode: options.mode ?? manifest.modes[0]?.id ?? '',
      seed: randomSeed(),
      input: { read: (id) => input.read(id) },
      mount,
      end: (result) => {
        loop.stop();
        // Уборка — после текущего кадра, чтобы игра не разбиралась посреди своего update.
        queueMicrotask(() => {
          cleanup();
          finish(result);
        });
      },
    });
  } catch (err) {
    cleanup();
    throw err;
  }

  loop.start();
  return finished;
}
