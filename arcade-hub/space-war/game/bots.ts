// Боты Space War (SPACE_WAR_SPEC §8): три уровня на всю комнату.
// Слабый держится у края и не стреляет; средний уклоняется и отстреливает крупные;
// сильный сознательно пролетает вплотную ради множителя и стреляет экономно.
// Решение — по состоянию симуляции и своей случайности из сида матча: запись повторяется один в один.
// Задержка реакции: бот выполняет решение, принятое BOT_REACTION_S назад.
import type { InputState } from '../../engine/input';
import { createRng } from '../../engine/rng';
import { FIXED_STEP_HZ } from '../../shared/config';
import {
  AMMO_MAX,
  ASTEROID_HITBOX_K,
  BOSS_HITBOX_K,
  BOT_ARRIVE_PX,
  BOT_AVOID_WEIGHT,
  BOT_BRAKE_SPEED,
  BOT_CRUISE,
  BOT_EDGE_HOME,
  BOT_FIRE_GAP_S,
  BOT_FIRE_MIN_RANGE,
  BOT_FIRE_RANGE,
  BOT_HUNT_GAP_K,
  BOT_HUNT_RANGE,
  BOT_LOOKAHEAD_S,
  BOT_REACTION_S,
  BOT_SAFE_MARGIN,
  BOT_SEED_SALT,
  BOT_THREAT_FIRE,
  BOT_THRUST,
  BOT_WALL_MARGIN,
  BOT_WANDER_INSET,
  BOT_WANDER_S,
  NEAR_MISS_DISTANCE,
  SHIP_HITBOX_RADIUS,
  type BotLevel,
} from '../config';
import type { Asteroid } from './asteroids';
import type { Vec } from './ship';
import type { Pilot, Sim } from './sim';

interface Brain {
  queue: InputState[];
  target: Vec | null;
  retargetS: number;
  cooldownS: number;
  lastBtn: boolean;
}

export interface Bots {
  /** Ввод бота на этом шаге (вызывать один раз за шаг на бота). */
  input(id: string): InputState;
}

const IDLE: InputState = { x: 0, y: 0, btn: false };
const DT = 1 / FIXED_STEP_HZ;

export function createBots(sim: Sim, ids: readonly string[], level: BotLevel, seed: number): Bots {
  const rng = createRng((seed ^ BOT_SEED_SALT) >>> 0);
  const delaySteps = Math.round(BOT_REACTION_S[level] * FIXED_STEP_HZ);
  /** Бот действует с опозданием — значит, и смотреть вперёд надо дальше. */
  const lookaheadS = BOT_LOOKAHEAD_S + BOT_REACTION_S[level];
  const brains = new Map<string, Brain>(
    ids.map((id) => [id, { queue: [], target: null, retargetS: 0, cooldownS: 0, lastBtn: false }]),
  );
  const b = sim.bounds;

  const wanderPoint = (): Vec => {
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    return {
      x: rng.range(b.left + w * BOT_WANDER_INSET, b.right - w * BOT_WANDER_INSET),
      y: rng.range(b.top + h * BOT_WANDER_INSET, b.bottom - h * BOT_WANDER_INSET),
    };
  };

  /** Ближайшая точка у края поля — «дом» слабого бота. */
  const edgeHome = (p: Vec): Vec => {
    const d = [p.x - b.left, b.right - p.x, p.y - b.top, b.bottom - p.y];
    const i = d.indexOf(Math.min(...d));
    if (i === 0) return { x: b.left + BOT_EDGE_HOME, y: p.y };
    if (i === 1) return { x: b.right - BOT_EDGE_HOME, y: p.y };
    if (i === 2) return { x: p.x, y: b.top + BOT_EDGE_HOME };
    return { x: p.x, y: b.bottom - BOT_EDGE_HOME };
  };

  /** Угроза: камни, которые пройдут ближе запаса в ближайшие BOT_LOOKAHEAD_S. Возвращает вектор ухода и силу. */
  const threat = (pilot: Pilot): { x: number; y: number; level: number } => {
    const { pos, vel } = pilot.ship;
    let ax = 0;
    let ay = 0;
    let level = 0;
    /** Тело (камень или босс) с радиусом удара reach. */
    const consider = (p: Vec, v: Vec, reach: number): void => {
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      const vx = v.x - vel.x;
      const vy = v.y - vel.y;
      const vv = vx * vx + vy * vy;
      const t = vv > 0 ? Math.min(lookaheadS, Math.max(0, -(dx * vx + dy * vy) / vv)) : 0;
      const cx = dx + vx * t;
      const cy = dy + vy * t;
      const closest = Math.hypot(cx, cy);
      const danger = reach + BOT_SAFE_MARGIN;
      if (closest >= danger) return;
      const urgency = (1 - t / lookaheadS) * (1 - closest / danger);
      // Уходим от точки встречи; прямо в лоб — в сторону, поперёк движения камня.
      let ux = -cx;
      let uy = -cy;
      if (Math.hypot(ux, uy) < 1) {
        ux = -vy;
        uy = vx;
      }
      const n = Math.hypot(ux, uy) || 1;
      ax += (ux / n) * urgency;
      ay += (uy / n) * urgency;
      level = Math.max(level, urgency);
    };
    for (const rock of sim.asteroids) consider(rock.pos, rock.vel, SHIP_HITBOX_RADIUS + rock.radius * ASTEROID_HITBOX_K);
    const boss = sim.boss;
    if (boss && boss.radius > 0) consider(boss.pos, boss.vel, SHIP_HITBOX_RADIUS + boss.radius * BOSS_HITBOX_K);
    return { x: ax, y: ay, level };
  };

  /** Сильный: точка сбоку от камня на расстоянии сближения — пролететь вплотную, не задев. */
  const huntPoint = (pilot: Pilot): Vec | null => {
    const { pos } = pilot.ship;
    let best: Asteroid | null = null;
    let bestD = BOT_HUNT_RANGE;
    for (const rock of sim.asteroids) {
      if (rock.size === 'small' || pilot.nearIds.has(rock.id)) continue;
      const d = Math.hypot(rock.pos.x - pos.x, rock.pos.y - pos.y);
      if (d < bestD) {
        bestD = d;
        best = rock;
      }
    }
    if (!best) return null;
    const speed = Math.hypot(best.vel.x, best.vel.y) || 1;
    // Перпендикуляр к ходу камня — с той стороны, где корабль.
    let px = -best.vel.y / speed;
    let py = best.vel.x / speed;
    if ((pos.x - best.pos.x) * px + (pos.y - best.pos.y) * py < 0) {
      px = -px;
      py = -py;
    }
    const r = SHIP_HITBOX_RADIUS + best.radius * ASTEROID_HITBOX_K + NEAR_MISS_DISTANCE * BOT_HUNT_GAP_K;
    return { x: best.pos.x + px * r, y: best.pos.y + py * r };
  };

  const nearestRock = (p: Vec): { rock: Asteroid; d: number } | null => {
    let best: { rock: Asteroid; d: number } | null = null;
    for (const rock of sim.asteroids) {
      if (rock.pos.x < b.left || rock.pos.x > b.right || rock.pos.y < b.top || rock.pos.y > b.bottom) continue;
      const d = Math.hypot(rock.pos.x - p.x, rock.pos.y - p.y);
      if (!best || d < best.d) best = { rock, d };
    }
    return best;
  };

  const decide = (pilot: Pilot, brain: Brain): InputState => {
    const { pos, vel } = pilot.ship;
    brain.retargetS -= DT;
    brain.cooldownS -= DT;

    // Куда хочется.
    let target: Vec;
    if (level === 'weak') target = edgeHome(pos);
    else {
      const hunt = level === 'strong' ? huntPoint(pilot) : null;
      if (hunt) target = hunt;
      else {
        if (!brain.target || brain.retargetS <= 0 || Math.hypot(brain.target.x - pos.x, brain.target.y - pos.y) < BOT_ARRIVE_PX / 2) {
          brain.target = wanderPoint();
          brain.retargetS = BOT_WANDER_S;
        }
        target = brain.target;
      }
    }
    const tx = target.x - pos.x;
    const ty = target.y - pos.y;
    const dist = Math.hypot(tx, ty) || 1;
    const k = BOT_CRUISE * Math.min(1, dist / BOT_ARRIVE_PX);
    // Желаемая скорость к цели минус текущая: без раскачки у точки.
    let x = (tx / dist) * k - vel.x / BOT_BRAKE_SPEED;
    let y = (ty / dist) * k - vel.y / BOT_BRAKE_SPEED;

    // От стен.
    if (pos.x - b.left < BOT_WALL_MARGIN) x += 1 - (pos.x - b.left) / BOT_WALL_MARGIN;
    if (b.right - pos.x < BOT_WALL_MARGIN) x -= 1 - (b.right - pos.x) / BOT_WALL_MARGIN;
    if (pos.y - b.top < BOT_WALL_MARGIN) y += 1 - (pos.y - b.top) / BOT_WALL_MARGIN;
    if (b.bottom - pos.y < BOT_WALL_MARGIN) y -= 1 - (b.bottom - pos.y) / BOT_WALL_MARGIN;

    // Уклонение важнее цели.
    const danger = threat(pilot);
    x += danger.x * BOT_AVOID_WEIGHT;
    y += danger.y * BOT_AVOID_WEIGHT;

    const len = Math.hypot(x, y);
    const max = BOT_THRUST[level];
    if (len > max) {
      x = (x / len) * max;
      y = (y / len) * max;
    }

    // Выстрел — отдельным нажатием: кнопка отпускается на следующем шаге.
    let fire = false;
    if (!brain.lastBtn && brain.cooldownS <= 0 && pilot.ammo > 0 && level !== 'weak') {
      const near = nearestRock(pos);
      if (near) {
        if (level === 'mid') fire = near.rock.size !== 'small' && near.d < BOT_FIRE_RANGE && near.d > BOT_FIRE_MIN_RANGE;
        else fire = danger.level > BOT_THREAT_FIRE || pilot.ammo >= AMMO_MAX;
      }
    }
    if (fire) brain.cooldownS = BOT_FIRE_GAP_S[level];
    brain.lastBtn = fire;
    return { x, y, btn: fire };
  };

  return {
    input(id) {
      const pilot = sim.pilots.get(id);
      const brain = brains.get(id);
      if (!pilot || !brain || !pilot.alive) return IDLE;
      brain.queue.push(decide(pilot, brain));
      // Решение, принятое delaySteps шагов назад.
      return brain.queue.length > delaySteps ? (brain.queue.shift() ?? IDLE) : IDLE;
    },
  };
}
