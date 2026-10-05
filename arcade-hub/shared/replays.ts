// Записи матчей (§12): сид и поток ввода, последние REPLAYS_KEPT на игру, с версией правил.
// Хранит платформа; воспроизведение, перемотку и метки делает игра.
import type { ActionEvent, InputEvent } from '../engine/replay';
import { REPLAYS_KEPT } from './config';
import type { ReplayMark } from './game-manifest';
import type { LobbyValue } from './protocol';

export interface Replay {
  gameId: string;
  /** Версия правил игры: запись другой версии несовместима. */
  version: string;
  date: string;
  seed: number;
  daily: boolean;
  mode: string;
  settings: Record<string, LobbyValue>;
  /** Соотношение сторон мира матча (ctx.aspect); в старых записях нет — 16:9. */
  aspect?: number;
  players: Array<{ id: string; nick: string; color: string; kind: string; fields?: Record<string, LobbyValue> }>;
  inputs: InputEvent[];
  /** Особые действия (выстрелы саботажника и т. п.); в старых записях нет. */
  actions?: ActionEvent[];
  /** Длина матча в тиках — для шкалы; в старых записях нет. */
  ticks?: number;
  /** Метки игры на шкале (волны, гибели). */
  marks?: ReplayMark[];
}

const PREFIX = 'arcade-hub:replays:';

export function listReplays(gameId: string): Replay[] {
  try {
    const raw = localStorage.getItem(PREFIX + gameId);
    return raw ? (JSON.parse(raw) as Replay[]) : [];
  } catch {
    return [];
  }
}

export function saveReplay(replay: Replay): void {
  const list = [replay, ...listReplays(replay.gameId)].slice(0, REPLAYS_KEPT);
  try {
    localStorage.setItem(PREFIX + replay.gameId, JSON.stringify(list));
  } catch {
    // Места не хватило — оставляем только новую запись.
    try {
      localStorage.setItem(PREFIX + replay.gameId, JSON.stringify([replay]));
    } catch {
      // и она не влезла — матч просто не запишется
    }
  }
}

export const isCompatible = (replay: Replay, version: string): boolean => replay.version === version;
