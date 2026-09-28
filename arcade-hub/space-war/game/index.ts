// Модуль Space War по контракту платформы (ARCADE_HUB_SPEC §16, «Модуль игры»).
// Этап Б0: пустое поле на весь экран и счётчик FPS в углу. Корабли, камни и волны — следующие этапы.
import { Graphics, Text } from 'pixi.js';
import { createStage, cssVar, loadFonts, type Stage } from '../../engine/stage';
import { rankByScore, type GameContext, type GameModule } from '../../shared/game-manifest';
import { createTranslator } from '../../shared/i18n';
import {
  ACCENT,
  FIELD_INSET,
  FIELD_LINE_ALPHA,
  FIELD_LINE_PX,
  FIELD_RADIUS,
  FPS_ALPHA,
  FPS_FONT_PX,
  FPS_PAD_PX,
  FPS_SAMPLE_S,
  WORLD_H,
  worldWidth,
} from '../config';
import { spaceWarManifest } from '../manifest';
import { strings } from '../i18n/strings';

const t = createTranslator(strings);

const FONT_DISPLAY = 'Unbounded';
const FONT_FALLBACK = 'sans-serif';
const MS_PER_S = 1000;

export function createSpaceWarGame(): GameModule {
  let ctx: GameContext;
  let stage: Stage;
  let ended = false;
  let fpsText: Text;
  /** FPS считается по кадрам отрисовки: это замер производительности, не симуляция. */
  let frames = 0;
  let sampleStart = 0;

  const endMatch = (): void => {
    if (ended) return;
    ended = true;
    ctx.end({
      gameId: spaceWarManifest.id,
      mode: ctx.mode,
      seed: ctx.seed,
      version: spaceWarManifest.version,
      rows: rankByScore(ctx.players.map((p) => ({ playerId: p.id, score: 0 }))),
    });
  };

  return {
    async init(context) {
      ctx = context;
      const worldW = worldWidth(ctx.aspect);
      await loadFonts([`700 ${FPS_FONT_PX}px "${FONT_DISPLAY}"`]);
      stage = await createStage(ctx.mount, worldW, WORLD_H, { background: cssVar('--bg') });

      const field = new Graphics()
        .roundRect(FIELD_INSET, FIELD_INSET, worldW - FIELD_INSET * 2, WORLD_H - FIELD_INSET * 2, FIELD_RADIUS)
        .stroke({ color: ACCENT, width: FIELD_LINE_PX, alpha: FIELD_LINE_ALPHA });

      fpsText = new Text({
        text: '',
        style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: FPS_FONT_PX, fill: cssVar('--text') },
      });
      fpsText.alpha = FPS_ALPHA;
      fpsText.anchor.set(1, 0);
      fpsText.position.set(worldW - FIELD_INSET - FPS_PAD_PX, FIELD_INSET + FPS_PAD_PX);

      stage.world.addChild(field, fpsText);
      sampleStart = performance.now();
    },

    update() {
      // Симуляции пока нет (этап Б1 — корабль).
    },

    render() {
      frames++;
      const now = performance.now();
      const elapsedS = (now - sampleStart) / MS_PER_S;
      if (elapsedS >= FPS_SAMPLE_S) {
        fpsText.text = t('fps', { n: Math.round(frames / elapsedS) });
        frames = 0;
        sampleStart = now;
      }
      stage.render();
    },

    pause() {
      // Замирать пока нечему.
    },

    resume() {
      frames = 0;
      sampleStart = performance.now();
    },

    finish() {
      endMatch();
    },

    dispose() {
      stage?.destroy();
    },
  };
}
