// Запуск игры: ленивая загрузка по манифесту, цикл, ввод, пауза, конец матча и уборка.
// Хаб знает об игре только манифест и контракт GameModule.
import { InputHub, type InputSource } from '../engine/input';
import { FixedLoop } from '../engine/loop';
import { randomSeed } from '../engine/rng';
import type {
  GameContext,
  GameManifest,
  GamePlayer,
  GameModule,
  MatchResult,
  MatchSettings,
} from '../shared/game-manifest';
import type { MainButtonState } from '../shared/protocol';

export interface LaunchOptions {
  players: readonly GamePlayer[];
  /** Источники ввода: клавиатура, телефоны. id источника = id игрока. */
  sources: readonly InputSource[];
  fx: GameContext['fx'];
  mode?: string;
  settings?: MatchSettings;
}

export interface Match {
  /** Результаты, когда игра сообщит о конце. */
  readonly result: Promise<MatchResult>;
  /** Id игроков матча. */
  readonly players: readonly string[];
  readonly paused: boolean;
  pause(): void;
  resume(): void;
  /** «Завершить матч»: к итогам, счёт сохраняется. */
  finish(): void;
  mainButton(playerId: string): MainButtonState | undefined;
  status(): string | undefined;
}

/** Загружает игру и запускает матч. Ошибка загрузки или init — исключение. */
export async function runGame(manifest: GameManifest, mount: HTMLElement, options: LaunchOptions): Promise<Match> {
  const game: GameModule = await manifest.load();
  const input = new InputHub();
  for (const source of options.sources) input.add(source);

  let resolve!: (result: MatchResult) => void;
  const result = new Promise<MatchResult>((r) => (resolve = r));
  let paused = false;
  let over = false;

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
      fx: options.fx,
      end: (matchResult) => {
        if (over) return;
        over = true;
        loop.stop();
        // Уборка — после текущего кадра, чтобы игра не разбиралась посреди своего update.
        queueMicrotask(() => {
          cleanup();
          resolve(matchResult);
        });
      },
    });
  } catch (err) {
    cleanup();
    throw err;
  }

  loop.start();

  return {
    result,
    players: options.players.map((p) => p.id),
    get paused() {
      return paused;
    },
    pause() {
      if (paused || over) return;
      paused = true;
      game.pause();
    },
    resume() {
      if (!paused || over) return;
      paused = false;
      game.resume();
    },
    finish() {
      if (!over) game.finish();
    },
    mainButton: (playerId) => (over ? undefined : game.mainButton?.(playerId)),
    status: () => (over ? undefined : game.status?.()),
  };
}
