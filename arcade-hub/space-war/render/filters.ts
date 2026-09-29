// Шейдеры Space War (SPACE_WAR_SPEC §9): параллакс-звёзды, bloom через размытие, хроматическая аберрация.
// Только WebGL: на других рендерерах эффекты не включаются, игра остаётся без них.
import {
  AlphaFilter,
  BlurFilter,
  Filter,
  GlProgram,
  Texture,
  TexturePool,
  UniformGroup,
  defaultFilterVert,
  type FilterSystem,
  type RenderSurface,
} from 'pixi.js';
import { BLOOM_BLUR, BLOOM_BLUR_QUALITY, STAR_DENSITY, STAR_LAYERS } from '../config';

const num = (v: number): string => (Number.isInteger(v) ? `${v}.0` : String(v));

/** Разрешение фильтра — как у экрана. По умолчанию PixiJS рендерит фильтры в разрешении 1,
 *  и на плотных экранах ноутбуков всё под фильтром выходит мутным. */
const SHARP = { resolution: 'inherit', antialias: 'inherit' } as const;

// ─── Звёзды ──────────────────────────────────────────────────────
// Каждый слой — сетка ячеек; в части ячеек звезда со своим смещением, размером, цветом и мерцанием.
// Слои плывут с разной скоростью и по-разному смещаются вместе с тряской камеры — отсюда глубина.
const starsFrag = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform highp vec4 uInputSize;
uniform float uTime;
uniform float uScale;
uniform vec2 uOffset;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec3 layer(vec2 world, float cell, float drift, float parallax, float bright) {
  vec2 p = world + uOffset * parallax + vec2(0.0, uTime * drift);
  vec2 id = floor(p / cell);
  vec2 f = fract(p / cell) - 0.5;
  float h = hash(id);
  if (h > ${num(STAR_DENSITY)}) return vec3(0.0);
  vec2 o = vec2(hash(id + 1.3), hash(id + 7.1)) - 0.5;
  float d = length(f - o * 0.7);
  float size = mix(0.025, 0.07, hash(id + 3.7));
  float star = smoothstep(size, 0.0, d);
  float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
  vec3 tint = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.9, 0.8), hash(id + 9.2));
  return tint * star * bright * twinkle;
}

void main() {
  vec2 world = vTextureCoord * uInputSize.xy / uScale;
  vec3 c = vec3(0.0);
${STAR_LAYERS.map((l) => `  c += layer(world, ${num(l.cell)}, ${num(l.drift)}, ${num(l.parallax)}, ${num(l.bright)});`).join('\n')}
  float a = max(c.r, max(c.g, c.b));
  finalColor = vec4(c, a);
}
`;

export interface StarsFilter {
  readonly filter: Filter;
  /** Время в секундах, пикселей экрана на единицу мира, сдвиг камеры. */
  set(timeS: number, scale: number, offsetX: number, offsetY: number): void;
}

export function createStarsFilter(): StarsFilter {
  const uniforms = new UniformGroup({
    uTime: { value: 0, type: 'f32' },
    uScale: { value: 1, type: 'f32' },
    uOffset: { value: new Float32Array(2), type: 'vec2<f32>' },
  });
  const filter = new Filter({
    ...SHARP,
    glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: starsFrag, name: 'sw-stars' }),
    resources: { starUniforms: uniforms },
  });
  return {
    filter,
    set(timeS, scale, offsetX, offsetY) {
      uniforms.uniforms.uTime = timeS;
      uniforms.uniforms.uScale = scale;
      const o = uniforms.uniforms.uOffset as Float32Array;
      o[0] = offsetX;
      o[1] = offsetY;
    },
  };
}

// ─── Bloom ───────────────────────────────────────────────────────
// Слой свечения размывается и ложится поверх самого себя: картинка + размытая копия × сила.
const bloomFrag = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uBloom;
uniform float uStrength;

void main() {
  vec4 base = texture(uTexture, vTextureCoord);
  vec4 glow = texture(uBloom, vTextureCoord);
  finalColor = base + glow * uStrength;
}
`;

export class BloomFilter extends Filter {
  private readonly blur: BlurFilter;
  /** Копия входа: размытие PixiJS пишет промежуточные проходы прямо во входную текстуру. */
  private readonly copy = new AlphaFilter({ alpha: 1, ...SHARP });
  private readonly bloomUniforms: UniformGroup;

  constructor() {
    const bloomUniforms = new UniformGroup({ uStrength: { value: 1, type: 'f32' } });
    super({
      ...SHARP,
      glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: bloomFrag, name: 'sw-bloom' }),
      resources: { bloomUniforms, uBloom: Texture.WHITE.source },
    });
    this.bloomUniforms = bloomUniforms;
    this.blur = new BlurFilter({ strength: BLOOM_BLUR, quality: BLOOM_BLUR_QUALITY, ...SHARP });
    this.padding = BLOOM_BLUR * 2;
  }

  set strength(value: number) {
    this.bloomUniforms.uniforms.uStrength = value;
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const base = TexturePool.getSameSizeTexture(input);
    const blurred = TexturePool.getSameSizeTexture(input);
    filterManager.applyFilter(this.copy, input, base, true);
    this.blur.apply(filterManager, input, blurred, true);
    this.resources.uBloom = blurred.source;
    filterManager.applyFilter(this, base, output, clearMode);
    TexturePool.returnTexture(blurred);
    TexturePool.returnTexture(base);
  }
}

// ─── Хроматическая аберрация ─────────────────────────────────────
// Красный и синий каналы расходятся от центра к краям; сила — в пикселях у края.
const chromaFrag = `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform vec4 uInputClamp;
uniform float uAmount;

void main() {
  vec2 center = (uInputClamp.xy + uInputClamp.zw) * 0.5;
  vec2 dir = (vTextureCoord - center) / max(center, vec2(0.0001));
  vec2 shift = dir * uAmount * uInputSize.zw;
  vec4 mid = texture(uTexture, vTextureCoord);
  float r = texture(uTexture, clamp(vTextureCoord + shift, uInputClamp.xy, uInputClamp.zw)).r;
  float b = texture(uTexture, clamp(vTextureCoord - shift, uInputClamp.xy, uInputClamp.zw)).b;
  finalColor = vec4(r, mid.g, b, mid.a);
}
`;

export interface ChromaFilter {
  readonly filter: Filter;
  set(amountPx: number): void;
}

export function createChromaFilter(): ChromaFilter {
  const uniforms = new UniformGroup({ uAmount: { value: 0, type: 'f32' } });
  const filter = new Filter({
    ...SHARP,
    glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: chromaFrag, name: 'sw-chroma' }),
    resources: { chromaUniforms: uniforms },
  });
  return {
    filter,
    set(amountPx) {
      uniforms.uniforms.uAmount = amountPx;
    },
  };
}
