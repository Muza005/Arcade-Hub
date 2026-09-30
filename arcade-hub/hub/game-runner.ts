// Запуск игры: ленивая загрузка по манифесту, цикл, ввод, пауза, конец матча, итоги и уборка.
// Хаб знает об игре только манифест и контракт GameModule.
import { InputHub, type InputSource } from '../engine/input';
import { FixedLoop } from '../engine/loop';
import { createInputRecorder, type ActionEvent, type InputEvent } from '../engine/replay';
import type {
  GameContext,
  GameManifest,
  GameModule,
  GamePlayer,
  MatchResult,
  MatchResults,
  MatchSettings,
} from '../shared/game-manifest';
import type { AimLayout, GamePayload, MainButtonState } from '../shared/protocol';
import { ASPECT_RANGE, DEFAULT_ASPECT } from '../shared/config';

export interface LaunchOptions {
  players: readonly GamePlayer[];
  /** Источники ввода: клавиатура, телефоны. id источника = id игрока. */
  sources: readonly InputSource[];
  fx: GameContext['fx'];
  seed: number;
  mode?: string;
  settings?: MatchSettings;
  /** Соотношение сторон мира; без него — по размеру mount. */
  aspect?: number;
}

export interface Match {
  /** Результаты, когда игра сообщит о конце. */
  readonly result: Promise<MatchResult>;
  /** Id игроков матча. */
  readonly players: readonly string[];
  readonly paused: boolean;
  /** Соотношение сторон мира матча — для записи. */
  readonly aspect: number;
  /** Записанный поток ввода (для записи матча). */
  readonly inputs: readonly InputEvent[];
  /** Записанные особые действия. */
  readonly actions: readonly ActionEvent[];
  pause(): void;
  resume(): void;
  /** «Завершить матч»: к итогам, счёт сохраняется. */
  finish(): void;
  mainButton(playerId: string): MainButtonState | undefined;
  /** Раскладка «прицел» игрока, если игра её заказала. */
  aim(playerId: string): AimLayout | undefined;
  /** Особое действие с телефона: уйдёт в игру в начале следующего шага. */
  action(playerId: string, payload: GamePayload): void;
  status(): string | undefined;
  /** Ник или цвет игрока поменялся посреди матча. */
  updatePlayer(player: GamePlayer): void;
  /** Повтор конца матча (после конца, до dispose). Без повтора у игры — сразу. */
  replay(): Promise<void>;
  results(): MatchResults | undefined;
  /** Выгрузить игру: после итогов или при выходе. */
  dispose(): void;
}

/** Загружает игру и запускает матч. Ошибка загрузки или init — исключение. */
export async function runGame(manifest: GameManifest, mount: HTMLElement, options: LaunchOptions): Promise<Match> {
  const game: GameModule = await manifest.load();
  const measured = mount.clientHeight > 0 ? mount.clientWidth / mount.clientHeight : DEFAULT_ASPECT;
  const aspect = Math.min(ASPECT_RANGE.max, Math.max(ASPECT_RANGE.min, options.aspect ?? measured));
  const input = new InputHub();
  for (const source of options.sources) input.add(source);
  // Игра видит тот же округлённый ввод, что пишется в запись, — повтор совпадёт один в один.
  const recorder = createInputRecorder(
    options.players.filter((p) => p.kind !== 'bot').map((p) => p.id),
    (id) => input.read(id),
  );

  // Особые действия ждут начала шага: так они попадают в тот же тик и при повторе.
  const humanIds = options.players.filter((p) => p.kind !== 'bot').map((p) => p.id);
  const pending: Array<{ playerId: string; payload: GamePayload }> = [];
  const actions: ActionEvent[] = [];

  let resolve!: (result: MatchResult) => void;
  const result = new Promise<MatchResult>((r) => (resolve = r));
  let paused = false;
  let over = false;
  let disposed = false;

  const loop = new FixedLoop({
    update: (dtS, tick) => {
      recorder.setTick(tick);
      for (const { playerId, payload } of pending.splice(0)) {
        const i = humanIds.indexOf(playerId);
        if (i === -1) continue;
        actions.push([tick, i, payload]);
        game.action?.(playerId, payload);
      }
      game.update(dtS, tick);
    },
    render: (alpha) => game.render(alpha),
  });

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
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
      seed: options.seed,
      input: { read: (id) => recorder.read(id) },
      mount,
      aspect,
      fx: options.fx,
      end: (matchResult) => {
        if (over) return;
        over = true;
        loop.stop();
        // Ввод больше не нужен; сцена остаётся для повтора в итогах.
        queueMicrotask(() => {
          input.dispose();
          resolve(matchResult);
        });
      },
    });
  } catch (err) {
    dispose();
    throw err;
  }

  loop.start();

  return {
    result,
    players: options.players.map((p) => p.id),
    inputs: recorder.events,
    actions,
    get paused() {
      return paused;
    },
    aspect,
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
    aim: (playerId) => (over ? undefined : game.aim?.(playerId)),
    action: (playerId, payload) => {
      if (!over && !paused && game.action) pending.push({ playerId, payload });
    },
    status: () => (over ? undefined : game.status?.()),
    updatePlayer: (player) => {
      if (!disposed) game.updatePlayer?.(player);
    },
    replay: () => (disposed || !game.replay ? Promise.resolve() : game.replay()),
    results: () => (disposed ? undefined : game.results?.()),
    dispose,
  };
}
