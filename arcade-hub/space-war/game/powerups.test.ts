import { describe, expect, it } from 'vitest';
import { createRng } from '../../engine/rng';
import { FIXED_STEP_HZ } from '../../shared/config';
import { AMMO_MAX, OVERLOAD_FACTOR, POWERUP_LIFETIME_S, POWERUPS_OF_MODE, SHIP_LIVES, type Mode, type PowerupKind } from '../config';
import { resetMult, totalMult } from './pilot';
import { createPowerups, type Powerup } from './powerups';
import { createSim } from './sim';

const DT = 1 / FIXED_STEP_HZ;
const IDLE = { x: 0, y: 0, btn: false };

/** Кладёт усиление прямо под корабль игрока и делает шаг. */
function pick(mode: Mode, ids: string[], who: string, kind: PowerupKind, teams?: Record<string, string>) {
  const sim = createSim(ids, 1920, 11, undefined, { mode, ...(teams ? { teamOf: (id: string) => teams[id] ?? id } : {}) });
  const pilot = sim.pilots.get(who)!;
  (sim.powerups as Powerup[]).push({ id: 999, kind, pos: { ...pilot.ship.pos }, leftS: POWERUP_LIFETIME_S });
  sim.step(DT, () => IDLE); // событие начала волны
  sim.step(DT, () => IDLE);
  return sim;
}

describe('усиления', () => {
  it('по 5 на режим: кооперативу — Заморозка и Расчистка, остальным — Перегрузка и Глушилка', () => {
    expect(POWERUPS_OF_MODE.coop).toHaveLength(5);
    expect(POWERUPS_OF_MODE.coop).toContain('freeze');
    expect(POWERUPS_OF_MODE.coop).not.toContain('overload');
    expect(POWERUPS_OF_MODE.versus).toContain('jammer');
    expect(POWERUPS_OF_MODE.teams).not.toContain('clear');
  });

  it('лежит на поле 10 с', () => {
    const ups = createPowerups(createRng(1), 'versus');
    ups.drop(100, 100);
    for (let i = 0; i < FIXED_STEP_HZ * (POWERUP_LIFETIME_S - 1); i++) ups.step(DT);
    expect(ups.list).toHaveLength(1);
    for (let i = 0; i < FIXED_STEP_HZ * 2; i++) ups.step(DT);
    expect(ups.list).toHaveLength(0);
  });

  it('подбор пролётом; полный боезапас и щит', () => {
    const sim = pick('versus', ['a', 'b'], 'a', 'ammo');
    expect(sim.powerups).toHaveLength(0);
    expect(sim.pilots.get('a')!.ammo).toBe(AMMO_MAX);
    expect(pick('versus', ['a'], 'a', 'shield').pilots.get('a')!.shieldS).toBeGreaterThan(0);
  });

  it('Ремонт в кооперативе — тому из своих, у кого жизней меньше; не больше максимума', () => {
    const sim = createSim(['a', 'b'], 1920, 11, undefined, { mode: 'coop' });
    const a = sim.pilots.get('a')!;
    const b = sim.pilots.get('b')!;
    b.lives = 2;
    (sim.powerups as Powerup[]).push({ id: 1, kind: 'repair', pos: { ...a.ship.pos }, leftS: 10 });
    sim.step(DT, () => IDLE);
    sim.step(DT, () => IDLE);
    expect(b.lives).toBe(3);
    expect(a.lives).toBe(SHIP_LIVES);
  });

  it('Перегрузка: итоговый множитель ×2, удар её не сжигает', () => {
    const sim = pick('versus', ['a'], 'a', 'overload');
    const a = sim.pilots.get('a')!;
    a.mult = 3;
    expect(totalMult(a)).toBe(3 * OVERLOAD_FACTOR);
    resetMult(a);
    expect(totalMult(a)).toBe(OVERLOAD_FACTOR);
  });

  it('Глушилка: три ближайших соперника не стреляют, свои — да', () => {
    const teams = { a: 'r', b: 'b', c: 'b', d: 'b', e: 'b', f: 'r' };
    const sim = pick('teams', Object.keys(teams), 'a', 'jammer', teams);
    const jammed = [...sim.pilots.values()].filter((p) => p.jamS > 0).map((p) => p.ship.id);
    expect(jammed).toHaveLength(3);
    expect(jammed).not.toContain('f');
    expect(jammed).not.toContain('a');
  });

  it('Заморозка останавливает камни', () => {
    const sim = createSim(['a'], 1920, 11, undefined, { mode: 'coop' });
    for (let i = 0; i < FIXED_STEP_HZ * 6; i++) sim.step(DT, () => IDLE);
    const a = sim.pilots.get('a')!;
    (sim.powerups as Powerup[]).push({ id: 1, kind: 'freeze', pos: { ...a.ship.pos }, leftS: 10 });
    sim.step(DT, () => IDLE);
    const before = sim.asteroids.map((r) => [r.id, r.pos.x, r.pos.y]);
    sim.step(DT, () => IDLE);
    expect(sim.freezeS).toBeGreaterThan(0);
    expect(sim.asteroids.filter((r) => before.some((b) => b[0] === r.id)).map((r) => [r.id, r.pos.x, r.pos.y])).toEqual(
      before.filter((b) => sim.asteroids.some((r) => r.id === b[0])),
    );
  });
});
