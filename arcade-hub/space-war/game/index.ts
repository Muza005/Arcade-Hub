// Модуль Space War по контракту платформы (ARCADE_HUB_SPEC §16, «Модуль игры»).
// Б0: поле на весь экран и счётчик FPS. Б1: корабли. Камни, стрельба и волны — следующие этапы.
import { Graphics, Text } from 'pixi.js';
import { IDLE_INPUT } from '../../engine/input';
import { createStage, cssVar, loadFonts, type Stage } from '../../engine/stage';
import { rankByScore, type GameContext, type GameModule, type GamePlayer } from '../../shared/game-manifest';
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
  NICK_FONT_PX,
  WORLD_H,
  worldWidth,
} from '../config';
import { spaceWarManifest } from '../manifest';
import { strings } from '../i18n/strings';
import { createShipView, type ShipView } from '../render/ship-view';
import { angleDelta } from './ship';
import { createSim, type Sim } from './sim';

const t = createTranslator(strings);

const FONT_DISPLAY = 'Unbounded';
const FONT_UI = 'Golos Text';
const FONT_FALLBACK = 'sans-serif';
const MS_PER_S = 1000;

export function createSpaceWarGame(): GameModule {
  let ctx: GameContext;
  let stage: Stage;
  let ended = false;
  let paused = false;
  let sim: Sim;
  /** Боты — этап Б6; до тех пор без ввода. */
  let bots = new Set<string>();
  const views = new Map<string, ShipView>();
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
      bots = new Set(ctx.players.filter((p) => p.kind === 'bot').map((p) => p.id));
      sim = createSim(
        ctx.players.map((p) => p.id),
        worldW,
      );
      await loadFonts([`700 ${FPS_FONT_PX}px "${FONT_DISPLAY}"`, `600 ${NICK_FONT_PX}px "${FONT_UI}"`]);
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

      stage.world.addChild(field);
      const textColor = cssVar('--text');
      for (const player of ctx.players) {
        const view = createShipView(textColor);
        view.paint(player.color, player.nick);
        view.setBounds(sim.bounds);
        views.set(player.id, view);
        stage.world.addChild(view.node);
      }
      stage.world.addChild(fpsText);
      sampleStart = performance.now();
    },

    update(dtS) {
      if (paused || ended) return;
      sim.step(dtS, (id) => (bots.has(id) ? IDLE_INPUT : ctx.input.read(id)));
    },

    render(alpha) {
      for (const ship of sim.ships) {
        views.get(ship.id)?.set(
          ship.prev.x + (ship.pos.x - ship.prev.x) * alpha,
          ship.prev.y + (ship.pos.y - ship.prev.y) * alpha,
          ship.prevAngle + angleDelta(ship.prevAngle, ship.angle) * alpha,
          ship.thrust,
        );
      }
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
      paused = true;
    },

    resume() {
      paused = false;
      frames = 0;
      sampleStart = performance.now();
    },

    finish() {
      endMatch();
    },

    updatePlayer(player: GamePlayer) {
      views.get(player.id)?.paint(player.color, player.nick);
    },

    dispose() {
      stage?.destroy();
      views.clear();
    },
  };
}
