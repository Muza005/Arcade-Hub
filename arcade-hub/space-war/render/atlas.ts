// Единый атлас Space War (SPACE_WAR_SPEC §9): всё мелкое — в одной текстуре, чтобы спрайты и частицы
// рисовались одним пакетом. Камни (форма × размер × состояние), мягкая искра и чёрточка осколка.
// Формы камней процедурные, со своей случайностью и постоянным сидом: вид не влияет на симуляцию.
import { Container, Graphics, Rectangle, Texture, type Renderer } from 'pixi.js';
import { createRng, type Rng } from '../../engine/rng';
import {
  ASTEROID_COLOR,
  ASTEROID_FILL,
  ASTEROID_GLOW_ALPHA,
  ASTEROID_GLOW_LAYERS,
  ASTEROID_GLOW_PX,
  ASTEROID_JAGGED,
  ASTEROID_LINE_PX,
  ASTEROID_RADIUS,
  ASTEROID_SHAPE_SEED,
  ASTEROID_SHAPE_VARIANTS,
  ASTEROID_TEXTURE_PAD,
  ASTEROID_VERTICES,
  ATLAS_FX_PAD,
  ATLAS_GAP,
  CRACK_COLOR,
  CRACK_GLOW,
  CRACK_GLOW_PX,
  CRACK_LINE_PX,
  CRACK_LINES,
  SHARD_TEXTURE_PX,
  SPARK_TEXTURE_PX,
  type AsteroidSize,
} from '../config';

export const RockState = { Whole: 0, Cracked: 1, LastHit: 2 } as const;
export type RockState = (typeof RockState)[keyof typeof RockState];

/** asteroids[size][shape][state] */
export type AsteroidTextures = Record<AsteroidSize, Texture[][]>;

export interface Atlas {
  readonly asteroids: AsteroidTextures;
  /** Мягкая белая точка — искры, красится tint. */
  readonly spark: Texture;
  /** Белая чёрточка — осколки. */
  readonly shard: Texture;
  destroy(): void;
}

const SIZES: readonly AsteroidSize[] = ['small', 'medium', 'large'];
const STATES: readonly RockState[] = [RockState.Whole, RockState.Cracked, RockState.LastHit];
const CRACK_REACH = 0.85; // трещина от центра почти до края
const CRACK_BENDS = 3;
const SPARK_RINGS = 5;
const SHARD_THICK_PX = 3;
const ATLAS_WIDTH = 1024;

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

function rock(shape: number[], lines: number[][], state: RockState): Graphics {
  const edge = state === RockState.LastHit ? CRACK_GLOW : ASTEROID_COLOR;
  const g = new Graphics();
  // Ореол — полосы от широкой к узкой: у контура они складываются в ASTEROID_GLOW_ALPHA, к краю тают.
  const layerAlpha = 1 - (1 - ASTEROID_GLOW_ALPHA) ** (1 / ASTEROID_GLOW_LAYERS);
  for (let i = ASTEROID_GLOW_LAYERS; i >= 1; i--) {
    g.poly(shape).stroke({ color: edge, width: (ASTEROID_GLOW_PX * i) / ASTEROID_GLOW_LAYERS, alpha: layerAlpha, join: 'round' });
  }
  g.poly(shape).fill(ASTEROID_FILL);
  if (state === RockState.Cracked) drawCracks(g, lines, CRACK_COLOR, CRACK_LINE_PX);
  if (state === RockState.LastHit) drawCracks(g, lines, CRACK_GLOW, CRACK_GLOW_PX);
  return g.poly(shape).stroke({ color: edge, width: ASTEROID_LINE_PX, join: 'round' });
}

export function bakeAtlas(renderer: Renderer): Atlas {
  const rng = createRng(ASTEROID_SHAPE_SEED);
  const sheet = new Container();
  const frames: Array<{ key: string; rect: Rectangle }> = [];
  // Раскладка полками: слева направо, новая полка — когда не влезает по ширине.
  let x = 0;
  let y = 0;
  let shelf = 0;
  const place = (key: string, g: Graphics, w: number, h: number): void => {
    if (x + w > ATLAS_WIDTH) {
      x = 0;
      y += shelf + ATLAS_GAP;
      shelf = 0;
    }
    g.position.set(x + w / 2, y + h / 2);
    sheet.addChild(g);
    frames.push({ key, rect: new Rectangle(x, y, w, h) });
    x += w + ATLAS_GAP;
    shelf = Math.max(shelf, h);
  };

  for (const size of SIZES) {
    const radius = ASTEROID_RADIUS[size];
    // Самая дальняя вершина — radius · (1 + JAGGED/2), за ней ореол: кадр с запасом, иначе свечение режется
    // краем, а соседний кадр (тот же камень с жёлтым контуром последнего удара) просвечивает пятном.
    const side = Math.ceil(radius * (1 + ASTEROID_JAGGED / 2) + ASTEROID_GLOW_PX / 2 + ASTEROID_TEXTURE_PAD) * 2;
    for (let v = 0; v < ASTEROID_SHAPE_VARIANTS; v++) {
      const shape = outline(radius, rng);
      const lines = cracks(radius, rng);
      for (const state of STATES) place(`${size}:${v}:${state}`, rock(shape, lines, state), side, side);
    }
  }
  const spark = new Graphics();
  for (let i = SPARK_RINGS; i >= 1; i--) spark.circle(0, 0, (SPARK_TEXTURE_PX / 2) * (i / SPARK_RINGS)).fill({ color: 0xffffff, alpha: 1 / SPARK_RINGS });
  place('spark', spark, SPARK_TEXTURE_PX + ATLAS_FX_PAD * 2, SPARK_TEXTURE_PX + ATLAS_FX_PAD * 2);
  const shard = new Graphics()
    .roundRect(-SHARD_TEXTURE_PX / 2, -SHARD_THICK_PX / 2, SHARD_TEXTURE_PX, SHARD_THICK_PX, SHARD_THICK_PX / 2)
    .fill(0xffffff);
  place('shard', shard, SHARD_TEXTURE_PX + ATLAS_FX_PAD * 2, SHARD_THICK_PX + ATLAS_FX_PAD * 2);

  const height = y + shelf;
  // Прозрачная подложка задаёт границы: координаты кадров совпадают с координатами листа.
  sheet.addChildAt(new Graphics().rect(0, 0, ATLAS_WIDTH, height).fill({ color: 0, alpha: 0 }), 0);
  const base = renderer.generateTexture({ target: sheet, antialias: true, frame: new Rectangle(0, 0, ATLAS_WIDTH, height) });
  sheet.destroy({ children: true });

  const byKey = new Map(frames.map((f) => [f.key, new Texture({ source: base.source, frame: f.rect })]));
  const get = (key: string): Texture => byKey.get(key) ?? Texture.EMPTY;
  const asteroids = {} as AsteroidTextures;
  for (const size of SIZES) {
    asteroids[size] = Array.from({ length: ASTEROID_SHAPE_VARIANTS }, (_, v) => STATES.map((st) => get(`${size}:${v}:${st}`)));
  }
  return {
    asteroids,
    spark: get('spark'),
    shard: get('shard'),
    destroy() {
      for (const tex of byKey.values()) tex.destroy(false);
      base.destroy(true);
    },
  };
}
