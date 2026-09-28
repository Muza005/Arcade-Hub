// Осколки: короткие чёрточки разлетаются и гаснут. Только вид — урона не наносят (SPACE_WAR_SPEC §5).
// Живут по шагам симуляции: на паузе замирают вместе с игрой.
import { Graphics } from 'pixi.js';
import { DEBRIS_LEN, DEBRIS_LINE_PX, DEBRIS_MAX, DEBRIS_S, DEBRIS_SPEED } from '../config';

interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  color: string;
}

export interface Debris {
  readonly view: Graphics;
  burst(x: number, y: number, count: number, color: string, next: () => number): void;
  update(dtS: number): void;
  draw(): void;
  clear(): void;
}

export function createDebris(): Debris {
  const view = new Graphics();
  const shards: Shard[] = [];
  return {
    view,
    burst(x, y, count, color, next) {
      for (let i = 0; i < count && shards.length < DEBRIS_MAX; i++) {
        const a = next() * Math.PI * 2;
        const speed = DEBRIS_SPEED[0] + next() * (DEBRIS_SPEED[1] - DEBRIS_SPEED[0]);
        shards.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, age: 0, color });
      }
    },
    update(dtS) {
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i] as Shard;
        s.age += dtS;
        if (s.age >= DEBRIS_S) {
          shards[i] = shards[shards.length - 1] as Shard;
          shards.pop();
          continue;
        }
        s.x += s.vx * dtS;
        s.y += s.vy * dtS;
      }
    },
    draw() {
      view.clear();
      for (const s of shards) {
        const speed = Math.hypot(s.vx, s.vy) || 1;
        const k = DEBRIS_LEN / speed;
        view
          .moveTo(s.x, s.y)
          .lineTo(s.x - s.vx * k, s.y - s.vy * k)
          .stroke({ color: s.color, width: DEBRIS_LINE_PX, alpha: 1 - s.age / DEBRIS_S });
      }
    },
    clear() {
      shards.length = 0;
      view.clear();
    },
  };
}
