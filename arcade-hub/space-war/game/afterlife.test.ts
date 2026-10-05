import { describe, expect, it } from 'vitest';
import { createRng } from '../../engine/rng';
import { FIXED_STEP_HZ } from '../../shared/config';
import { REVIVE_SHARDS, SAB_COOLDOWN_S, SAB_DEAD_EXTRA_S, SAB_ROCK_HP, SCORE_REVIVE, type Mode } from '../config';
import { createAfterlife, type AfterlifeEvents } from './afterlife';
import { createAsteroidField } from './asteroids';
import { createPilot, type Pilot } from './pilot';
import { createShip } from './ship';
import { fieldBounds } from './sim';

const DT = 1 / FIXED_STEP_HZ;
const IDLE = { x: 0, y: 0, btn: false };
const bounds = fieldBounds(1920);

function setup(mode: Mode, opts: { sabotage?: boolean; teams?: Record<string, string> } = {}) {
  const rng = createRng(3);
  const field = createAsteroidField(rng, bounds);
  const pilots = new Map<string, Pilot>(
    ['a', 'b', 'c'].map((id, i) => [id, createPilot(createShip(id, { x: 400 + i * 400, y: 500 }, 0))]),
  );
  const events: AfterlifeEvents = { ghosts: [], revives: [], saboteurs: [], blasts: [], sabShots: [] };
  const life = createAfterlife({
    pilots,
    bounds,
    field,
    rng,
    mode,
    teamOf: (id) => opts.teams?.[id] ?? id,
    ghostS: 15,
    sabotage: opts.sabotage ?? true,
    events,
    speedK: () => 1,
  });
  return { life, pilots, field, events };
}

describe('гибель и саботаж', () => {
  it('соревнование: погибший сразу саботажник; камень с прочностью 4–5, кулдаун + за погибших', () => {
    const { life, pilots, field } = setup('versus');
    const a = pilots.get('a')!;
    life.die(a);
    expect(a.phase).toBe('saboteur');
    expect(life.shards).toHaveLength(0);
    expect(life.sabotage('a', { kind: 'rock', x: 0, y: 0.5, dx: 1, dy: 0, step: 2 })).toBe(true);
    const rock = field.list.at(-1)!;
    expect(rock.owner).toBe('a');
    expect(rock.hp).toBeGreaterThanOrEqual(SAB_ROCK_HP[0]);
    expect(rock.hp).toBeLessThanOrEqual(SAB_ROCK_HP[1]);
    expect(a.sabS.rock).toBe(SAB_COOLDOWN_S.rock + SAB_DEAD_EXTRA_S * 1);
    expect(life.sabotage('a', { kind: 'rock', x: 0, y: 0.5, dx: 1, dy: 0, step: 2 })).toBe(false);
    // Живой не саботирует.
    expect(life.sabotage('b', { kind: 'bomb', x: 0, y: 0.5, dx: 1, dy: 0, step: 2 })).toBe(false);
  });

  it('саботаж выключен — выбывает', () => {
    const { life, pilots } = setup('versus', { sabotage: false });
    life.die(pilots.get('a')!);
    expect(pilots.get('a')!.phase).toBe('out');
  });

  it('кооператив: призрак и 3 осколка; союзник собирает — возвращение с 1 жизнью и очки за воскрешение', () => {
    const { life, pilots, events } = setup('coop');
    const a = pilots.get('a')!;
    const b = pilots.get('b')!;
    life.die(a);
    expect(a.phase).toBe('ghost');
    expect(life.shards).toHaveLength(REVIVE_SHARDS);
    for (let i = 0; i < FIXED_STEP_HZ; i++) life.step(DT);
    // Союзник пролетает по каждому осколку.
    while (life.shards.length > 0) {
      const s = life.shards[0]!;
      b.ship.pos.x = s.pos.x;
      b.ship.pos.y = s.pos.y;
      life.step(DT);
    }
    expect(a.phase).toBe('alive');
    expect(a.alive).toBe(true);
    expect(a.lives).toBe(1);
    expect(a.invulnS).toBeGreaterThan(0);
    expect(b.score).toBe(SCORE_REVIVE);
    expect(events.revives[0]).toMatchObject({ id: 'a', by: 'b' });
  });

  it('командное: чужой отталкивает осколок, не собирает; время вышло — саботажник', () => {
    const { life, pilots } = setup('teams', { teams: { a: 'red', b: 'blue', c: 'red' } });
    const a = pilots.get('a')!;
    const enemy = pilots.get('b')!;
    life.die(a);
    for (let i = 0; i < FIXED_STEP_HZ * 2; i++) life.step(DT);
    const s = life.shards[0]!;
    const before = { ...s.pos };
    enemy.ship.pos.x = s.pos.x + 5;
    enemy.ship.pos.y = s.pos.y;
    life.step(DT);
    expect(life.shards).toHaveLength(REVIVE_SHARDS);
    expect(s.vel.x).toBeLessThan(0);
    expect(s.pos).not.toEqual(before);
    for (let i = 0; i < FIXED_STEP_HZ * 15; i++) life.step(DT);
    expect(a.phase).toBe('saboteur');
    expect(life.shards).toHaveLength(0);
  });

  it('бомба взрывается о корабль и отбрасывает его, жизней не отнимает', () => {
    const { life, pilots } = setup('versus');
    life.die(pilots.get('a')!);
    const b = pilots.get('b')!;
    const lives = b.lives;
    const y = (b.ship.pos.y - bounds.top) / (bounds.bottom - bounds.top);
    life.sabotage('a', { kind: 'bomb', x: 0, y, dx: 1, dy: 0, step: 4 });
    let blasted = false;
    for (let i = 0; i < FIXED_STEP_HZ * 5 && !blasted; i++) {
      life.step(DT);
      blasted = life.bombs.length === 0;
    }
    expect(blasted).toBe(true);
    expect(Math.hypot(b.ship.vel.x, b.ship.vel.y)).toBeGreaterThan(0);
    expect(b.lives).toBe(lives);
  });

  it('призрак двигается по вводу', () => {
    const { life, pilots } = setup('coop');
    const a = pilots.get('a')!;
    life.die(a);
    const x = a.ship.pos.x;
    for (let i = 0; i < 30; i++) life.moveGhosts(DT, () => ({ ...IDLE, x: 1 }));
    expect(a.ship.pos.x).toBeGreaterThan(x);
  });
});
