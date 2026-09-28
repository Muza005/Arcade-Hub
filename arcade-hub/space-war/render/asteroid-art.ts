// Процедурные формы камней (SPACE_WAR_SPEC §5): неровные многоугольники, запекаются в текстуры один раз на матч.
// Случайность формы — своя, с постоянным сидом: вид не влияет на симуляцию и повтор.
import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { createRng } from '../../engine/rng';
import {
  ASTEROID_COLOR,
  ASTEROID_FILL,
  ASTEROID_JAGGED,
  ASTEROID_LINE_PX,
  ASTEROID_RADIUS,
  ASTEROID_SHAPE_SEED,
  ASTEROID_SHAPE_VARIANTS,
  ASTEROID_TEXTURE_PAD,
  ASTEROID_VERTICES,
  type AsteroidSize,
} from '../config';

export type AsteroidTextures = Record<AsteroidSize, Texture[]>;

const SIZES: readonly AsteroidSize[] = ['small', 'medium', 'large'];

function outline(radius: number, rng: ReturnType<typeof createRng>): number[] {
  const [min, max] = ASTEROID_VERTICES;
  const count = Math.floor(rng.range(min, max + 1));
  const points: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng.range(-0.5, 0.5) / count;
    const r = radius * (1 - ASTEROID_JAGGED / 2 + rng.next() * ASTEROID_JAGGED);
    points.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return points;
}

export function bakeAsteroids(renderer: Renderer): AsteroidTextures {
  const rng = createRng(ASTEROID_SHAPE_SEED);
  const result = {} as AsteroidTextures;
  for (const size of SIZES) {
    const radius = ASTEROID_RADIUS[size];
    result[size] = Array.from({ length: ASTEROID_SHAPE_VARIANTS }, () => {
      const g = new Graphics()
        .poly(outline(radius, rng))
        .fill(ASTEROID_FILL)
        .stroke({ color: ASTEROID_COLOR, width: ASTEROID_LINE_PX, join: 'round' });
      // Прозрачный квадрат задаёт размер текстуры: центр камня — центр текстуры.
      const half = radius + ASTEROID_TEXTURE_PAD;
      g.rect(-half, -half, half * 2, half * 2).fill({ color: 0, alpha: 0 });
      const texture = renderer.generateTexture({ target: g, antialias: true });
      g.destroy();
      return texture;
    });
  }
  return result;
}
