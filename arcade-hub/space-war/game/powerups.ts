// Усиления (SPACE_WAR_SPEC §5 «Усиления», «Перегрузка»): выпадают из разбитых снарядами камней (1/20),
// лежат на поле 10 с, подбираются пролётом. В каждом режиме — свои 5 из 7.
import type { Rng } from '../../engine/rng';
import { POWERUP_LIFETIME_S, POWERUPS_OF_MODE, type Mode, type PowerupKind } from '../config';
import type { Vec } from './ship';

export interface Powerup {
  id: number;
  kind: PowerupKind;
  pos: Vec;
  /** Сколько ещё лежать на поле, с. */
  leftS: number;
}

export interface Powerups {
  readonly list: readonly Powerup[];
  /** Выпадение в точке: вид — случайный из усилений режима. */
  drop(x: number, y: number): Powerup;
  remove(p: Powerup): void;
  step(dtS: number): void;
}

export function createPowerups(rng: Rng, mode: Mode): Powerups {
  const list: Powerup[] = [];
  const kinds = POWERUPS_OF_MODE[mode];
  let nextId = 1;
  return {
    list,
    drop(x, y) {
      const p = { id: nextId++, kind: rng.pick(kinds), pos: { x, y }, leftS: POWERUP_LIFETIME_S };
      list.push(p);
      return p;
    },
    remove(p) {
      const i = list.indexOf(p);
      if (i !== -1) list.splice(i, 1);
    },
    step(dtS) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i] as Powerup;
        p.leftS -= dtS;
        if (p.leftS <= 0) list.splice(i, 1);
      }
    },
  };
}
