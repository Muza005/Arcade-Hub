import { describe, expect, it } from 'vitest';
import { FIXED_STEP_HZ } from '../../shared/config';
import { SHIP_MAX_SPEED, SHIP_WALL_MARGIN as SHIP_HITBOX_RADIUS } from '../config';
import { createShip, stepShip, type Bounds } from './ship';
import { createSim } from './sim';

const DT = 1 / FIXED_STEP_HZ;
const BOUNDS: Bounds = { left: 0, top: 0, right: 2000, bottom: 1000 };
const RIGHT = { x: 1, y: 0, btn: false };
const LEFT = { x: -1, y: 0, btn: false };
const IDLE = { x: 0, y: 0, btn: false };
const run = (seconds: number, fn: () => void): void => {
  for (let i = 0; i < seconds * FIXED_STEP_HZ; i++) fn();
};

describe('корабль', () => {
  it('разгоняется плавно и не быстрее предела', () => {
    const ship = createShip('a', { x: 200, y: 500 }, 0);
    stepShip(ship, RIGHT, DT, BOUNDS);
    expect(ship.vel.x).toBeGreaterThan(0);
    expect(ship.vel.x).toBeLessThan(SHIP_MAX_SPEED / 4); // без телепорта
    run(3, () => stepShip(ship, RIGHT, DT, { ...BOUNDS, right: 1e6 }));
    expect(Math.hypot(ship.vel.x, ship.vel.y)).toBeLessThanOrEqual(SHIP_MAX_SPEED + 1e-9);
    expect(ship.vel.x).toBeGreaterThan(SHIP_MAX_SPEED * 0.95);
  });

  it('диагональ клавиатуры не быстрее прямой', () => {
    const straight = createShip('a', { x: 500, y: 500 }, 0);
    const diag = createShip('b', { x: 500, y: 500 }, 0);
    stepShip(straight, RIGHT, DT, BOUNDS);
    stepShip(diag, { x: 1, y: 1, btn: false }, DT, BOUNDS);
    expect(Math.hypot(diag.vel.x, diag.vel.y)).toBeCloseTo(straight.vel.x, 6);
  });

  it('отпустил — плавно тормозит до остановки', () => {
    const ship = createShip('a', { x: 200, y: 500 }, 0);
    run(1, () => stepShip(ship, RIGHT, DT, BOUNDS));
    const cruising = ship.vel.x;
    stepShip(ship, IDLE, DT, BOUNDS);
    expect(ship.vel.x).toBeGreaterThan(cruising * 0.9); // не встаёт как вкопанный
    run(2, () => stepShip(ship, IDLE, DT, BOUNDS));
    expect(Math.abs(ship.vel.x)).toBeLessThan(cruising * 0.01);
  });

  it('упирается в стену без отскока и сразу отлетает от неё', () => {
    const ship = createShip('a', { x: 1900, y: 500 }, 0);
    run(2, () => stepShip(ship, RIGHT, DT, BOUNDS));
    expect(ship.pos.x).toBe(BOUNDS.right - SHIP_HITBOX_RADIUS);
    expect(ship.vel.x).toBe(0);
    stepShip(ship, LEFT, DT, BOUNDS);
    expect(ship.vel.x).toBeLessThan(0);
    expect(ship.pos.x).toBeLessThan(BOUNDS.right - SHIP_HITBOX_RADIUS);
  });

  it('скользит вдоль стены, не залипая', () => {
    const ship = createShip('a', { x: 1000, y: 30 }, 0);
    run(1, () => stepShip(ship, { x: 1, y: -1, btn: false }, DT, BOUNDS));
    expect(ship.pos.y).toBe(BOUNDS.top + SHIP_HITBOX_RADIUS);
    expect(ship.vel.x).toBeGreaterThan(0);
  });

  it('нос поворачивается по направлению полёта', () => {
    const ship = createShip('a', { x: 1000, y: 500 }, 0);
    run(1, () => stepShip(ship, { x: 0, y: 1, btn: false }, DT, BOUNDS));
    expect(ship.angle).toBeCloseTo(Math.PI / 2, 2);
  });

  it('одинаковый ввод — одинаковый результат', () => {
    const a = createSim(['p1', 'p2'], 1920);
    const b = createSim(['p1', 'p2'], 1920);
    const input = (tick: number) => ({ x: Math.sin(tick / 7), y: Math.cos(tick / 11), btn: false });
    for (let t = 0; t < 600; t++) {
      a.step(DT, () => input(t));
      b.step(DT, () => input(t));
    }
    expect(a.ships.map((s) => s.pos)).toEqual(b.ships.map((s) => s.pos));
  });
});
