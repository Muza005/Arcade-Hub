// Рисунок боссов: Сеятель — вращающийся неоновый многогранник с ядром; Гигант — огромный камень,
// трещины растут с попаданиями; Воронка — тёмное ядро и закрученные рукава. Вокруг целей — кольцо прочности.
// Рой рисуется обычными камнями (другим оттенком) — здесь его нет.
import { Graphics } from 'pixi.js';
import type { Rng } from '../../engine/rng';
import {
  ASTEROID_COLOR,
  BOSS_COLOR,
  BOSS_HP_RING_GAP,
  BOSS_HP_RING_PX,
  BOSS_LINE_PX,
  CRACK_GLOW,
  GIANT_SHAPE_JITTER,
  GIANT_SHAPE_POINTS,
  VORTEX_ARM_TURNS,
  VORTEX_ARMS,
} from '../config';
import type { Boss } from '../game/bosses';

/** Сеятель — шестигранник, ядро пульсирует. */
const SEEDER_SIDES = 6;
const SEEDER_CORE_K = 0.4;
const PULSE_HZ = 1.5;
/** Рукава Воронки тянутся до стольких радиусов ядра. */
const VORTEX_REACH_K = 5;
const VORTEX_ARM_STEPS = 24;
const RING_ALPHA = 0.8;
const FILL_ALPHA = 0.85;

export interface BossView {
  readonly view: Graphics;
  draw(boss: Boss | null, x: number, y: number, timeS: number, bg: string): void;
}

export function createBossView(rng: Rng): BossView {
  const view = new Graphics();
  // Форма Гиганта: неровный многоугольник (по сиду эффектов — не влияет на матч).
  const giantShape = Array.from({ length: GIANT_SHAPE_POINTS }, () => 1 + rng.range(-GIANT_SHAPE_JITTER, GIANT_SHAPE_JITTER));
  const crackAngles = Array.from({ length: GIANT_SHAPE_POINTS }, () => rng.range(0, Math.PI * 2));

  /** Кольцо прочности — снаружи рисунка (outer — докуда рисунок доходит). */
  const hpRing = (boss: Boss, outer: number): void => {
    if (boss.maxHp <= 0) return;
    const r = outer + BOSS_HP_RING_GAP;
    const start = -Math.PI / 2;
    view
      .moveTo(Math.cos(start) * r, Math.sin(start) * r)
      .arc(0, 0, r, start, start + Math.PI * 2 * (boss.hp / boss.maxHp))
      .stroke({
      color: BOSS_COLOR,
      width: BOSS_HP_RING_PX,
      alpha: RING_ALPHA,
      cap: 'round',
    });
  };

  return {
    view,
    draw(boss, x, y, timeS, bg) {
      view.clear();
      view.visible = boss !== null && boss.kind !== 'swarm';
      if (!boss || !view.visible) return;
      view.position.set(x, y);
      const r = boss.radius;
      const a = boss.angle;
      if (boss.kind === 'seeder') {
        const pts: number[] = [];
        for (let i = 0; i < SEEDER_SIDES; i++) {
          const t = a + (i / SEEDER_SIDES) * Math.PI * 2;
          pts.push(Math.cos(t) * r, Math.sin(t) * r);
        }
        view.poly(pts).fill({ color: bg, alpha: FILL_ALPHA }).stroke({ color: BOSS_COLOR, width: BOSS_LINE_PX, join: 'round' });
        const pulse = 1 + 0.15 * Math.sin(timeS * PULSE_HZ * Math.PI * 2);
        view.circle(0, 0, r * SEEDER_CORE_K * pulse).fill({ color: BOSS_COLOR, alpha: 0.5 });
        hpRing(boss, r);
      } else if (boss.kind === 'giant') {
        const pts: number[] = [];
        giantShape.forEach((k, i) => {
          const t = a + (i / giantShape.length) * Math.PI * 2;
          pts.push(Math.cos(t) * r * k, Math.sin(t) * r * k);
        });
        view.poly(pts).fill({ color: bg, alpha: FILL_ALPHA }).stroke({ color: ASTEROID_COLOR, width: BOSS_LINE_PX, join: 'round' });
        // Трещины: чем меньше прочности, тем больше светящихся разломов от центра.
        const damage = boss.maxHp > 0 ? 1 - boss.hp / boss.maxHp : 0;
        const cracks = Math.ceil(damage * crackAngles.length);
        for (let i = 0; i < cracks; i++) {
          const t = a + (crackAngles[i] ?? 0);
          view.moveTo(Math.cos(t) * r * 0.15, Math.sin(t) * r * 0.15).lineTo(Math.cos(t + 0.2) * r * 0.6, Math.sin(t + 0.2) * r * 0.6).lineTo(Math.cos(t) * r * 0.9, Math.sin(t) * r * 0.9);
        }
        if (cracks > 0) view.stroke({ color: CRACK_GLOW, width: BOSS_LINE_PX / 2, alpha: 0.9 });
        hpRing(boss, r * (1 + GIANT_SHAPE_JITTER));
      } else {
        // Воронка: рукава-спирали от ядра наружу, к краю бледнеют.
        for (let arm = 0; arm < VORTEX_ARMS; arm++) {
          const base = a + (arm / VORTEX_ARMS) * Math.PI * 2;
          for (let s = 0; s < VORTEX_ARM_STEPS; s++) {
            const f0 = s / VORTEX_ARM_STEPS;
            const f1 = (s + 1) / VORTEX_ARM_STEPS;
            const p = (f: number): [number, number] => {
              const rr = r * (1 + f * (VORTEX_REACH_K - 1));
              const t = base - f * VORTEX_ARM_TURNS * Math.PI * 2;
              return [Math.cos(t) * rr, Math.sin(t) * rr];
            };
            const [x0, y0] = p(f0);
            const [x1, y1] = p(f1);
            view.moveTo(x0, y0).lineTo(x1, y1).stroke({ color: BOSS_COLOR, width: BOSS_LINE_PX, alpha: 0.7 * (1 - f0), cap: 'round' });
          }
        }
        view.circle(0, 0, r).fill({ color: bg }).stroke({ color: BOSS_COLOR, width: BOSS_LINE_PX });
      }
    },
  };
}
