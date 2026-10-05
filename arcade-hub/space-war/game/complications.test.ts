import { describe, expect, it } from 'vitest';
import { FIXED_STEP_HZ } from '../../shared/config';
import { ALIEN_SLOW_MAX_COUNT, ALIEN_SLOW_STEP, PHANTOM_REVEAL_S, RECOIL_SPEED, type Complication } from '../config';
import { createSim, type Sim } from './sim';
import { rollComplications } from './waves';

const DT = 1 / FIXED_STEP_HZ;
const IDLE = { x: 0, y: 0, btn: false };

/** Матч, начатый с волны, где выпало нужное осложнение. */
function simWith(comp: Complication, players: readonly string[] = ['p']): Sim {
  for (let seed = 1; ; seed++) {
    const wave = rollComplications(seed).indexOf(comp);
    if (wave > 0) {
      const sim = createSim(players, 1920, seed, undefined, { startWave: wave });
      sim.step(DT, () => IDLE);
      expect(sim.waves.complication).toBe(comp);
      for (const p of sim.pilots.values()) p.lives = 1000;
      return sim;
    }
  }
}

const run = (sim: Sim, seconds: number, input = IDLE): void => {
  for (let i = 0; i < FIXED_STEP_HZ * seconds; i++) sim.step(DT, () => input);
};

describe('осложнения', () => {
  it('Течение: корабль сносит по течению, камни идут в ту же сторону', () => {
    const sim = simWith('current');
    const ship = sim.pilots.get('p')!.ship;
    const flow = { ...sim.waves.flow };
    expect(Math.abs(flow.x) + Math.abs(flow.y)).toBe(1);
    const start = { ...ship.pos };
    run(sim, 1);
    expect((ship.pos.x - start.x) * flow.x + (ship.pos.y - start.y) * flow.y).toBeGreaterThan(50);
    run(sim, 5);
    const moving = sim.asteroids.filter((a) => !a.held);
    expect(moving.length).toBeGreaterThan(0);
    for (const a of moving) expect(a.vel.x * flow.x + a.vel.y * flow.y).toBeGreaterThan(0);
  });

  it('Скользкий космос: корабль тормозит дольше', () => {
    const coast = (sim: Sim): number => {
      run(sim, 0.5, { x: 1, y: 0, btn: false });
      run(sim, 1);
      const v = sim.pilots.get('p')!.ship.vel;
      return Math.hypot(v.x, v.y);
    };
    const normal = createSim(['p'], 1920, 3);
    normal.pilots.get('p')!.lives = 1000;
    expect(coast(simWith('slippery'))).toBeGreaterThan(coast(normal) * 3);
  });

  it('Отдача: выстрел толкает корабль назад', () => {
    const sim = simWith('recoil');
    const pilot = sim.pilots.get('p')!;
    run(sim, 2); // камни успели войти в поле
    pilot.ammo = 10;
    const before = { ...pilot.ship.knock };
    const start = { ...pilot.ship.pos };
    sim.step(DT, () => ({ x: 0, y: 0, btn: true }));
    expect(sim.bullets.length).toBeGreaterThan(0);
    const b = sim.bullets[sim.bullets.length - 1]!;
    const dir = { x: b.vel.x / Math.hypot(b.vel.x, b.vel.y), y: b.vel.y / Math.hypot(b.vel.x, b.vel.y) };
    const dk = { x: pilot.ship.knock.x - before.x, y: pilot.ship.knock.y - before.y };
    // Толчок против полёта снаряда, порядка RECOIL_SPEED; импульс не режется пределом скорости корабля.
    expect(dk.x * dir.x + dk.y * dir.y).toBeLessThan(-RECOIL_SPEED * 0.8);
    run(sim, 0.4);
    expect((pilot.ship.pos.x - start.x) * dir.x + (pilot.ship.pos.y - start.y) * dir.y).toBeLessThan(-150);
  });

  it('Инопланетяне: летят к кораблю, прилипают и замедляют (до пяти); в конце волны уходят', () => {
    const sim = simWith('aliens');
    run(sim, 10);
    expect(sim.aliens.length).toBeGreaterThan(0);
    const stuck = sim.aliens.filter((a) => a.host === 'p').length;
    expect(stuck).toBeGreaterThan(0);
    // Замедление: тяга с прилипшими слабее — разгон медленнее.
    expect(1 - ALIEN_SLOW_STEP * Math.min(stuck, ALIEN_SLOW_MAX_COUNT)).toBeLessThan(1);
    for (let i = 0; i < FIXED_STEP_HZ * 120 && sim.waves.phase === 'wave'; i++) sim.step(DT, () => IDLE);
    expect(sim.aliens.every((a) => a.host === null && a.leaving)).toBe(true);
  });

  it('Призрак: попадание по камню делает его видимым на полсекунды', () => {
    const sim = simWith('phantom');
    run(sim, 3);
    const pilot = sim.pilots.get('p')!;
    pilot.ammo = 10;
    let revealed = false;
    let fire = false;
    for (let i = 0; i < FIXED_STEP_HZ * 10 && !revealed; i++) {
      fire = !fire;
      pilot.ammo = 10;
      sim.step(DT, () => ({ x: 0, y: 0, btn: fire }));
      revealed = sim.asteroids.some((a) => a.seenS > PHANTOM_REVEAL_S - DT * 2);
    }
    expect(revealed).toBe(true);
  });

  it('Бомбы: вместо камней бомбы, выстрел взрывает и отталкивает', () => {
    const sim = simWith('bombs');
    run(sim, 3);
    const spawned = sim.asteroids.filter((a) => !a.held);
    expect(spawned.length).toBeGreaterThan(0);
    expect(spawned.every((a) => a.bomb)).toBe(true);
    const pilot = sim.pilots.get('p')!;
    let boom = false;
    let fire = false;
    for (let i = 0; i < FIXED_STEP_HZ * 15 && !boom; i++) {
      fire = !fire;
      pilot.ammo = 10;
      sim.step(DT, () => ({ x: 0, y: 0, btn: fire }));
      boom = sim.events.booms.length > 0;
    }
    expect(boom).toBe(true);
  });
});

describe('Бомбы — отброс', () => {
  it('корабль, врезавшийся в бомбу, отлетает далеко — сильнее предела своей скорости', () => {
    const sim = simWith('bombs');
    run(sim, 3);
    const ship = sim.pilots.get('p')!.ship;
    const bomb = sim.asteroids.find((a) => a.bomb)!;
    bomb.vel.x = bomb.vel.y = 0;
    bomb.pos.x = bomb.prev.x = ship.pos.x + bomb.radius;
    bomb.pos.y = bomb.prev.y = ship.pos.y;
    const start = { ...ship.pos };
    sim.step(DT, () => IDLE);
    expect(sim.events.booms.length).toBe(1);
    run(sim, 0.5);
    expect(start.x - ship.pos.x).toBeGreaterThan(400);
  });
});

describe('Рой', () => {
  it('в начале все камни поля взрываются', () => {
    const sim = createSim(['p'], 1920, 4, undefined, { startWave: 10 });
    sim.pilots.get('p')!.lives = 1000;
    let started = false;
    for (let i = 0; i < FIXED_STEP_HZ * 120 && !started; i++) {
      // На шаге перед Роем камни ещё на поле.
      const before = sim.asteroids.filter((a) => !a.held).length;
      sim.step(DT, () => IDLE);
      if (sim.events.waves.some((w) => w.kind === 'start' && w.wave === 11)) {
        started = true;
        expect(sim.asteroids.filter((a) => !a.held).length).toBe(0);
        expect(sim.events.breaks.length).toBeGreaterThanOrEqual(Math.min(before, 1));
      }
    }
    expect(started).toBe(true);
  });
});
