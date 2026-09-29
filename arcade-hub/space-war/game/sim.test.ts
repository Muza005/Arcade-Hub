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

describe('стрельба', () => {
  const PRESS = { x: 0, y: 0, btn: true };

  it('Power попадает в ближайший камень, патрон тратится, за разбитый — очки', () => {
    const sim = createSim(['p'], W, 9);
    const pilot = sim.pilots.get('p')!;
    // Ставим один мелкий камень рядом и стреляем, пока не разобьём.
    while (sim.asteroids.length === 0) sim.step(DT, () => IDLE);
    const rock = sim.asteroids[0]!;
    rock.pos.x = pilot.ship.pos.x + 300;
    rock.pos.y = pilot.ship.pos.y;
    rock.vel.x = rock.vel.y = 0;
    rock.hp = 1;
    const ammo = pilot.ammo;
    sim.step(DT, () => PRESS);
    expect(pilot.ammo).toBe(ammo - 1);
    expect(sim.bullets).toHaveLength(1);
    // Удерживание кнопки — не очередь: второй выстрел только по новому нажатию.
    for (let i = 0; i < FIXED_STEP_HZ / 2; i++) sim.step(DT, () => PRESS);
    expect(pilot.ammo).toBe(ammo - 1);
    expect(sim.asteroids.some((a) => a.id === rock.id)).toBe(false);
    expect(pilot.score).toBeGreaterThan(0);
  });

  it('патроны не бесконечны', () => {
    const sim = createSim(['p'], W, 9);
    const pilot = sim.pilots.get('p')!;
    let shots = 0;
    for (let i = 0; i < 10 * FIXED_STEP_HZ; i++) {
      sim.step(DT, () => ({ x: 0, y: 0, btn: i % 2 === 0 }));
      shots += sim.events.shots.length;
      if (!pilot.alive) break;
    }
    // За 10 с: стартовые 10 и не больше ~4 накопленных.
    expect(shots).toBeLessThanOrEqual(14);
  });
});

describe('столкновения кораблей', () => {
  /** Два корабля летят навстречу; у обоих ×3. */
  function headOn(options: Parameters<typeof createSim>[4]) {
    const sim = createSim(['a', 'b'], W, 1, undefined, options);
    const a = sim.pilots.get('a')!;
    const b = sim.pilots.get('b')!;
    a.ship.pos.x = 800;
    b.ship.pos.x = 1000;
    a.ship.pos.y = b.ship.pos.y = 540;
    a.mult = b.mult = 3;
    a.nearIds.add(-1);
    b.nearIds.add(-1);
    a.lastNearS = b.lastNearS = 1e9; // простой не мешает
    let bumps = 0;
    let rams = 0;
    for (let i = 0; i < FIXED_STEP_HZ; i++) {
      sim.step(DT, (id) => ({ x: id === 'a' ? 1 : -1, y: 0, btn: false }));
      bumps += sim.events.bumps.length;
      rams += sim.events.bumps.filter((e) => e.ram).length;
    }
    return { a, b, bumps, rams };
  }

  it('соревнование: отталкиваются, таран сбрасывает множитель обоим — один раз за касание', () => {
    const { a, b, bumps, rams } = headOn({ mode: 'versus' });
    expect(bumps).toBeGreaterThanOrEqual(1);
    expect(rams).toBe(bumps);
    expect(a.mult).toBe(1);
    expect(b.mult).toBe(1);
    expect(b.ship.pos.x - a.ship.pos.x).toBeGreaterThanOrEqual(0);
  });

  it('кооператив: толкаются, но множитель цел', () => {
    const { a, b, bumps, rams } = headOn({ mode: 'coop' });
    expect(bumps).toBeGreaterThanOrEqual(1);
    expect(rams).toBe(0);
    expect(a.mult).toBe(3);
    expect(b.mult).toBe(3);
  });

  it('командное: своих не таранят, чужих — да', () => {
    expect(headOn({ mode: 'teams', teamOf: () => 'red' }).rams).toBe(0);
    expect(headOn({ mode: 'teams', teamOf: (id) => (id === 'a' ? 'red' : 'blue') }).rams).toBeGreaterThan(0);
  });

  it('столкновения выключены — проходят насквозь', () => {
    const { a, b, bumps } = headOn({ mode: 'versus', collisions: false });
    expect(bumps).toBe(0);
    expect(a.ship.pos.x).toBeGreaterThan(b.ship.pos.x);
  });
});
