import { describe, expect, it } from 'vitest';
import { createRng } from '../../engine/rng';
import { FIXED_STEP_HZ } from '../../shared/config';
import {
  AMMO_MAX,
  BOSS_OF_WAVE,
  BOSS_TARGET_MAX_S,
  FORTRESS_RINGS,
  HUNTER_SHOT_S,
  SCORE_BOSS,
  SWARM_DURATION_S,
  SWARM_WALLS,
  VORTEX_DURATION_S,
} from '../config';
import { createAsteroidField } from './asteroids';
import { bossHp, createBoss, type Prey } from './bosses';
import { createSim, fieldBounds } from './sim';
import { waveLengthS } from './waves';

const DT = 1 / FIXED_STEP_HZ;
const IDLE = { x: 0, y: 0, btn: false };
const bounds = fieldBounds(1920);
const setup = (kind: Parameters<typeof createBoss>[0], players = 1, prey: () => readonly Prey[] = () => []) => {
  const rng = createRng(5);
  const field = createAsteroidField(rng, bounds);
  return { field, ctl: createBoss(kind, rng, field, bounds, players, 1, prey) };
};

describe('боссы', () => {
  it('на своих волнах (4, 8, 11, 14, 17, 20); испытания — ровно своё время, цели — пока живы', () => {
    expect(BOSS_OF_WAVE).toEqual({ 4: 'seeder', 8: 'hunter', 11: 'swarm', 14: 'fortress', 17: 'giant', 20: 'vortex' });
    expect(waveLengthS(11)).toBe(SWARM_DURATION_S);
    expect(waveLengthS(20)).toBe(VORTEX_DURATION_S);
    for (const w of [4, 8, 14, 17]) expect(waveLengthS(w)).toBe(BOSS_TARGET_MAX_S);
  });

  it('прочность целей × (1 + 0.7·(N−1))', () => {
    expect(bossHp('seeder', 1)).toBe(25);
    expect(bossHp('giant', 1)).toBe(30);
    expect(bossHp('giant', 10)).toBe(Math.round(30 * 7.3));
    // На 10 игроках Гигант не падает за один залп: у всех вместе патронов вдвое меньше его прочности.
    expect(bossHp('giant', 10)).toBeGreaterThan(10 * AMMO_MAX * 2);
  });

  it('Сеятель вплывает на поле и выбрасывает камни; падает, когда прочность кончилась', () => {
    const { field, ctl } = setup('seeder');
    for (let i = 0; i < FIXED_STEP_HZ * 10; i++) {
      ctl.step(DT);
      field.step(DT);
    }
    expect(ctl.boss.pos.y).toBeGreaterThan(bounds.top);
    expect(field.list.length).toBeGreaterThan(0);
    let dead = false;
    for (let i = 0; i < ctl.boss.maxHp && !dead; i++) dead = ctl.hit(ctl.boss.pos);
    expect(dead).toBe(true);
  });

  it('от Гиганта при попадании откалывается живой кусок', () => {
    const { field, ctl } = setup('giant');
    const before = field.list.length;
    ctl.hit({ x: ctl.boss.pos.x + ctl.boss.radius, y: ctl.boss.pos.y });
    expect(field.list.length).toBe(before + 1);
    expect(field.list[field.list.length - 1]!.immortal).toBe(false);
  });

  it('Рой: 10 стен с проходом с разных сторон, сначала мигают у края; камни неуязвимы; потом уходят', () => {
    const { field, ctl } = setup('swarm');
    const seen = new Set<string>();
    let total = 0;
    let warned = false;
    for (let i = 0; i < FIXED_STEP_HZ * SWARM_DURATION_S; i++) {
      const before = ctl.boss.walls.length;
      ctl.step(DT);
      field.step(DT);
      for (const w of ctl.boss.walls) {
        seen.add(`${w.axis}${w.dir}`);
        if (w.warnS > 0) warned = true;
      }
      if (ctl.boss.walls.length > before) total += ctl.boss.walls.length - before;
      expect(field.list.every((a) => a.immortal && a.held)).toBe(true);
    }
    expect(total).toBe(SWARM_WALLS);
    expect(warned).toBe(true);
    // Первые три — снизу, слева, справа; дальше все четыре стороны в ходу.
    expect(seen.size).toBeGreaterThanOrEqual(3);
    ctl.release();
    for (let i = 0; i < FIXED_STEP_HZ * 20; i++) field.step(DT);
    expect(field.list.length).toBe(0);
  });

  it('Охотник гонится за ближайшим, бросает в него камни и расталкивает камни перед собой', () => {
    const near: Prey = { id: 'near', pos: { x: 900, y: 600 }, vel: { x: 0, y: 0 }, invulnerable: false };
    const far: Prey = { id: 'far', pos: { x: 1700, y: 900 }, vel: { x: 0, y: 0 }, invulnerable: false };
    const { field, ctl } = setup('hunter', 1, () => [near, far]);
    expect(ctl.target).toBe(true);
    let threw = false;
    for (let i = 0; i < FIXED_STEP_HZ * (HUNTER_SHOT_S + 3); i++) {
      ctl.step(DT);
      field.step(DT);
      threw ||= field.list.some((a) => a.size === 'small');
    }
    expect(ctl.boss.prey).toBe('near');
    expect(Math.hypot(ctl.boss.pos.x - near.pos.x, ctl.boss.pos.y - near.pos.y)).toBeLessThan(400);
    expect(threw).toBe(true);
    // Неуязвимого (только что ударенного) не преследует — переключается на другого.
    near.invulnerable = true;
    ctl.step(DT);
    expect(ctl.boss.prey).toBe('far');
    // Камень рядом отталкивается.
    const rock = field.launch('medium', ctl.boss.pos.x + ctl.boss.radius + 40, ctl.boss.pos.y, 0, 0)!;
    ctl.step(DT);
    expect(rock.vel.x).toBeGreaterThan(0);
  });

  it('Крепость: кольца брони с разрывами — неуязвимы, но в них целятся; ядро убито — броня разлетается', () => {
    const { field, ctl } = setup('fortress');
    const armor = field.list.filter((a) => a.armor);
    const expected = FORTRESS_RINGS.reduce((n, r) => n + r.slots - r.gap * r.gaps, 0);
    expect(armor.length).toBe(expected);
    expect(armor.every((a) => a.immortal && a.held)).toBe(true);
    for (let i = 0; i < FIXED_STEP_HZ * 6; i++) {
      ctl.step(DT);
      field.step(DT);
    }
    // Кольца на своих радиусах и крутятся навстречу.
    const [inner, outer] = ctl.boss.rings;
    expect(inner!.radius).toBeCloseTo(FORTRESS_RINGS[0].radius, 0);
    expect(outer!.radius).toBeCloseTo(FORTRESS_RINGS[1].radius, 0);
    const a0 = [inner!.angle, outer!.angle];
    ctl.step(DT);
    expect(Math.sign(inner!.angle - a0[0]!)).toBe(-Math.sign(outer!.angle - a0[1]!));
    let dead = false;
    for (let i = 0; i < ctl.boss.maxHp && !dead; i++) dead = ctl.hit(ctl.boss.pos);
    expect(dead).toBe(true);
    ctl.release();
    expect(field.list.some((a) => a.armor || a.held)).toBe(false);
  });

  it('с игроками кольца Крепости крутятся быстрее', () => {
    const spin = (players: number): number => {
      const { ctl } = setup('fortress', players);
      const before = ctl.boss.rings[0]!.angle;
      ctl.step(DT);
      return ctl.boss.rings[0]!.angle - before;
    };
    expect(spin(10)).toBeGreaterThan(spin(1));
  });

  it('Воронка неуязвима, тяга растёт с игроками', () => {
    const one = setup('vortex').ctl;
    expect(one.target).toBe(false);
    expect(one.hit(one.boss.pos)).toBe(false);
    expect(setup('vortex', 10).ctl.boss.shipPull).toBeGreaterThan(one.boss.shipPull);
  });
});

describe('боссы в матче', () => {
  it('цель убита — очки добившему и конец волны', () => {
    const sim = createSim(['p'], 1920, 9, undefined, { startWave: 4 });
    sim.step(DT, () => IDLE);
    expect(sim.boss?.kind).toBe('seeder');
    const pilot = sim.pilots.get('p')!;
    pilot.lives = 1000; // проверяем босса, а не выживание
    pilot.ammo = 1000;
    let down = false;
    let ended = false;
    let fire = false;
    for (let i = 0; i < FIXED_STEP_HZ * 90 && !ended; i++) {
      // Стреляем, как только Сеятель на поле: ближе камней он оказывается сам.
      fire = !fire;
      sim.step(DT, () => ({ x: 0, y: 0, btn: fire }));
      if (sim.events.bossDown.length > 0) {
        down = true;
        expect(sim.events.bossDown[0]!.by).toBe('p');
        expect(pilot.score).toBeGreaterThanOrEqual(SCORE_BOSS);
      }
      if (sim.events.waves.some((w) => w.kind === 'end')) ended = true;
    }
    expect(down).toBe(true);
    expect(ended).toBe(true);
    expect(sim.boss).toBeNull();
  });

  it('Воронка — финальная: после 30 с матч кончается', () => {
    const sim = createSim(['p'], 1920, 9, undefined, { startWave: 20 });
    sim.pilots.get('p')!.lives = 1000;
    for (let i = 0; i < FIXED_STEP_HZ * (VORTEX_DURATION_S + 5) && !sim.over; i++) sim.step(DT, () => IDLE);
    expect(sim.waves.phase).toBe('done');
    expect(sim.over).toBe(true);
  });
});
