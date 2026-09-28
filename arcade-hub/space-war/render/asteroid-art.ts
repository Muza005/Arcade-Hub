// Процедурные формы камней (SPACE_WAR_SPEC §5): неровные многоугольники, запекаются в текстуры один раз на матч.
// У каждой формы три состояния: целый; трещины и сколы; светящиеся разломы на последнем попадании.
// Случайность формы — своя, с постоянным сидом: вид не влияет на симуляцию и повтор.
import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { createRng, type Rng } from '../../engine/rng';
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
  CRACK_COLOR,
  CRACK_GLOW,
  CRACK_GLOW_PX,
  CRACK_LINE_PX,
  CRACK_LINES,
  type AsteroidSize,
} from '../config';

export const RockState = { Whole: 0, Cracked: 1, LastHit: 2 } as const;
export type RockState = (typeof RockState)[keyof typeof RockState];

/** textures[size][shape][state] */
export type AsteroidTextures = Record<AsteroidSize, Texture[][]>;

const SIZES: readonly AsteroidSize[] = ['small', 'medium', 'large'];
const CRACK_REACH = 0.85; // трещина от центра почти до края
const CRACK_BENDS = 3;

export function rockState(hp: number, maxHp: number): RockState {
  if (hp >= maxHp) return RockState.Whole;
  return hp <= 1 ? RockState.LastHit : RockState.Cracked;
}

function outline(radius: number, rng: Rng): number[] {
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

/** Ломаные трещины из центра к краю. */
function cracks(radius: number, rng: Rng): number[][] {
  const [min, max] = CRACK_LINES;
  const count = Math.floor(rng.range(min, max + 1));
  return Array.from({ length: count }, (_, i) => {
    const base = (i / count) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const line = [rng.range(-0.1, 0.1) * radius, rng.range(-0.1, 0.1) * radius];
    for (let k = 1; k <= CRACK_BENDS; k++) {
      const a = base + rng.range(-0.35, 0.35);
      const r = (k / CRACK_BENDS) * radius * CRACK_REACH;
      line.push(Math.cos(a) * r, Math.sin(a) * r);
    }
    return line;
  });
}

function drawCracks(g: Graphics, lines: number[][], color: string, width: number): void {
  for (const line of lines) {
    g.moveTo(line[0] ?? 0, line[1] ?? 0);
    for (let i = 2; i < line.length; i += 2) g.lineTo(line[i] ?? 0, line[i + 1] ?? 0);
  }
  g.stroke({ color, width, cap: 'round', join: 'round' });
}

export function bakeAsteroids(renderer: Renderer): AsteroidTextures {
  const rng = createRng(ASTEROID_SHAPE_SEED);
  const result = {} as AsteroidTextures;
  for (const size of SIZES) {
    const radius = ASTEROID_RADIUS[size];
    result[size] = Array.from({ length: ASTEROID_SHAPE_VARIANTS }, () => {
      const shape = outline(radius, rng);
      const lines = cracks(radius, rng);
      return [RockState.Whole, RockState.Cracked, RockState.LastHit].map((state) => {
        const g = new Graphics().poly(shape).fill(ASTEROID_FILL);
        if (state === RockState.Cracked) drawCracks(g, lines, CRACK_COLOR, CRACK_LINE_PX);
        if (state === RockState.LastHit) drawCracks(g, lines, CRACK_GLOW, CRACK_GLOW_PX);
        g.poly(shape).stroke({
          color: state === RockState.LastHit ? CRACK_GLOW : ASTEROID_COLOR,
          width: ASTEROID_LINE_PX,
          join: 'round',
        });
        // Прозрачный квадрат задаёт размер текстуры: центр камня — центр текстуры.
        const half = radius + ASTEROID_TEXTURE_PAD;
        g.rect(-half, -half, half * 2, half * 2).fill({ color: 0, alpha: 0 });
        const texture = renderer.generateTexture({ target: g, antialias: true });
        g.destroy();
        return texture;
      });
    });
  }
  return result;
}
