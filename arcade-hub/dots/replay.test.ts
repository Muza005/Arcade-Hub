import { describe, expect, it } from 'vitest';
import { createSim } from './sim';
import { createInputPlayback, createInputRecorder } from '../engine/replay';
import { createRng } from '../engine/rng';

const STEP = 1 / 60;

describe('запись матча', () => {
  it('сид + записанный ввод воспроизводят матч один в один', () => {
    const players = ['a', 'b'];
    const rng = createRng(99);
    // «Живой» ввод: неокруглённые оси, меняются не каждый тик
    const live = new Map(players.map((id) => [id, { x: 0, y: 0, btn: false }]));
    const recorder = createInputRecorder(players, (id) => live.get(id)!);

    const sim = createSim(players, 7, { durationS: 5, dashEnabled: true });
    let tick = 0;
    while (!sim.over) {
      if (tick % 7 === 0) for (const id of players) live.set(id, { x: rng.range(-1, 1), y: rng.range(-1, 1), btn: rng.next() < 0.1 });
      recorder.setTick(tick);
      sim.step(STEP, (id) => recorder.read(id));
      tick++;
    }

    const again = createSim(players, 7, { durationS: 5, dashEnabled: true });
    const playback = createInputPlayback(players, recorder.events);
    tick = 0;
    while (!again.over) {
      playback.advance(tick);
      again.step(STEP, (id) => playback.read(id));
      tick++;
    }
    expect(again.dots.map((d) => [d.score, d.pos.x, d.pos.y])).toEqual(sim.dots.map((d) => [d.score, d.pos.x, d.pos.y]));
    expect(recorder.events.length).toBeLessThan(tick * players.length); // пишутся только изменения
  });
});
