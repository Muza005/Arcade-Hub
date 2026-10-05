// Частицы Space War: осколки камней, взрывы и искры множителя — одним ParticleContainer из атласа.
// Общий лимит зависит от качества (PARTICLES_MAX). Когда места нет, новая частица занимает место
// самой старой: эффекты у всех становятся короче, но ничей не пропадает целиком (SPACE_WAR_SPEC §5).
// Время — по шагам симуляции (на паузе замирают); случайность — своя, только для вида.
// Любая смена состава сразу помечает контейнер: иначе частица, рождённая во время hit-stop (шаги без
// update), рисовалась со старыми размером и кадром текстуры — пропадала или выглядела чужой.
import { Particle, ParticleContainer, type Texture } from 'pixi.js';
import type { Rng } from '../../engine/rng';

interface Live {
  p: Particle;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Осколок смотрит по скорости; искра — круглая. */
  aligned: boolean;
}

export interface BurstOptions {
  texture: Texture;
  color: string;
  count: number;
  speed: readonly [number, number];
  life: number;
  aligned?: boolean;
}

export interface Particles {
  readonly view: ParticleContainer;
  setLimit(max: number): void;
  burst(x: number, y: number, o: BurstOptions): void;
  update(dtS: number): void;
  clear(): void;
}

export function createParticles(rng: Rng, blend: 'add' | 'normal' = 'add'): Particles {
  const view = new ParticleContainer({
    dynamicProperties: { position: true, rotation: true, color: true, vertex: false, uvs: false },
  });
  view.blendMode = blend;
  const live: Live[] = [];
  const spare: Particle[] = [];
  let limit = 0;

  const kill = (i: number): void => {
    const last = live.length - 1;
    const item = live[i] as Live;
    spare.push(item.p);
    live[i] = live[last] as Live;
    live.pop();
    view.particleChildren[i] = view.particleChildren[last] as Particle;
    view.particleChildren.pop();
    view.update();
  };

  const oldest = (): number => {
    let best = 0;
    let bestK = -1;
    for (let i = 0; i < live.length; i++) {
      const k = (live[i] as Live).age / (live[i] as Live).life;
      if (k > bestK) {
        bestK = k;
        best = i;
      }
    }
    return best;
  };

  return {
    view,
    setLimit(max) {
      limit = max;
      while (live.length > limit) kill(oldest());
    },
    burst(x, y, o) {
      if (limit <= 0) return;
      for (let n = 0; n < o.count; n++) {
        if (live.length >= limit) kill(oldest());
        const p = spare.pop() ?? new Particle({ texture: o.texture, anchorX: 0.5, anchorY: 0.5 });
        const a = rng.next() * Math.PI * 2;
        const speed = o.speed[0] + rng.next() * (o.speed[1] - o.speed[0]);
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        p.texture = o.texture;
        p.x = x;
        p.y = y;
        p.rotation = o.aligned ? a : 0;
        p.tint = o.color;
        p.alpha = 1;
        live.push({ p, vx, vy, age: 0, life: o.life, aligned: o.aligned === true });
        view.particleChildren.push(p);
      }
      view.update();
    },
    update(dtS) {
      for (let i = live.length - 1; i >= 0; i--) {
        const item = live[i] as Live;
        item.age += dtS;
        if (item.age >= item.life) {
          kill(i);
          continue;
        }
        item.p.x += item.vx * dtS;
        item.p.y += item.vy * dtS;
        item.p.alpha = 1 - item.age / item.life;
      }
    },
    clear() {
      while (live.length > 0) kill(live.length - 1);
      view.update();
    },
  };
}
