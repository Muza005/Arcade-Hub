import { describe, expect, it } from 'vitest';
import { createRng } from '../../engine/rng';
import { FIXED_STEP_HZ } from '../../shared/config';
import { AMMO_MAX, BOSS_TARGET_MAX_S, SCORE_BOSS, SWARM_DURATION_S, SWARM_ROCKS, VORTEX_DURATION_S } from '../config';
import { createAsteroidField } from './asteroids';
import { bossHp, createBoss } from './bosses';
import { createSim, fieldBounds } from './sim';
import { waveLengthS } from './waves';

const DT = 1 / FIXED_STEP_HZ;
const IDLE = { x: 0, y: 0, btn: false };
const bounds = fieldBounds(1920);
const setup = (kind: Parameters<typeof createBoss>[0], players = 1) => {
  const rng = createRng(5);
  const field = createAsteroidField(rng, bounds);
  return { field, ctl: createBoss(kind, rng, field, bounds, players, 1) };
};

describe('боссы', () => {
  it('на своих волнах; испытания — ровно своё время, цели — пока живы', () => {
    expect(waveLengthS(10)).toBe(SWARM_DURATION_S);
    expect(waveLengthS(20)).toBe(VORTEX_DURATION_S);
    expect(waveLengthS(5)).toBe(BOSS_TARGET_MAX_S);
    expect(waveLengthS(15)).toBe(BOSS_TARGET_MAX_S);
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

  it('Рой: камни неуязвимы и держатся всё испытание, потом уходят; с игроками их больше', () => {
    const { field, ctl } = setup('swarm');
    expect(field.list.length).toBe(SWARM_ROCKS);
    expect(field.list.every((a) => a.immortal && a.held)).toBe(true);
    for (let i = 0; i < FIXED_STEP_HZ * SWARM_DURATION_S; i++) {
      ctl.step(DT);
      field.step(DT);
    }
    expect(field.list.length).toBe(SWARM_ROCKS);
    ctl.release();
    for (let i = 0; i < FIXED_STEP_HZ * 20; i++) field.step(DT);
    expect(field.list.length).toBe(0);
    expect(setup('swarm', 10).field.list.length).toBeGreaterThan(SWARM_ROCKS);
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
    const sim = createSim(['p'], 1920, 9, undefined, { startWave: 5 });
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
