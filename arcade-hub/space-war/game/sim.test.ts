import { describe, expect, it } from 'vitest';
import { createRng } from '../../engine/rng';
import { FIXED_STEP_HZ } from '../../shared/config';
import { ASTEROID_RADIUS, GAME_OVER_DELAY_S, HIT_INVULN_S, SHIP_LIVES } from '../config';
import { createAsteroidField } from './asteroids';
import { createSim, fieldBounds } from './sim';

const DT = 1 / FIXED_STEP_HZ;
const IDLE = { x: 0, y: 0, btn: false };
const W = 1920;

describe('астероиды', () => {
  it('одинаковый сид — одинаковые камни', () => {
    const a = createSim(['p'], W, 42);
    const b = createSim(['p'], W, 42);
    for (let i = 0; i < 600; i++) {
      a.step(DT, () => IDLE);
      b.step(DT, () => IDLE);
    }
    const snap = (s: typeof a) => s.asteroids.map((r) => [r.id, r.size, r.pos.x, r.pos.y, r.hp]);
    expect(snap(a)).toEqual(snap(b));
    expect(a.asteroids.length).toBeGreaterThan(0);
    const c = createSim(['p'], W, 43);
    for (let i = 0; i < 600; i++) c.step(DT, () => IDLE);
    expect(snap(c)).not.toEqual(snap(a));
  });

  it('рождаются за краем и летят внутрь поля', () => {
    const bounds = fieldBounds(W);
    const field = createAsteroidField(createRng(1), bounds);
    for (let i = 0; i < 50; i++) {
      const a = field.spawn()!;
      const outside =
        a.pos.x < bounds.left || a.pos.x > bounds.right || a.pos.y < bounds.top || a.pos.y > bounds.bottom;
      expect(outside).toBe(true);
      const cx = (bounds.left + bounds.right) / 2 - a.pos.x;
      const cy = (bounds.top + bounds.bottom) / 2 - a.pos.y;
      expect(a.vel.x * cx + a.vel.y * cy).toBeGreaterThan(0);
    }
  });

  it('пролетают насквозь и уходят за границу', () => {
    const field = createAsteroidField(createRng(3), fieldBounds(W));
    field.spawn();
    const id = field.list[0]!.id;
    for (let i = 0; i < 60 * FIXED_STEP_HZ && field.list.some((a) => a.id === id); i++) field.step(DT);
    expect(field.list.some((a) => a.id === id)).toBe(false);
  });

  it('крупный → два средних → мелкие → осколки', () => {
    const field = createAsteroidField(createRng(5), fieldBounds(W));
    let rock = field.spawn()!;
    while (rock.size !== 'large') {
      field.remove(rock);
      rock = field.spawn()!;
    }
    const mediums = field.split(rock);
    expect(mediums.map((m) => m.size)).toEqual(['medium', 'medium']);
    for (const m of mediums) expect(m.hp === 4 || m.hp === 5).toBe(true);
    const smalls = field.split(mediums[0]!);
    expect(smalls.map((s) => s.size)).toEqual(['small', 'small']);
    expect(field.split(smalls[0]!)).toEqual([]);
    expect(field.list.map((a) => a.size).sort()).toEqual(['medium', 'small']);
  });
});

describe('жизни', () => {
  it('удар — минус жизнь и неуязвимость; пять ударов — конец игры', () => {
    const sim = createSim(['p'], W, 1);
    const pilot = sim.pilots.get('p')!;
    const ship = pilot.ship;
    let hits = 0;
    let steps = 0;
    // Подсовываем камень прямо в корабль, как только неуязвимость прошла.
    while (!sim.over && steps < 60 * FIXED_STEP_HZ) {
      if (pilot.alive && pilot.invulnS === 0 && sim.asteroids.length > 0) {
        const rock = sim.asteroids[0]!;
        rock.pos.x = ship.pos.x;
        rock.pos.y = ship.pos.y;
        rock.vel.x = rock.vel.y = 0;
      }
      sim.step(DT, () => IDLE);
      hits += sim.events.hits.length;
      if (sim.events.hits.length > 0 && pilot.alive) expect(pilot.invulnS).toBeCloseTo(HIT_INVULN_S, 5);
      steps++;
    }
    expect(hits).toBe(SHIP_LIVES);
    expect(pilot.alive).toBe(false);
    expect(sim.over).toBe(true);
    expect(sim.timeS - pilot.diedAtS!).toBeGreaterThanOrEqual(GAME_OVER_DELAY_S - DT);
  });

  it('неуязвимый корабль проходит сквозь камни', () => {
    const sim = createSim(['p'], W, 1);
    const pilot = sim.pilots.get('p')!;
    while (sim.asteroids.length === 0) sim.step(DT, () => IDLE);
    pilot.invulnS = 10;
    const rock = sim.asteroids[0]!;
    rock.pos.x = pilot.ship.pos.x;
    rock.pos.y = pilot.ship.pos.y;
    sim.step(DT, () => IDLE);
    expect(sim.events.hits).toHaveLength(0);
    expect(pilot.lives).toBe(SHIP_LIVES);
    expect(sim.asteroids.some((a) => a.radius === ASTEROID_RADIUS[a.size])).toBe(true);
  });
});
