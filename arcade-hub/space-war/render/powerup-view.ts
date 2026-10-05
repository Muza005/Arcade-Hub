// Усиления на поле — иконками из шаблона заказчика (space-war/assets/powerups/*.svg, неоновое свечение запечено в SVG).
// Выпадение: кольцо-вспышка цветом усиления; значок выпрыгивает, потом мягко покачивается и светится ореолом,
// медленно плывёт (дрейф — в симуляции); последние секунды мигает.
import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  POWERUP_BLINK_HZ,
  POWERUP_BLINK_S,
  POWERUP_BOB_HZ,
  POWERUP_BOB_PX,
  POWERUP_COLOR,
  POWERUP_DROP_RING_PX,
  POWERUP_DROP_RING_S,
  POWERUP_HALO_ALPHA,
  POWERUP_HALO_PX,
  POWERUP_HOP_PX,
  POWERUP_HOP_S,
  POWERUP_ICON_PX,
  POWERUP_LIFETIME_S,
  POWERUPS,
  type PowerupKind,
} from '../config';
import type { Powerup } from '../game/powerups';
import ammoIcon from '../assets/powerups/ammo.svg';
import doubleIcon from '../assets/powerups/double.svg';
import freezeIcon from '../assets/powerups/freeze.svg';
import jammerIcon from '../assets/powerups/jammer.svg';
import overloadIcon from '../assets/powerups/overload.svg';
import repairIcon from '../assets/powerups/repair.svg';
import shieldIcon from '../assets/powerups/shield.svg';

const ICONS: Record<PowerupKind, string> = {
  repair: repairIcon,
  ammo: ammoIcon,
  shield: shieldIcon,
  freeze: freezeIcon,
  overload: overloadIcon,
  double: doubleIcon,
  jammer: jammerIcon,
};
/** Высота значка в шаблоне, px: все значки масштабируются одинаково — пропорции шаблона сохраняются. */
const TEMPLATE_ICON_PX = 36;
/** SVG растрируется с запасом — значок чёткий и на плотных экранах. */
const ICON_RESOLUTION = 3;
const RING_LINE_PX = 3;
const HALO_PULSE_HZ = 1.2;
const HALO_PULSE = 0.35;
const POP_FROM = 0.3; // значок выпрыгивает из маленького
/** Ореол — гаусс: к краю текстуры гаснет до нуля, без ступенек и обрезки. */
const HALO_TEXTURE_PX = 128;
const HALO_STOPS = 12;
const HALO_SIGMA = 0.38; // доля радиуса

export type PowerupIcons = Record<PowerupKind, Texture>;

function haloTexture(): Texture {
  const r = HALO_TEXTURE_PX / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = HALO_TEXTURE_PX;
  const g = canvas.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    for (let i = 0; i <= HALO_STOPS; i++) {
      const t = i / HALO_STOPS;
      // Гаусс, сдвинутый к нулю на краю.
      const edge = Math.exp(-1 / (2 * HALO_SIGMA ** 2));
      const a = (Math.exp(-(t * t) / (2 * HALO_SIGMA ** 2)) - edge) / (1 - edge);
      grad.addColorStop(t, `rgba(255,255,255,${a.toFixed(4)})`);
    }
    g.fillStyle = grad;
    g.fillRect(0, 0, HALO_TEXTURE_PX, HALO_TEXTURE_PX);
  }
  return Texture.from(canvas);
}

export async function loadPowerupIcons(): Promise<PowerupIcons> {
  const textures = await Promise.all(
    POWERUPS.map((kind) => Assets.load<Texture>({ src: ICONS[kind], data: { resolution: ICON_RESOLUTION } })),
  );
  return Object.fromEntries(POWERUPS.map((kind, i) => [kind, textures[i]])) as PowerupIcons;
}

export interface PowerupView {
  readonly view: Container;
  /** Выпадение: кольцо-вспышка цветом усиления. */
  burst(x: number, y: number, kind: PowerupKind): void;
  update(dtS: number): void;
  draw(list: readonly Powerup[], alpha: number, timeS: number): void;
  destroy(): void;
}

interface Item {
  node: Container;
  halo: Sprite;
  icon: Sprite;
}

export function createPowerupView(icons: PowerupIcons): PowerupView {
  const view = new Container();
  const rings = new Graphics();
  rings.blendMode = 'add';
  const items = new Map<number, Item>();
  const bursts: Array<{ x: number; y: number; color: string; ageS: number }> = [];
  const glow = haloTexture();
  view.addChild(rings);

  const make = (p: Powerup): Item => {
    const node = new Container();
    // Мягкий ореол цветом усиления.
    const halo = new Sprite(glow);
    halo.anchor.set(0.5);
    halo.width = halo.height = POWERUP_HALO_PX * 2;
    halo.tint = POWERUP_COLOR[p.kind];
    halo.blendMode = 'add';
    const icon = new Sprite(icons[p.kind]);
    icon.anchor.set(0.5);
    // Текстура — с полями под свечение (её разрешение уже учтено в размере): масштаб по высоте значка шаблона.
    const k = POWERUP_ICON_PX / TEMPLATE_ICON_PX;
    icon.scale.set(k);
    node.addChild(halo, icon);
    view.addChild(node);
    return { node, halo, icon };
  };

  return {
    view,
    burst(x, y, kind) {
      bursts.push({ x, y, color: POWERUP_COLOR[kind], ageS: 0 });
    },
    update(dtS) {
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i] as (typeof bursts)[number];
        b.ageS += dtS;
        if (b.ageS >= POWERUP_DROP_RING_S) bursts.splice(i, 1);
      }
    },
    draw(list, alpha, timeS) {
      rings.clear();
      for (const b of bursts) {
        const t = b.ageS / POWERUP_DROP_RING_S;
        rings.circle(b.x, b.y, POWERUP_DROP_RING_PX * t).stroke({ color: b.color, width: RING_LINE_PX, alpha: 1 - t });
      }
      const seen = new Set<number>();
      const blinkOff = Math.floor(timeS * POWERUP_BLINK_HZ * 2) % 2 === 1;
      for (const p of list) {
        seen.add(p.id);
        const item = items.get(p.id) ?? make(p);
        items.set(p.id, item);
        const age = POWERUP_LIFETIME_S - p.leftS;
        // Подскок при выпадении, потом мягкое покачивание.
        const hop = age < POWERUP_HOP_S ? -POWERUP_HOP_PX * 4 * (age / POWERUP_HOP_S) * (1 - age / POWERUP_HOP_S) : 0;
        const bob = Math.sin((age - POWERUP_HOP_S) * Math.PI * 2 * POWERUP_BOB_HZ) * POWERUP_BOB_PX * Math.min(1, Math.max(0, age - POWERUP_HOP_S));
        item.node.position.set(p.prev.x + (p.pos.x - p.prev.x) * alpha, p.prev.y + (p.pos.y - p.prev.y) * alpha + hop + bob);
        const pop = Math.min(1, POP_FROM + (1 - POP_FROM) * (age / POWERUP_HOP_S));
        item.node.scale.set(pop);
        item.halo.alpha = POWERUP_HALO_ALPHA * (1 + HALO_PULSE * Math.sin(timeS * Math.PI * 2 * HALO_PULSE_HZ));
        item.node.visible = !(p.leftS < POWERUP_BLINK_S && blinkOff);
      }
      for (const [id, item] of items) {
        if (seen.has(id)) continue;
        item.node.destroy({ children: true });
        items.delete(id);
      }
    },
    destroy() {
      glow.destroy(true);
    },
  };
}
