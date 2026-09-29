// Корабль (SPACE_WAR_SPEC §5 «Поле и корабль»): масса, тяга, сопротивление, предел скорости.
// Границы жёсткие: у стены гасится только скорость в стену — без отскока, и от стены можно сразу отлететь.
import type { InputState } from '../../engine/input';
import {
  SHIP_DRAG,
  SHIP_FACE_MIN_SPEED,
  SHIP_WALL_MARGIN,
  SHIP_MAX_SPEED,
  SHIP_THRUST,
  SHIP_TURN_RATE,
} from '../config';

export interface Vec {
  x: number;
  y: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Ship {
  id: string;
  pos: Vec;
  /** Позиция на прошлом шаге — для интерполяции при отрисовке. */
  prev: Vec;
  vel: Vec;
  /** Куда смотрит нос, радианы (0 — вправо). */
  angle: number;
  prevAngle: number;
  /** Тяга на этом шаге, 0…1 — для язычка пламени. */
  thrust: number;
}

export function createShip(id: string, pos: Vec, angle: number): Ship {
  return { id, pos: { ...pos }, prev: { ...pos }, vel: { x: 0, y: 0 }, angle, prevAngle: angle, thrust: 0 };
}

/** Кратчайшая разница углов в (−π, π]. */
export function angleDelta(from: number, to: number): number {
  const full = Math.PI * 2;
  let d = (to - from) % full;
  if (d > Math.PI) d -= full;
  if (d <= -Math.PI) d += full;
  return d;
}

/** Удержать корабль в поле (после толчка другим кораблём). */
export function clampToBounds(ship: Ship, bounds: Bounds): void {
  const r = SHIP_WALL_MARGIN;
  ship.pos.x = Math.min(Math.max(ship.pos.x, bounds.left + r), bounds.right - r);
  ship.pos.y = Math.min(Math.max(ship.pos.y, bounds.top + r), bounds.bottom - r);
}

export function stepShip(ship: Ship, input: InputState, dtS: number, bounds: Bounds): void {
  ship.prev.x = ship.pos.x;
  ship.prev.y = ship.pos.y;
  ship.prevAngle = ship.angle;

  // Тяга: ввод длиннее 1 (диагональ клавиатуры) приводим к 1.
  const len = Math.hypot(input.x, input.y);
  const k = len > 1 ? 1 / len : 1;
  const ax = input.x * k * SHIP_THRUST;
  const ay = input.y * k * SHIP_THRUST;
  ship.thrust = Math.min(1, len);

  ship.vel.x += ax * dtS;
  ship.vel.y += ay * dtS;
  // Сопротивление: без тяги скорость плавно гаснет.
  const drag = Math.exp(-SHIP_DRAG * dtS);
  ship.vel.x *= drag;
  ship.vel.y *= drag;
  const speed = Math.hypot(ship.vel.x, ship.vel.y);
  if (speed > SHIP_MAX_SPEED) {
    ship.vel.x *= SHIP_MAX_SPEED / speed;
    ship.vel.y *= SHIP_MAX_SPEED / speed;
  }

  ship.pos.x += ship.vel.x * dtS;
  ship.pos.y += ship.vel.y * dtS;

  const r = SHIP_WALL_MARGIN;
  if (ship.pos.x < bounds.left + r) {
    ship.pos.x = bounds.left + r;
    ship.vel.x = Math.max(0, ship.vel.x);
  } else if (ship.pos.x > bounds.right - r) {
    ship.pos.x = bounds.right - r;
    ship.vel.x = Math.min(0, ship.vel.x);
  }
  if (ship.pos.y < bounds.top + r) {
    ship.pos.y = bounds.top + r;
    ship.vel.y = Math.max(0, ship.vel.y);
  } else if (ship.pos.y > bounds.bottom - r) {
    ship.pos.y = bounds.bottom - r;
    ship.vel.y = Math.min(0, ship.vel.y);
  }

  // Нос — по направлению полёта, с ограниченной скоростью поворота.
  const moving = Math.hypot(ship.vel.x, ship.vel.y);
  if (moving >= SHIP_FACE_MIN_SPEED) {
    const d = angleDelta(ship.angle, Math.atan2(ship.vel.y, ship.vel.x));
    const max = SHIP_TURN_RATE * dtS;
    ship.angle += Math.max(-max, Math.min(max, d));
  }
}
