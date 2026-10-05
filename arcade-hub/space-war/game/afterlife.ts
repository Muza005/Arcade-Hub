// Гибель, призрак, воскрешение, саботаж (SPACE_WAR_SPEC §5 «Гибель…», §7; решения заказчика §14 пп. 2, 4):
// - соревнование: погибший сразу становится саботажником;
// - кооператив и командное: сначала призрак на время из лобби; его 3 осколка собирают союзники
//   (в командном — только своя команда; чужие корабли осколки отталкивают). Собрали все — игрок
//   возвращается с 1 жизнью. Время вышло — саботажник (в кооперативе его снаряды бьют по своим — целиться аккуратно).
// - саботаж выключен в лобби — вместо саботажника игрок выбывает.
import type { InputState } from '../../engine/input';
import type { Rng } from '../../engine/rng';
import {
  ASTEROID_HITBOX_K,
  ASTEROID_SPEED,
  BOMB_BLAST_RADIUS,
  BOMB_PUSH,
  BOMB_RADIUS,
  GHOST_PUSH,
  GHOST_PUSH_RADIUS,
  REVIVE_INVULN_S,
  REVIVE_LIVES,
  REVIVE_SHARDS,
  SAB_COOLDOWN_S,
  SAB_DEAD_EXTRA_S,
  SAB_ROCK_HP,
  SAB_ROCK_SIZE,
  SAB_SPEED_STEPS,
  SCORE_REVIVE,
  SHARD_DRAG,
  SHARD_PUSH_SPEED,
  SHARD_RADIUS,
  SHARD_SPEED,
  SHIP_HITBOX_RADIUS,
  type Mode,
  type SabKind,
} from '../config';
import { FEATURES } from '../features';
import type { Field } from './asteroids';
import { resetMult, type Pilot } from './pilot';
import { stepShip, type Bounds, type Vec } from './ship';

export interface Shard {
  owner: string;
  pos: Vec;
  prev: Vec;
  vel: Vec;
}

export interface Bomb {
  owner: string;
  pos: Vec;
  prev: Vec;
  vel: Vec;
}

/** Выстрел саботажника: вход на краю в долях поля, направление, ступень силы 1…4. */
export interface SabShot {
  kind: SabKind;
  x: number;
  y: number;
  dx: number;
  dy: number;
  step: number;
}

export interface AfterlifeEvents {
  ghosts: string[];
  revives: Array<{ id: string; by: string; x: number; y: number }>;
  saboteurs: string[];
  blasts: Array<{ x: number; y: number; owner: string }>;
  sabShots: Array<{ id: string; kind: SabKind }>;
}

export interface AfterlifeOptions {
  pilots: ReadonlyMap<string, Pilot>;
  bounds: Bounds;
  field: Field;
  rng: Rng;
  mode: Mode;
  teamOf: (id: string) => string;
  ghostS: number;
  sabotage: boolean;
  events: AfterlifeEvents;
  /** Рост скорости камней с волной — снаряды саботажника летят в темпе волны. */
  speedK: () => number;
}

export interface Afterlife {
  readonly shards: readonly Shard[];
  readonly bombs: readonly Bomb[];
  /** Жизни кончились: призрак или саботажник (или выбыл). */
  die(pilot: Pilot): void;
  /** Призраки летают (ввод как у корабля) и слегка отталкивают камни. */
  moveGhosts(dtS: number, read: (id: string) => InputState): void;
  /** Осколки, бомбы, кулдауны, таймеры призраков. */
  step(dtS: number): void;
  sabotage(id: string, shot: SabShot): boolean;
  /** Полный кулдаун снаряда сейчас: база + по секунде за каждого погибшего. */
  cooldownS(kind: SabKind): number;
  /** Снаряд Power попал в бомбу — она взрывается на месте. */
  shootBomb(at: Vec, reach: number): boolean;
}

export function createAfterlife(o: AfterlifeOptions): Afterlife {
  const { pilots, bounds, field, rng, events } = o;
  const shards: Shard[] = [];
  const bombs: Bomb[] = [];

  const allies = (a: string, b: string): boolean => o.mode === 'coop' || (o.mode === 'teams' && o.teamOf(a) === o.teamOf(b));
  const deadCount = (): number => [...pilots.values()].filter((p) => !p.alive).length;

  const becomeSaboteur = (pilot: Pilot): void => {
    if (!o.sabotage || !FEATURES.sabotage) {
      pilot.phase = 'out';
      return;
    }
    pilot.phase = 'saboteur';
    pilot.sabS.rock = 0;
    pilot.sabS.bomb = 0;
    events.saboteurs.push(pilot.ship.id);
  };

  const revive = (pilot: Pilot, by: Pilot): void => {
    pilot.phase = 'alive';
    pilot.alive = true;
    pilot.lives = REVIVE_LIVES;
    pilot.invulnS = REVIVE_INVULN_S;
    pilot.diedAtS = null;
    resetMult(pilot);
    by.score += SCORE_REVIVE;
    by.stats.revives++;
    events.revives.push({ id: pilot.ship.id, by: by.ship.id, x: pilot.ship.pos.x, y: pilot.ship.pos.y });
  };

  const explode = (i: number): void => {
    const bomb = bombs[i] as Bomb;
    bombs.splice(i, 1);
    events.blasts.push({ x: bomb.pos.x, y: bomb.pos.y, owner: bomb.owner });
    // Отброс без урона: корабли и камни в радиусе, к краю слабее.
    const push = (pos: Vec, vel: Vec): void => {
      const dx = pos.x - bomb.pos.x;
      const dy = pos.y - bomb.pos.y;
      const d = Math.hypot(dx, dy);
      if (d >= BOMB_BLAST_RADIUS) return;
      const k = BOMB_PUSH * (1 - d / BOMB_BLAST_RADIUS);
      const nx = d > 0 ? dx / d : 1;
      const ny = d > 0 ? dy / d : 0;
      vel.x += nx * k;
      vel.y += ny * k;
    };
    for (const p of pilots.values()) if (p.alive) push(p.ship.pos, p.ship.vel);
    for (const a of field.list) if (!a.held) push(a.pos, a.vel);
  };

  const outside = (p: Vec, margin: number): boolean =>
    p.x < bounds.left - margin || p.x > bounds.right + margin || p.y < bounds.top - margin || p.y > bounds.bottom + margin;

  return {
    shards,
    bombs,
    die(pilot) {
      pilot.alive = false;
      if (o.mode === 'versus') {
        becomeSaboteur(pilot);
        return;
      }
      pilot.phase = 'ghost';
      pilot.ghostS = o.ghostS;
      pilot.ship.vel.x = 0;
      pilot.ship.vel.y = 0;
      // Три осколка разлетаются в разные стороны.
      const base = rng.range(0, Math.PI * 2);
      for (let i = 0; i < REVIVE_SHARDS; i++) {
        const a = base + (i / REVIVE_SHARDS) * Math.PI * 2;
        const { x, y } = pilot.ship.pos;
        shards.push({
          owner: pilot.ship.id,
          pos: { x, y },
          prev: { x, y },
          vel: { x: Math.cos(a) * SHARD_SPEED, y: Math.sin(a) * SHARD_SPEED },
        });
      }
      events.ghosts.push(pilot.ship.id);
    },
    moveGhosts(dtS, read) {
      for (const pilot of pilots.values()) {
        if (pilot.phase !== 'ghost') continue;
        stepShip(pilot.ship, read(pilot.ship.id), dtS, bounds);
        const { pos } = pilot.ship;
        for (const a of field.list) {
          if (a.held) continue;
          const dx = a.pos.x - pos.x;
          const dy = a.pos.y - pos.y;
          const d = Math.hypot(dx, dy);
          if (d === 0 || d > GHOST_PUSH_RADIUS + a.radius) continue;
          a.vel.x += (dx / d) * GHOST_PUSH * dtS;
          a.vel.y += (dy / d) * GHOST_PUSH * dtS;
        }
      }
    },
    step(dtS) {
      // Призраки: время вышло — осколки гаснут, игрок становится саботажником.
      for (const pilot of pilots.values()) {
        for (const kind of Object.keys(pilot.sabS) as SabKind[]) pilot.sabS[kind] = Math.max(0, pilot.sabS[kind] - dtS);
        if (pilot.phase !== 'ghost') continue;
        pilot.ghostS -= dtS;
        if (pilot.ghostS > 0) continue;
        for (let i = shards.length - 1; i >= 0; i--) if ((shards[i] as Shard).owner === pilot.ship.id) shards.splice(i, 1);
        becomeSaboteur(pilot);
      }

      // Осколки: тормозят, упираются в края; союзник собирает, чужой отталкивает.
      const drag = Math.exp(-SHARD_DRAG * dtS);
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i] as Shard;
        s.prev.x = s.pos.x;
        s.prev.y = s.pos.y;
        s.vel.x *= drag;
        s.vel.y *= drag;
        s.pos.x = Math.min(bounds.right - SHARD_RADIUS, Math.max(bounds.left + SHARD_RADIUS, s.pos.x + s.vel.x * dtS));
        s.pos.y = Math.min(bounds.bottom - SHARD_RADIUS, Math.max(bounds.top + SHARD_RADIUS, s.pos.y + s.vel.y * dtS));
        for (const p of pilots.values()) {
          if (!p.alive) continue;
          const dx = s.pos.x - p.ship.pos.x;
          const dy = s.pos.y - p.ship.pos.y;
          const d = Math.hypot(dx, dy);
          if (d >= SHIP_HITBOX_RADIUS + SHARD_RADIUS) continue;
          if (!allies(p.ship.id, s.owner)) {
            s.vel.x = (d > 0 ? dx / d : 1) * SHARD_PUSH_SPEED;
            s.vel.y = (d > 0 ? dy / d : 0) * SHARD_PUSH_SPEED;
            continue;
          }
          shards.splice(i, 1);
          const owner = pilots.get(s.owner);
          if (owner?.phase === 'ghost' && !shards.some((x) => x.owner === s.owner)) revive(owner, p);
          break;
        }
      }

      // Бомбы: летят; касание корабля или камня — взрыв; ушла за край — пропала.
      for (let i = bombs.length - 1; i >= 0; i--) {
        const b = bombs[i] as Bomb;
        b.prev.x = b.pos.x;
        b.prev.y = b.pos.y;
        b.pos.x += b.vel.x * dtS;
        b.pos.y += b.vel.y * dtS;
        const hitShip = [...pilots.values()].some(
          (p) => p.alive && Math.hypot(p.ship.pos.x - b.pos.x, p.ship.pos.y - b.pos.y) < SHIP_HITBOX_RADIUS + BOMB_RADIUS,
        );
        const hitRock = field.list.some((a) => Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) < a.radius * ASTEROID_HITBOX_K + BOMB_RADIUS);
        if (hitShip || hitRock) explode(i);
        else if (outside(b.pos, BOMB_RADIUS * 2) && (b.pos.x - (bounds.left + bounds.right) / 2) * b.vel.x + (b.pos.y - (bounds.top + bounds.bottom) / 2) * b.vel.y > 0) {
          bombs.splice(i, 1);
        }
      }
    },
    sabotage(id, shot) {
      const pilot = pilots.get(id);
      if (!pilot || pilot.phase !== 'saboteur' || pilot.sabS[shot.kind] > 0) return false;
      const x = bounds.left + shot.x * (bounds.right - bounds.left);
      const y = bounds.top + shot.y * (bounds.bottom - bounds.top);
      const [min, max] = ASTEROID_SPEED[SAB_ROCK_SIZE];
      const speed = ((min + max) / 2) * (SAB_SPEED_STEPS[shot.step - 1] ?? 1) * o.speedK();
      const vx = shot.dx * speed;
      const vy = shot.dy * speed;
      if (shot.kind === 'rock') {
        const rock = field.launch(SAB_ROCK_SIZE, x, y, vx, vy);
        if (!rock) return false;
        rock.hp = rock.maxHp = SAB_ROCK_HP[0] + Math.floor(rng.next() * (SAB_ROCK_HP[1] - SAB_ROCK_HP[0] + 1));
        rock.owner = id;
      } else {
        bombs.push({ owner: id, pos: { x, y }, prev: { x, y }, vel: { x: vx, y: vy } });
      }
      pilot.sabS[shot.kind] = this.cooldownS(shot.kind);
      pilot.stats.sabShots++;
      events.sabShots.push({ id, kind: shot.kind });
      return true;
    },
    cooldownS(kind) {
      return SAB_COOLDOWN_S[kind] + SAB_DEAD_EXTRA_S * deadCount();
    },
    shootBomb(at, reach) {
      const i = bombs.findIndex((b) => Math.hypot(b.pos.x - at.x, b.pos.y - at.y) < reach + BOMB_RADIUS);
      if (i === -1) return false;
      explode(i);
      return true;
    },
  };
}
