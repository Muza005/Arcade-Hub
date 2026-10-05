// Рисунок боссов (решение заказчика: эффектно и красиво). Всё — неон в несколько слоёв поверх тёмной заливки,
// bloom слоя свечения добавляет ореол. Общее: кольцо прочности делениями, вспышка белым от попадания.
// Сеятель — створки шестигранника вокруг пульсирующего ядра и кружащие семена.
// Охотник — хищный клин носом по ходу, глаз и выхлоп в цвет жертвы, пунктир «на прицеле» и рамка вокруг жертвы.
// Крепость — кристалл-ядро; стены колец светятся дугами между разрывами, у краёв разрывов — огни.
// Гигант — глыба с кратерами, раскалённые трещины растут с уроном, на исходе сквозь них видно ядро.
// Воронка — тёмный горизонт с ярким краем, рукава-спирали и кружащая пыль. Рой рисуется камнями — здесь его нет.
import { Graphics } from 'pixi.js';
import type { Rng } from '../../engine/rng';
import {
  ASTEROID_COLOR,
  BOSS_COLORS,
  SWARM_CHEVRONS,
  SWARM_WALL_W,
  SWARM_WARN_HZ,
  SWARM_WARN_INSET,
  BOSS_FLASH_S,
  BOSS_HP_RING_GAP,
  BOSS_HP_RING_PX,
  BOSS_LINE_PX,
  GIANT_SHAPE_JITTER,
  GIANT_SHAPE_POINTS,
  HUNTER_TETHER_ALPHA,
  VORTEX_ARM_TURNS,
  VORTEX_ARMS,
} from '../config';
import type { Boss } from '../game/bosses';
import { mixColor } from './color';

const WHITE = '#FFFFFF';
const FILL_ALPHA = 0.88;
/** Неон: широкий бледный ореол, средний слой, яркая линия и белая сердцевина. */
const GLOW_LAYERS = [
  { w: 3.2, a: 0.12 },
  { w: 1.8, a: 0.3 },
  { w: 1, a: 1 },
] as const;
const CORE_W = 0.35;
const CORE_A = 0.55;
/** Кольцо прочности — делениями. */
const HP_TICKS = 32;
const HP_TICK_GAP = 0.18; // доля деления — промежуток
const HP_DIM = 0.16;
// Сеятель
const SEEDER_SIDES = 6;
const SEEDER_PLATE_GAP = 0.12; // зазор между створками, доля стороны
const SEEDER_CORE_K = 0.36;
const SEEDER_SEEDS = 6;
const SEEDER_SEED_ORBIT = 0.68;
const PULSE_HZ = 1.5;
// Охотник
const HUNTER_NOSE = 1.3;
const HUNTER_WING_X = -0.75;
const HUNTER_WING_Y = 0.95;
const HUNTER_NOTCH = -0.3;
const HUNTER_TETHER_DASH = 18;
const HUNTER_RETICLE_R = 44;
const HUNTER_RETICLE_ARM = 14;
const FLAME_HZ = 22;
// Крепость
const FORTRESS_FACETS = 8;
const FORTRESS_WALL_W = 26;
const FORTRESS_WALL_A = 0.1;
const FORTRESS_LINE_A = 0.45;
const FORTRESS_PYLON_R = 7;
// Гигант
const GIANT_CRATERS = 7;
const GIANT_CORE_FROM = 0.65; // урон, с которого сквозь трещины видно ядро
// Воронка
const VORTEX_REACH_K = 5;
const VORTEX_ARM_STEPS = 28;
const VORTEX_DUST = 24;
const VORTEX_RIM = '#7FE7FF';

export interface BossDrawExtra {
  /** Охотник: где жертва и её цвет. */
  prey?: { x: number; y: number; color: string };
}

export interface BossView {
  readonly view: Graphics;
  /** Цвет босса сейчас (у Охотника — цвет жертвы): полоска прочности и взрыв. */
  color(boss: Boss, preyColor?: string): string;
  draw(boss: Boss | null, x: number, y: number, timeS: number, bg: string, extra?: BossDrawExtra): void;
  update(dtS: number): void;
}

export function createBossView(rng: Rng): BossView {
  const view = new Graphics();
  // Формы — по сиду эффектов (не влияют на матч).
  const giantShape = Array.from({ length: GIANT_SHAPE_POINTS }, () => 1 + rng.range(-GIANT_SHAPE_JITTER, GIANT_SHAPE_JITTER));
  const crackAngles = Array.from({ length: GIANT_SHAPE_POINTS }, () => rng.range(0, Math.PI * 2));
  const craters = Array.from({ length: GIANT_CRATERS }, () => ({ a: rng.range(0, Math.PI * 2), d: rng.range(0.2, 0.7), r: rng.range(0.06, 0.13) }));
  const dust = Array.from({ length: VORTEX_DUST }, () => ({ a: rng.range(0, Math.PI * 2), d: rng.range(1.3, 2.6), s: rng.range(0.6, 1.4) }));
  let lastHits = 0;
  let lastKind = '';
  let flashS = 0;

  /** Неоновая обводка: путь рисуется заново на каждый слой (PixiJS сбрасывает путь после обводки). */
  const neon = (path: () => void, color: string, width: number, alpha = 1, white = false): void => {
    for (const l of GLOW_LAYERS) {
      path();
      view.stroke({ color, width: width * l.w, alpha: alpha * l.a, join: 'round', cap: 'round' });
    }
    if (!white) return;
    path();
    view.stroke({ color: WHITE, width: width * CORE_W, alpha: alpha * CORE_A, join: 'round', cap: 'round' });
  };
  const poly = (pts: number[], color: string, fill: string, width = BOSS_LINE_PX): void => {
    view.poly(pts).fill({ color: fill, alpha: FILL_ALPHA });
    neon(() => view.poly(pts), color, width, 1, true);
  };
  /** Мягкое пятно: круги к краю прозрачнее. */
  const blob = (x: number, y: number, r: number, color: string, alpha: number): void => {
    const steps = 5;
    for (let i = steps; i >= 1; i--) view.circle(x, y, (r * i) / steps).fill({ color, alpha: alpha / steps });
  };

  /** Кольцо прочности делениями: живые — цветом босса, потерянные — бледно. */
  const hpRing = (boss: Boss, outer: number, color: string): void => {
    if (boss.maxHp <= 0) return;
    const r = outer + BOSS_HP_RING_GAP;
    const left = boss.hp / boss.maxHp;
    const step = (Math.PI * 2) / HP_TICKS;
    for (let i = 0; i < HP_TICKS; i++) {
      const a0 = -Math.PI / 2 + i * step;
      const a1 = a0 + step * (1 - HP_TICK_GAP);
      const on = (i + 1) / HP_TICKS <= left + 1e-6;
      view.moveTo(Math.cos(a0) * r, Math.sin(a0) * r).arc(0, 0, r, a0, a1);
      view.stroke({ color, width: BOSS_HP_RING_PX, alpha: on ? 1 : HP_DIM, cap: 'butt' });
    }
  };

  const seeder = (boss: Boss, timeS: number, color: string, bg: string): void => {
    const r = boss.radius;
    const a = boss.angle;
    view.circle(0, 0, r).fill({ color: bg, alpha: FILL_ALPHA });
    // Створки: каждая сторона шестигранника — отдельная пластина с зазорами.
    for (let i = 0; i < SEEDER_SIDES; i++) {
      const t0 = a + (i / SEEDER_SIDES) * Math.PI * 2;
      const t1 = a + ((i + 1) / SEEDER_SIDES) * Math.PI * 2;
      const p = (t: number, k: number): [number, number] => [Math.cos(t) * r * k, Math.sin(t) * r * k];
      const g = (t1 - t0) * SEEDER_PLATE_GAP;
      const [ax, ay] = p(t0 + g, 1);
      const [bx, by] = p(t1 - g, 1);
      const [cx, cy] = p(t1 - g * 1.6, 0.8);
      const [dx, dy] = p(t0 + g * 1.6, 0.8);
      const plate = [ax, ay, bx, by, cx, cy, dx, dy];
      view.poly(plate).fill({ color, alpha: 0.12 });
      neon(() => view.poly(plate), color, BOSS_LINE_PX * 0.8);
    }
    // Внутренний треугольник крутится навстречу.
    const tri: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t = -a * 1.6 + (i / 3) * Math.PI * 2;
      tri.push(Math.cos(t) * r * 0.55, Math.sin(t) * r * 0.55);
    }
    neon(() => view.poly(tri), color, BOSS_LINE_PX * 0.5, 0.7);
    // Семена кружат и вспыхивают по очереди.
    for (let i = 0; i < SEEDER_SEEDS; i++) {
      const t = a * 2.2 + (i / SEEDER_SEEDS) * Math.PI * 2;
      const glow = 0.5 + 0.5 * Math.sin(timeS * PULSE_HZ * Math.PI * 2 + i);
      blob(Math.cos(t) * r * SEEDER_SEED_ORBIT, Math.sin(t) * r * SEEDER_SEED_ORBIT, 9, color, 0.5 + glow * 0.5);
    }
    const pulse = 1 + 0.15 * Math.sin(timeS * PULSE_HZ * Math.PI * 2);
    blob(0, 0, r * SEEDER_CORE_K * pulse * 1.6, color, 0.5);
    view.circle(0, 0, r * SEEDER_CORE_K * pulse * 0.55).fill({ color: WHITE, alpha: 0.85 });
  };

  const hunter = (boss: Boss, timeS: number, color: string, bg: string, extra: BossDrawExtra | undefined, x: number, y: number): void => {
    const r = boss.radius;
    const a = boss.angle;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const rot = (px: number, py: number): [number, number] => [(px * c - py * s) * r, (px * s + py * c) * r];
    // Пунктир «на прицеле» и рамка вокруг жертвы.
    if (extra?.prey) {
      const dx = extra.prey.x - x;
      const dy = extra.prey.y - y;
      const d = Math.hypot(dx, dy);
      const dashes = Math.floor(d / HUNTER_TETHER_DASH);
      const crawl = (timeS * 3) % 2;
      for (let i = 0; i < dashes; i += 2) {
        const k0 = (i + crawl) / dashes;
        const k1 = Math.min(1, (i + 1 + crawl) / dashes);
        if (k0 >= 1) continue;
        view.moveTo(dx * k0, dy * k0).lineTo(dx * k1, dy * k1);
      }
      view.stroke({ color: extra.prey.color, width: 2, alpha: HUNTER_TETHER_ALPHA });
      const spin = timeS * 1.5;
      const reticle = (): void => {
        for (let i = 0; i < 4; i++) {
          const t = spin + (i * Math.PI) / 2;
          const ox = dx + Math.cos(t) * HUNTER_RETICLE_R;
          const oy = dy + Math.sin(t) * HUNTER_RETICLE_R;
          const t1 = t + Math.PI * 0.75;
          const t2 = t - Math.PI * 0.75;
          view
            .moveTo(ox + Math.cos(t1) * HUNTER_RETICLE_ARM, oy + Math.sin(t1) * HUNTER_RETICLE_ARM)
            .lineTo(ox, oy)
            .lineTo(ox + Math.cos(t2) * HUNTER_RETICLE_ARM, oy + Math.sin(t2) * HUNTER_RETICLE_ARM);
        }
      };
      neon(reticle, extra.prey.color, 2.5, 0.8);
    }
    // Выхлоп: два дрожащих языка за кормой.
    const flick = 0.7 + 0.3 * Math.sin(timeS * FLAME_HZ);
    const flames = (): void => {
      for (const side of [-1, 1]) {
        const [fx, fy] = rot(HUNTER_WING_X * 0.8, side * 0.35);
        const [tx, ty] = rot(HUNTER_WING_X * 0.8 - 0.9 * flick, side * 0.3);
        view.moveTo(fx, fy).lineTo(tx, ty);
      }
    };
    neon(flames, color, BOSS_LINE_PX * 0.8, 0.8);
    // Корпус-клин.
    const hull = [
      ...rot(HUNTER_NOSE, 0),
      ...rot(HUNTER_WING_X, -HUNTER_WING_Y),
      ...rot(HUNTER_NOTCH, 0),
      ...rot(HUNTER_WING_X, HUNTER_WING_Y),
    ];
    poly(hull, color, bg);
    // Рёбра и глаз.
    const [n1x, n1y] = rot(HUNTER_NOSE * 0.55, 0);
    const [w1x, w1y] = rot(HUNTER_WING_X * 0.6, -HUNTER_WING_Y * 0.55);
    const [w2x, w2y] = rot(HUNTER_WING_X * 0.6, HUNTER_WING_Y * 0.55);
    neon(() => view.moveTo(w1x, w1y).lineTo(n1x, n1y).lineTo(w2x, w2y), color, BOSS_LINE_PX * 0.45, 0.6);
    const [ex, ey] = rot(0.45, 0);
    const blink = 0.75 + 0.25 * Math.sin(timeS * PULSE_HZ * Math.PI * 4);
    blob(ex, ey, 16, color, blink);
    view.circle(ex, ey, 4).fill({ color: WHITE, alpha: 0.95 });
  };

  const fortress = (boss: Boss, timeS: number, color: string, bg: string): void => {
    // Стены колец: дуги между разрывами, у краёв разрывов — огни.
    for (const ring of boss.rings) {
      if (ring.radius <= 0) continue;
      const slot = (Math.PI * 2) / ring.slots;
      const filled = Array.from({ length: ring.slots }, (_, i) => !ring.empty.includes(i));
      for (let i = 0; i < ring.slots; i++) {
        // Начало дуги — занятое место после пустого.
        if (!filled[i] || filled[(i - 1 + ring.slots) % ring.slots]) continue;
        let n = 0;
        while (n < ring.slots && filled[(i + n) % ring.slots]) n++;
        const a0 = ring.angle + i * slot;
        const a1 = a0 + (n - 1) * slot;
        const wall = (): void => {
          view.moveTo(Math.cos(a0) * ring.radius, Math.sin(a0) * ring.radius).arc(0, 0, ring.radius, a0, a1);
        };
        wall();
        view.stroke({ color, width: FORTRESS_WALL_W, alpha: FORTRESS_WALL_A, cap: 'round' });
        neon(wall, color, 2, FORTRESS_LINE_A);
        const glow = 0.6 + 0.4 * Math.sin(timeS * PULSE_HZ * Math.PI * 2 + i);
        for (const t of [a0, a1]) blob(Math.cos(t) * ring.radius, Math.sin(t) * ring.radius, FORTRESS_PYLON_R * 2.4, color, glow);
      }
    }
    // Ядро-кристалл: восьмигранник, внутри — ромб навстречу, свет пульсирует.
    const r = boss.radius;
    const oct: number[] = [];
    for (let i = 0; i < FORTRESS_FACETS; i++) {
      const t = boss.angle * 0.5 + (i / FORTRESS_FACETS) * Math.PI * 2;
      oct.push(Math.cos(t) * r, Math.sin(t) * r);
    }
    poly(oct, color, bg);
    const dia: number[] = [];
    for (let i = 0; i < 4; i++) {
      const t = -boss.angle + (i / 4) * Math.PI * 2;
      dia.push(Math.cos(t) * r * 0.6, Math.sin(t) * r * 0.6);
    }
    neon(() => view.poly(dia), color, BOSS_LINE_PX * 0.5, 0.8);
    const pulse = 1 + 0.2 * Math.sin(timeS * PULSE_HZ * Math.PI * 2);
    blob(0, 0, r * 0.5 * pulse, color, 0.8);
    view.circle(0, 0, r * 0.14 * pulse).fill({ color: WHITE, alpha: 0.9 });
  };

  const giant = (boss: Boss, timeS: number, color: string, bg: string): void => {
    const r = boss.radius;
    const a = boss.angle;
    const pts: number[] = [];
    giantShape.forEach((k, i) => {
      const t = a + (i / giantShape.length) * Math.PI * 2;
      pts.push(Math.cos(t) * r * k, Math.sin(t) * r * k);
    });
    const damage = boss.maxHp > 0 ? 1 - boss.hp / boss.maxHp : 0;
    view.poly(pts).fill({ color: bg, alpha: FILL_ALPHA });
    // На исходе сквозь глыбу проступает раскалённое ядро.
    if (damage > GIANT_CORE_FROM) {
      const k = (damage - GIANT_CORE_FROM) / (1 - GIANT_CORE_FROM);
      blob(0, 0, r * 0.7, color, k * (0.6 + 0.2 * Math.sin(timeS * PULSE_HZ * Math.PI * 2)));
    }
    for (const c of craters) {
      const t = a + c.a;
      view.circle(Math.cos(t) * r * c.d, Math.sin(t) * r * c.d, r * c.r);
      view.stroke({ color: ASTEROID_COLOR, width: 2, alpha: 0.35 });
    }
    neon(() => view.poly(pts), ASTEROID_COLOR, BOSS_LINE_PX, 1, true);
    // Трещины: чем меньше прочности, тем больше раскалённых разломов от центра.
    const cracks = Math.ceil(damage * crackAngles.length);
    const crackPath = (): void => {
      for (let i = 0; i < cracks; i++) {
        const t = a + (crackAngles[i] ?? 0);
        view
          .moveTo(Math.cos(t) * r * 0.12, Math.sin(t) * r * 0.12)
          .lineTo(Math.cos(t + 0.2) * r * 0.55, Math.sin(t + 0.2) * r * 0.55)
          .lineTo(Math.cos(t - 0.05) * r * 0.9, Math.sin(t - 0.05) * r * 0.9);
      }
    };
    if (cracks > 0) neon(crackPath, color, BOSS_LINE_PX * 0.6, 1, true);
  };

  /** Рой: стены — светящаяся линия через камни с проходом; у краёв прохода — огни, в проходе — бегущие стрелки
   *  по ходу стены. Перед выходом стена мигает полосой у своего края, проход на ней — светлым. */
  const swarm = (boss: Boss, timeS: number, color: string, ox: number, oy: number): void => {
    const pt = (axis: 'x' | 'y', along: number, across: number): [number, number] =>
      axis === 'x' ? [along - ox, across - oy] : [across - ox, along - oy];
    for (const w of boss.walls) {
      const g0 = w.gap;
      const g1 = w.gap + w.gapSize;
      if (w.warnS > 0) {
        const blink = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(timeS * SWARM_WARN_HZ * Math.PI * 2));
        // Полоса у края, откуда выйдет стена: стена — цветом Роя, проход — белым.
        const e = w.along + w.dir * SWARM_WARN_INSET;
        const seg = (a: number, b: number): void => {
          const [ax, ay] = pt(w.axis, e, a);
          const [bx, by] = pt(w.axis, e, b);
          view.moveTo(ax, ay).lineTo(bx, by);
        };
        neon(() => (seg(w.lo, g0), seg(g1, w.hi)), color, 3, blink);
        neon(() => seg(g0, g1), WHITE, 2, blink * 0.8);
        continue;
      }
      const line = (a: number, b: number): void => {
        const [ax, ay] = pt(w.axis, w.along, a);
        const [bx, by] = pt(w.axis, w.along, b);
        view.moveTo(ax, ay).lineTo(bx, by);
      };
      line(w.lo, g0);
      line(g1, w.hi);
      view.stroke({ color, width: SWARM_WALL_W, alpha: 0.12 });
      neon(() => (line(w.lo, g0), line(g1, w.hi)), color, 2, 0.5);
      for (const c of [g0, g1]) {
        const [px, py] = pt(w.axis, w.along, c);
        blob(px, py, 16, color, 0.9);
      }
      // Стрелки в проходе — куда идёт стена.
      const run = (timeS * 2) % 1;
      const chevrons = (): void => {
        for (let i = 0; i < SWARM_CHEVRONS; i++) {
          const c = g0 + ((i + 0.5) / SWARM_CHEVRONS) * (g1 - g0);
          const tip = w.along + w.dir * (6 + run * 10);
          const [tx, ty] = pt(w.axis, tip, c);
          const [ax, ay] = pt(w.axis, tip - w.dir * 10, c - 8);
          const [bx, by] = pt(w.axis, tip - w.dir * 10, c + 8);
          view.moveTo(ax, ay).lineTo(tx, ty).lineTo(bx, by);
        }
      };
      neon(chevrons, color, 2, 0.7 * (1 - run));
    }
  };

  const vortex = (boss: Boss, timeS: number, color: string): void => {
    const r = boss.radius;
    const a = boss.angle;
    // Пыль кружит быстрее у центра.
    for (const d of dust) {
      const t = d.a + a * d.s * (2.6 / d.d);
      blob(Math.cos(t) * r * d.d, Math.sin(t) * r * d.d, 5, d.s > 1 ? VORTEX_RIM : color, 0.7);
    }
    // Рукава: к краю тоньше и бледнее, у ядра — ярче.
    for (let arm = 0; arm < VORTEX_ARMS; arm++) {
      const base = a + (arm / VORTEX_ARMS) * Math.PI * 2;
      for (let st = 0; st < VORTEX_ARM_STEPS; st++) {
        const f0 = st / VORTEX_ARM_STEPS;
        const f1 = (st + 1) / VORTEX_ARM_STEPS;
        const p = (f: number): [number, number] => {
          const rr = r * (1 + f * (VORTEX_REACH_K - 1));
          const t = base - f * VORTEX_ARM_TURNS * Math.PI * 2;
          return [Math.cos(t) * rr, Math.sin(t) * rr];
        };
        const [x0, y0] = p(f0);
        const [x1, y1] = p(f1);
        neon(() => view.moveTo(x0, y0).lineTo(x1, y1), mixColor(VORTEX_RIM, color, f0 * 1.5), BOSS_LINE_PX * (1.2 - f0), 0.85 * (1 - f0));
      }
    }
    // Горизонт: чёрное ядро, яркий край, тонкое кольцо аккреции.
    blob(0, 0, r * 1.8, color, 0.45);
    view.circle(0, 0, r).fill({ color: '#000000' });
    neon(() => view.circle(0, 0, r), VORTEX_RIM, BOSS_LINE_PX, 1, true);
    const wob = 1.25 + 0.05 * Math.sin(timeS * PULSE_HZ * Math.PI * 2);
    neon(() => view.ellipse(0, 0, r * wob * 1.3, r * wob * 0.45), color, 2, 0.6);
  };

  return {
    view,
    color(boss, preyColor) {
      return boss.kind === 'hunter' && preyColor ? preyColor : BOSS_COLORS[boss.kind];
    },
    update(dtS) {
      flashS = Math.max(0, flashS - dtS);
    },
    draw(boss, x, y, timeS, bg, extra) {
      view.clear();
      view.visible = boss !== null;
      if (!boss) {
        lastHits = 0;
        return;
      }
      // Новый босс — счётчик попаданий с нуля; попадание — вспышка.
      if (boss.kind !== lastKind) {
        lastKind = boss.kind;
        lastHits = boss.hits;
      }
      if (boss.hits > lastHits) flashS = BOSS_FLASH_S;
      lastHits = boss.hits;
      if (!view.visible) return;
      view.position.set(x, y);
      if (boss.kind === 'swarm') {
        swarm(boss, timeS, BOSS_COLORS.swarm, x, y);
        return;
      }
      const base = boss.kind === 'hunter' && extra?.prey ? extra.prey.color : BOSS_COLORS[boss.kind];
      const color = mixColor(base, WHITE, flashS / BOSS_FLASH_S);
      if (boss.kind === 'seeder') seeder(boss, timeS, color, bg);
      else if (boss.kind === 'hunter') hunter(boss, timeS, color, bg, extra, x, y);
      else if (boss.kind === 'fortress') fortress(boss, timeS, color, bg);
      else if (boss.kind === 'giant') giant(boss, timeS, color, bg);
      else vortex(boss, timeS, color);
      const outer = boss.kind === 'giant' ? boss.radius * (1 + GIANT_SHAPE_JITTER) : boss.kind === 'hunter' ? boss.radius * HUNTER_NOSE : boss.radius;
      hpRing(boss, outer, base);
    },
  };
}
