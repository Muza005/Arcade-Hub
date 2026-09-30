// Осложнение «Воронка»: бледные кольца сходятся к центру поля — видно, куда тянет.
import { Graphics } from 'pixi.js';
import { DARK_FADE_S, VORTEX_RING_ALPHA, VORTEX_RING_MAX, VORTEX_RING_PX, VORTEX_RING_S, VORTEX_RINGS } from '../config';

export interface VortexFx {
  readonly view: Graphics;
  update(on: boolean, dtS: number): void;
  draw(): void;
}

export function createVortexFx(x: number, y: number, color: string): VortexFx {
  const view = new Graphics();
  view.position.set(x, y);
  view.visible = false;
  let k = 0;
  let timeS = 0;

  return {
    view,
    update(on, dtS) {
      k = Math.min(1, Math.max(0, k + (on ? dtS : -dtS) / DARK_FADE_S));
      view.visible = k > 0;
      if (view.visible) timeS += dtS;
    },
    draw() {
      if (!view.visible) return;
      view.clear();
      for (let i = 0; i < VORTEX_RINGS; i++) {
        // Фаза кольца: 0 — на краю, 1 — в центре; к центру ярче.
        const phase = (timeS / VORTEX_RING_S + i / VORTEX_RINGS) % 1;
        const r = VORTEX_RING_MAX * (1 - phase);
        if (r <= 0) continue;
        view.circle(0, 0, r).stroke({ color, width: VORTEX_RING_PX, alpha: VORTEX_RING_ALPHA * k * Math.sin(phase * Math.PI) });
      }
    },
  };
}
