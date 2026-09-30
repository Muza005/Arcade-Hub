// «Хвост» матча для замедленного повтора в итогах (SPACE_WAR_SPEC §11): копии состояния последних шагов.
// Копия устроена как Sim (только для чтения): отрисовка берёт её вместо живой симуляции без изменений.
import type { Sim, SimEvents } from './sim';

const vec = (v: { x: number; y: number }): { x: number; y: number } => ({ x: v.x, y: v.y });
const noop = (): void => undefined;

/** События, нужные повтору для частиц и тряски; остальные — пустые. */
function copyEvents(e: SimEvents): SimEvents {
  return {
    hits: [...e.hits],
    deaths: [...e.deaths],
    breaks: e.breaks.map((b) => ({ ...b })),
    chips: e.chips.map((c) => ({ ...c })),
    shots: [],
    near: e.near.map((n) => ({ ...n })),
    reloads: [],
    bumps: e.bumps.map((b) => ({ ...b })),
    waves: [],
    bossDown: e.bossDown.map((b) => ({ ...b })),
    ghosts: [],
    revives: e.revives.map((r) => ({ ...r })),
    saboteurs: [],
    blasts: e.blasts.map((b) => ({ ...b })),
    sabShots: [],
    pickups: e.pickups.map((p) => ({ ...p })),
    jammed: [],
  };
}

/** Снимок шага: всё, что рисуется, скопировано; шаг и выстрелы — пустышки. */
export function snapshot(sim: Sim): Sim {
  const ships = sim.ships.map((s) => ({ ...s, pos: vec(s.pos), prev: vec(s.prev), vel: vec(s.vel) }));
  const shipOf = new Map(ships.map((s) => [s.id, s]));
  const pilots = new Map(
    [...sim.pilots].map(([id, p]) => [id, { ...p, ship: shipOf.get(id) ?? p.ship, sabS: { ...p.sabS }, stats: { ...p.stats } }]),
  );
  const boss = sim.boss ? { ...sim.boss, pos: vec(sim.boss.pos), prev: vec(sim.boss.prev), vel: vec(sim.boss.vel) } : null;
  const waves = {
    wave: sim.waves.wave,
    phase: sim.waves.phase,
    leftS: sim.waves.leftS,
    complication: sim.waves.complication,
    boss: sim.waves.boss,
    finishWave: noop,
    step: () => null,
  };
  const scores = new Map([...sim.pilots.keys()].map((id) => [id, sim.finalScore(id)]));
  return {
    bounds: sim.bounds,
    ships,
    pilots,
    asteroids: sim.asteroids.map((a) => ({ ...a, pos: vec(a.pos), prev: vec(a.prev), vel: vec(a.vel) })),
    bullets: sim.bullets.map((b) => ({ ...b, pos: vec(b.pos), prev: vec(b.prev), vel: vec(b.vel) })),
    waves,
    boss,
    shards: sim.shards.map((s) => ({ ...s, pos: vec(s.pos), prev: vec(s.prev), vel: vec(s.vel) })),
    bombs: sim.bombs.map((b) => ({ ...b, pos: vec(b.pos), prev: vec(b.prev), vel: vec(b.vel) })),
    powerups: sim.powerups.map((p) => ({ ...p, pos: vec(p.pos) })),
    freezeS: sim.freezeS,
    sabotage: () => false,
    sabCooldownS: () => 0,
    events: copyEvents(sim.events),
    timeS: sim.timeS,
    over: sim.over,
    frozen: false,
    step: noop,
    finalScore: (id) => scores.get(id) ?? 0,
  };
}
