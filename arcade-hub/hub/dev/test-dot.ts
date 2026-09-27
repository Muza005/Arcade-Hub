// Тестовая точка этапа А0: проверка цикла, ввода и отрисовки. Уберётся на этапе А1.
import { Application, Graphics } from 'pixi.js';
import { createKeyboardSource, InputHub } from '../../engine/input';
import { FixedLoop } from '../../engine/loop';
import { DEV_FPS_SAMPLE_S, DEV_TEST_DOT } from '../../shared/config';
import { t } from '../../shared/i18n';

const PLAYER_ID = 'kb-arrows';
const MS_PER_S = 1000;

function cssColor(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export async function mountTestDot(root: HTMLElement): Promise<() => void> {
  const stage = document.createElement('div');
  stage.className = 'stage';
  root.append(stage);

  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: true,
    autoStart: false,
    autoDensity: true,
    resolution: window.devicePixelRatio,
  });
  app.ticker.stop();
  stage.append(app.canvas);

  const input = new InputHub();
  input.add(createKeyboardSource(PLAYER_ID, 'arrows'));

  const { radiusPx, speedPxPerS } = DEV_TEST_DOT;
  const dot = new Graphics().circle(0, 0, radiusPx).fill(cssColor('--ok'));
  app.stage.addChild(dot);

  const cur = { x: app.screen.width / 2, y: app.screen.height / 2 };
  const prev = { ...cur };

  const hud = document.createElement('div');
  hud.className = 'dev-hud';
  const fpsLabel = document.createElement('span');
  fpsLabel.className = 'dev-hud__fps';
  const hint = document.createElement('span');
  hint.textContent = t('dev.testDotHint');
  hud.append(fpsLabel, hint);
  root.append(hud);

  let frames = 0;
  let sampleStartMs = performance.now();

  const loop = new FixedLoop({
    update(dtS) {
      prev.x = cur.x;
      prev.y = cur.y;
      const { x, y } = input.read(PLAYER_ID);
      const { width, height } = app.screen;
      cur.x = Math.min(Math.max(cur.x + x * speedPxPerS * dtS, radiusPx), width - radiusPx);
      cur.y = Math.min(Math.max(cur.y + y * speedPxPerS * dtS, radiusPx), height - radiusPx);
    },
    render(alpha) {
      dot.position.set(prev.x + (cur.x - prev.x) * alpha, prev.y + (cur.y - prev.y) * alpha);
      app.render();

      frames++;
      const nowMs = performance.now();
      const elapsedS = (nowMs - sampleStartMs) / MS_PER_S;
      if (elapsedS >= DEV_FPS_SAMPLE_S) {
        fpsLabel.textContent = t('dev.fps', { fps: Math.round(frames / elapsedS) });
        frames = 0;
        sampleStartMs = nowMs;
      }
    },
  });
  loop.start();

  return () => {
    loop.stop();
    input.dispose();
    app.destroy(true);
    stage.remove();
    hud.remove();
  };
}
