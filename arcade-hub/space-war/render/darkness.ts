// Осложнение «Затемнение»: поле закрыто тьмой, видно только круг вокруг каждого корабля.
// Тьма рисуется в текстуру низкого разрешения: заливка минус мягкие круги (режим erase).
import { Container, Graphics, RenderTexture, Sprite, Texture, type Renderer } from 'pixi.js';
import { DARK_ALPHA, DARK_EDGE, DARK_FADE_S, DARK_RADIUS, DARK_TEXTURE_RES } from '../config';

export interface Darkness {
  readonly view: Sprite;
  /** Наплыв и уход тьмы. */
  update(on: boolean, dtS: number): void;
  /** Круги — в координатах мира (со сдвигом камеры). */
  draw(holes: ReadonlyArray<{ x: number; y: number }>): void;
  destroy(): void;
}

/** Мягкий круг: полностью непрозрачный в середине, к краю DARK_EDGE плавно гаснет. */
function holeTexture(): Texture {
  const size = DARK_RADIUS * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(DARK_RADIUS, DARK_RADIUS, 0, DARK_RADIUS, DARK_RADIUS, DARK_RADIUS);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1 - DARK_EDGE, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return Texture.from(canvas);
}

export function createDarkness(renderer: Renderer, worldW: number, worldH: number, color: string): Darkness {
  const target = RenderTexture.create({ width: worldW, height: worldH, resolution: DARK_TEXTURE_RES });
  const view = new Sprite(target);
  view.visible = false;
  const layer = new Container();
  const fill = new Graphics().rect(0, 0, worldW, worldH).fill(color);
  layer.addChild(fill);
  const hole = holeTexture();
  const holes: Sprite[] = [];
  let k = 0;

  return {
    view,
    update(on, dtS) {
      k = Math.min(1, Math.max(0, k + (on ? dtS : -dtS) / DARK_FADE_S));
      view.visible = k > 0;
      view.alpha = DARK_ALPHA * k;
    },
    draw(points) {
      if (!view.visible) return;
      while (holes.length < points.length) {
        const s = new Sprite(hole);
        s.anchor.set(0.5);
        s.blendMode = 'erase';
        holes.push(s);
        layer.addChild(s);
      }
      holes.forEach((s, i) => {
        const p = points[i];
        s.visible = p !== undefined;
        if (p) s.position.set(p.x, p.y);
      });
      renderer.render({ container: layer, target, clear: true });
    },
    destroy() {
      target.destroy(true);
      hole.destroy(true);
      layer.destroy({ children: true });
    },
  };
}
