// Пилот: жизни, патроны, множитель и очки одного игрока (SPACE_WAR_SPEC §5).
import {
  AMMO_BASE_S,
  AMMO_MAX,
  AMMO_MULT_K,
  AMMO_START,
  MULT_IDLE_RESET_S,
  MULT_MAX,
  MULT_STEPS,
  NEAR_MISS_COOLDOWN_S,
  SCORE_NEAR_MISS,
  SHIP_LIVES,
  type SabKind,
} from '../config';
import type { Ship } from './ship';

export type PilotPhase = 'alive' | 'ghost' | 'saboteur' | 'out';

export interface Pilot {
  readonly ship: Ship;
  lives: number;
  /** Неуязвимость после удара, с. */
  invulnS: number;
  /** Корабль в игре (phase === 'alive'). */
  alive: boolean;
  /** Жив; призрак (ждёт, пока соберут осколки); саботажник; выбыл. */
  phase: PilotPhase;
  /** Сколько ещё быть призраком, с. */
  ghostS: number;
  /** Кулдауны саботажника по снарядам, с. */
  readonly sabS: Record<SabKind, number>;
  /** Время гибели от начала матча — для итогов. */
  diedAtS: number | null;
  score: number;
  ammo: number;
  /** Накопление следующего патрона, 0…1. */
  ammoProgress: number;
  /** Ступень ×1…×5 и сближения к следующей. */
  mult: number;
  multProgress: number;
  /** Когда засчитано последнее сближение, с от начала матча. */
  lastNearS: number;
  /** Камни, за которые сближение уже засчитано: каждый — один раз. */
  readonly nearIds: Set<number>;
  prevBtn: boolean;
}

export function createPilot(ship: Ship): Pilot {
  return {
    ship,
    lives: SHIP_LIVES,
    invulnS: 0,
    alive: true,
    phase: 'alive',
    ghostS: 0,
    sabS: { rock: 0, bomb: 0 },
    diedAtS: null,
    score: 0,
    ammo: AMMO_START,
    ammoProgress: 0,
    mult: 1,
    multProgress: 0,
    lastNearS: 0,
    nearIds: new Set(),
    prevBtn: false,
  };
}

/** Секунд на патрон при множителе m: AMMO_BASE_S / (1 + AMMO_MULT_K · (m − 1)). */
export function ammoTimeS(mult: number): number {
  return AMMO_BASE_S / (1 + AMMO_MULT_K * (mult - 1));
}

/** Патроны копятся по таймеру, быстрее с множителем. Возвращает true, если патрон добавился. */
export function regenAmmo(p: Pilot, dtS: number): boolean {
  if (p.ammo >= AMMO_MAX) {
    p.ammoProgress = 0;
    return false;
  }
  p.ammoProgress += dtS / ammoTimeS(p.mult);
  if (p.ammoProgress < 1) return false;
  p.ammo++;
  p.ammoProgress = p.ammo >= AMMO_MAX ? 0 : p.ammoProgress - 1;
  return true;
}

/** Множитель сразу до ×1 (удар, таран, простой). */
export function resetMult(p: Pilot): void {
  p.mult = 1;
  p.multProgress = 0;
}

/** Попытка засчитать сближение с камнем. Очки — по текущей ступени; ступень растёт по MULT_STEPS. */
export function nearMiss(p: Pilot, rockId: number, nowS: number): boolean {
  if (p.nearIds.has(rockId)) return false;
  if (p.lastNearS > 0 && nowS - p.lastNearS < NEAR_MISS_COOLDOWN_S) return false;
  p.nearIds.add(rockId);
  p.lastNearS = nowS;
  p.score += SCORE_NEAR_MISS * p.mult;
  if (p.mult < MULT_MAX) {
    p.multProgress++;
    if (p.multProgress >= (MULT_STEPS[p.mult - 1] ?? Infinity)) {
      p.mult++;
      p.multProgress = 0;
    }
  }
  return true;
}

/** Перестал рисковать дольше MULT_IDLE_RESET_S — множитель обнуляется. */
export function checkIdle(p: Pilot, nowS: number): boolean {
  if (p.mult === 1 && p.multProgress === 0) return false;
  if (nowS - p.lastNearS < MULT_IDLE_RESET_S) return false;
  resetMult(p);
  return true;
}
