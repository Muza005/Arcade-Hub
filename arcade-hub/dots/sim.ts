// Симуляция «Точек» без графики: по сиду и потоку ввода матч воспроизводится один в один.
import type { InputState } from '../engine/input';
import { createRng, type Rng } from '../engine/rng';
import {
  DASH_COOLDOWN_S,
  DASH_S,
  DASH_SPEED,
  DOT_RADIUS,
  DOT_SPEED,
  FIELD,
  type Field,
  SPAWN_RING_RADIUS,
  STAR_POINTS_SCORE,
  STAR_RADIUS,
  STARS_BASE,
  STARS_PER_PLAYER,
  THROW_COOLDOWN_S,
  THROW_SPEED,
  THROW_STEP_K,
} from './config';
import type { AimShot } from '../shared/protocol';

export interface Vec {
  x: number;
  y: number;
}

export interface Dot {
  id: string;
  pos: Vec;
  /** Позиция на прошлом шаге — для интерполяции при отрисовке. */
  prev: Vec;
  /** Последнее направление движения: в него идёт рывок без ввода. */
  dir: Vec;
  score: number;
  dashLeftS: number;
  cooldownS: number;
  prevBtn: boolean;
}

/** Брошенная звезда: летит по прямой, пока её не поймают или она не уйдёт за край. */
export interface FlyingStar {
  pos: Vec;
  vel: Vec;
  owner: string;
}

export interface SimOptions {
  durationS: number;
  dashEnabled: boolean;
  /** Поле под экран матча; без него — FIELD (16:9). */
  field?: Field;
}

export interface Sim {
  readonly field: Field;
  readonly dots: readonly Dot[];
  readonly stars: readonly Vec[];
  readonly flying: readonly FlyingStar[];
  readonly timeLeftS: number;
  readonly over: boolean;
  /** Кто собрал звезду на последнем шаге — для обратной связи на телефоне. */
  readonly pickups: readonly string[];
  /** Кто из них поймал брошенную звезду. */
  readonly caught: readonly string[];
  /** Бросок звезды с «прицела»: false — ещё кулдаун. */
  throwStar(id: string, shot: AimShot): boolean;
  /** Сколько ждать до следующего броска, с. */
  throwReadyInS(id: string): number;
  /** Досрочный конец матча («Завершить матч» у ведущего). */
  stop(): void;
  /** Прогресс перезарядки рывка 0…1 (1 — готов). Для ободка главной кнопки (st.mainButton, этап А5). */
  dashReady(id: string): number;
  step(dtS: number, read: (id: string) => InputState): void;
}

function randomStar(rng: Rng, field: Field): Vec {
  return {
    x: rng.range(field.left + STAR_RADIUS, field.right - STAR_RADIUS),
    y: rng.range(field.top + STAR_RADIUS, field.bottom - STAR_RADIUS),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function createSim(playerIds: readonly string[], seed: number, options: SimOptions): Sim {
  const rng = createRng(seed);
  const field = options.field ?? FIELD;
  const center = { x: (field.left + field.right) / 2, y: (field.top + field.bottom) / 2 };

  const dots: Dot[] = playerIds.map((id, i) => {
    const angle = (i / playerIds.length) * Math.PI * 2 - Math.PI / 2;
    const ring = playerIds.length === 1 ? 0 : SPAWN_RING_RADIUS;
    const pos = { x: center.x + Math.cos(angle) * ring, y: center.y + Math.sin(angle) * ring };
    return { id, pos, prev: { ...pos }, dir: { x: 1, y: 0 }, score: 0, dashLeftS: 0, cooldownS: 0, prevBtn: false };
  });

  const starCount = STARS_BASE + STARS_PER_PLAYER * playerIds.length;
  const stars: Vec[] = Array.from({ length: starCount }, () => randomStar(rng, field));

  const flying: FlyingStar[] = [];
  const throwCooldown = new Map<string, number>();
  let timeLeftS = options.durationS;
  let over = false;
  const pickups: string[] = [];
  const caught: string[] = [];

  const moveDot = (dot: Dot, input: InputState, dtS: number): void => {
    dot.prev.x = dot.pos.x;
    dot.prev.y = dot.pos.y;

    if (input.x !== 0 || input.y !== 0) {
      const len = Math.hypot(input.x, input.y);
      dot.dir = { x: input.x / len, y: input.y / len };
    }

    const pressed = input.btn && !dot.prevBtn;
    dot.prevBtn = input.btn;
    dot.cooldownS = Math.max(0, dot.cooldownS - dtS);
    if (pressed && options.dashEnabled && dot.cooldownS === 0) {
      dot.dashLeftS = DASH_S;
      dot.cooldownS = DASH_COOLDOWN_S;
    }

    let vx: number;
    let vy: number;
    if (dot.dashLeftS > 0) {
      dot.dashLeftS = Math.max(0, dot.dashLeftS - dtS);
      vx = dot.dir.x * DASH_SPEED;
      vy = dot.dir.y * DASH_SPEED;
    } else {
      vx = input.x * DOT_SPEED;
      vy = input.y * DOT_SPEED;
    }

    dot.pos.x = clamp(dot.pos.x + vx * dtS, field.left + DOT_RADIUS, field.right - DOT_RADIUS);
    dot.pos.y = clamp(dot.pos.y + vy * dtS, field.top + DOT_RADIUS, field.bottom - DOT_RADIUS);
  };

  const collect = (dot: Dot): void => {
    const reach = DOT_RADIUS + STAR_RADIUS;
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i] as Vec;
      if (Math.hypot(star.x - dot.pos.x, star.y - dot.pos.y) < reach) {
        dot.score += STAR_POINTS_SCORE;
        stars[i] = randomStar(rng, field);
        pickups.push(dot.id);
      }
    }
  };

  /** Брошенные звёзды: летят; кто поймал — +1, бросившему тоже +1 (если поймал не он). */
  const stepFlying = (dtS: number): void => {
    const reach = DOT_RADIUS + STAR_RADIUS;
    for (let i = flying.length - 1; i >= 0; i--) {
      const star = flying[i] as FlyingStar;
      star.pos.x += star.vel.x * dtS;
      star.pos.y += star.vel.y * dtS;
      const catcher = dots.find((d) => Math.hypot(star.pos.x - d.pos.x, star.pos.y - d.pos.y) < reach);
      const out =
        star.pos.x < field.left - STAR_RADIUS ||
        star.pos.x > field.right + STAR_RADIUS ||
        star.pos.y < field.top - STAR_RADIUS ||
        star.pos.y > field.bottom + STAR_RADIUS;
      if (catcher) {
        catcher.score += STAR_POINTS_SCORE;
        pickups.push(catcher.id);
        caught.push(catcher.id);
        const owner = dots.find((d) => d.id === star.owner);
        if (owner && owner !== catcher) owner.score += STAR_POINTS_SCORE;
      }
      if (catcher || out) flying.splice(i, 1);
    }
  };

  return {
    field,
    dots,
    stars,
    flying,
    throwStar(id, shot) {
      if (over || (throwCooldown.get(id) ?? 0) > 0) return false;
      const speed = THROW_SPEED * (THROW_STEP_K[shot.step - 1] ?? 1);
      flying.push({
        pos: { x: field.left + shot.x * (field.right - field.left), y: field.top + shot.y * (field.bottom - field.top) },
        vel: { x: shot.dx * speed, y: shot.dy * speed },
        owner: id,
      });
      throwCooldown.set(id, THROW_COOLDOWN_S);
      return true;
    },
    throwReadyInS: (id) => throwCooldown.get(id) ?? 0,
    get timeLeftS() {
      return timeLeftS;
    },
    get over() {
      return over;
    },
    pickups,
    caught,
    stop() {
      over = true;
    },
    dashReady(id) {
      const dot = dots.find((d) => d.id === id);
      return dot ? 1 - dot.cooldownS / DASH_COOLDOWN_S : 0;
    },
    step(dtS, read) {
      pickups.length = 0;
      caught.length = 0;
      if (over) return;
      for (const dot of dots) moveDot(dot, read(dot.id), dtS);
      // Звёзды собираются по порядку игроков — порядок фиксирован, результат детерминирован.
      for (const dot of dots) collect(dot);
      stepFlying(dtS);
      for (const [id, left] of throwCooldown) throwCooldown.set(id, Math.max(0, left - dtS));
      timeLeftS = Math.max(0, timeLeftS - dtS);
      if (timeLeftS === 0) over = true;
    },
  };
}
