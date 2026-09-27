// Реестр игр. Единственное место платформы, которое знает о папках игр — и только об их манифестах.
// Новая игра: добавить её манифест в этот список.
import { dotsManifest } from '../dots/manifest';
import type { GameManifest } from './game-manifest';

export const GAMES: readonly GameManifest[] = [dotsManifest];

export function findGame(id: string): GameManifest | undefined {
  return GAMES.find((g) => g.id === id);
}
