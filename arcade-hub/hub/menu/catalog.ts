// Порядок карточек и бейджи (ARCADE_HUB_SPEC §6). Чистые функции — без DOM.
import type { GameManifest } from '../../shared/game-manifest';

export type Badge =
  | { kind: 'needPhone' }
  | { kind: 'daily' }
  | { kind: 'needMore'; n: number }
  | { kind: 'max'; n: number }
  | { kind: 'new' };

/** Последние запущенные, затем новые (ни разу не запускались), затем остальные по алфавиту. */
export function orderGames(
  games: readonly GameManifest[],
  history: readonly string[],
  title: (g: GameManifest) => string,
): GameManifest[] {
  const available = games.filter((g) => g.status === 'available');
  const launched = history
    .map((id) => available.find((g) => g.id === id))
    .filter((g): g is GameManifest => g !== undefined);
  const rest = available
    .filter((g) => !history.includes(g.id))
    .sort((a, b) => title(a).localeCompare(title(b)));
  return [...launched, ...rest];
}

/**
 * Один бейдж на карточку — первый подходящий по таблице §6.
 * Подсказку о числе игроков показываем, только когда в комнате кто-то есть: пустая комната — не повод.
 */
export function badgeFor(game: GameManifest, people: number, launched: boolean, phonesOk = true): Badge | null {
  // Сервер недоступен (§15): играм без клавиатуры нужен телефон.
  if (!phonesOk && !game.controls.includes('keyboard')) return { kind: 'needPhone' };
  if (game.meta?.().dailyBest) return { kind: 'daily' };
  if (people > 0 && people < game.players.min) return { kind: 'needMore', n: game.players.min - people };
  if (people > game.players.max) return { kind: 'max', n: game.players.max };
  if (!launched) return { kind: 'new' };
  return null;
}

/** «2–4» или «4», если min = max. */
export function range([min, max]: readonly [number, number]): string {
  return min === max ? String(min) : `${min}–${max}`;
}
