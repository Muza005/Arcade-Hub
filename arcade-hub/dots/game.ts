// Модуль «Точек» по контракту платформы (ARCADE_HUB_SPEC §16, «Модуль игры»).
// Шаблон для новой игры: симуляция — sim.ts, отрисовка — здесь, числа — config.ts, строки — strings.ts.
import { Container, Graphics, Text } from 'pixi.js';
import { FixedLoop } from '../engine/loop';
import { createStage, cssVar, loadFonts, type Stage } from '../engine/stage';
import { FIXED_STEP_HZ } from '../shared/config';
import { createTranslator } from '../shared/i18n';
import { rankByScore, type GameContext, type GameModule } from '../shared/game-manifest';
import {
  DASH_ENABLED_DEFAULT,
  DOT_RADIUS,
  FIELD,
  FIELD_LINE_PX,
  FIELD_RADIUS,
  MATCH_S_DEFAULT,
  NICK_FONT_PX,
  NICK_GAP_PX,
  PICKUP_VIBRATE_MS,
  REPLAY_FRAME_HZ,
  REPLAY_TAIL_S,
  SECONDS_PER_MINUTE,
  SCORE_FONT_PX,
  SCORE_GAP_PX,
  SCORE_SWATCH_RADIUS,
  STAR_COLOR,
  STAR_INNER_RATIO,
  STAR_POINTS,
  STAR_RADIUS,
  TIMER_FONT_PX,
  TIMER_Y,
  WORLD_H,
  WORLD_W,
} from './config';
import { dotsManifest } from './manifest';
import { botInput } from './bot';
import { createSim, type Sim, type Vec } from './sim';
import { strings } from './strings';

const t = createTranslator(strings);

const FONT_UI = 'Golos Text';
const FONT_DISPLAY = 'Unbounded';
const FONT_FALLBACK = 'sans-serif';

interface DotView {
  node: Container;
}

interface ScoreView {
  swatch: Graphics;
  text: Text;
}

export function createDotsGame(): GameModule {
  let ctx: GameContext;
  let sim: Sim;
  let stage: Stage;
  let paused = false;
  let ended = false;
  /** Боты управляются самой игрой: платформа для них ввода не даёт. */
  let bots = new Set<string>();

  /** Кадры последних REPLAY_TAIL_S секунд — для повтора в итогах (кольцевой буфер). */
  interface Frame {
    dots: Vec[];
    stars: Vec[];
    timeLeftS: number;
  }
  const tail: Frame[] = [];
  /** Повтор могут пропустить — тогда dispose останавливает его цикл. */
  let replayLoop: FixedLoop | null = null;
  const TAIL_FRAMES = REPLAY_TAIL_S * FIXED_STEP_HZ;

  const dotViews = new Map<string, DotView>();
  const starsLayer = new Graphics();
  let timerText: Text;
  let scoreViews: ScoreView[] = [];
  let lastScores = '';
  let lastTimer = -1;

  const endMatch = (): void => {
    if (ended) return;
    ended = true;
    ctx.end({
      gameId: dotsManifest.id,
      mode: ctx.mode,
      seed: ctx.seed,
      version: dotsManifest.version,
      rows: rankByScore(sim.dots.map((d) => ({ playerId: d.id, score: d.score }))),
    });
  };

  const settingNumber = (key: string, fallback: number): number => {
    const v = ctx.settings[key];
    return typeof v === 'number' ? v : fallback;
  };
  const settingBool = (key: string, fallback: boolean): boolean => {
    const v = ctx.settings[key];
    return typeof v === 'boolean' ? v : fallback;
  };

  const drawField = (): Graphics =>
    new Graphics()
      .roundRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top, FIELD_RADIUS)
      .fill(cssVar('--surface'))
      .stroke({ color: cssVar('--line'), width: FIELD_LINE_PX });

  const drawStars = (): void => drawStarsAt(sim.stars);
  const drawStarsAt = (stars: readonly Vec[]): void => {
    starsLayer.clear();
    for (const star of stars) {
      starsLayer.star(star.x, star.y, STAR_POINTS, STAR_RADIUS, STAR_RADIUS * STAR_INNER_RATIO);
    }
    starsLayer.fill(STAR_COLOR);
  };

  const layoutScores = (): void => {
    const key = sim.dots.map((d) => d.score).join(',');
    if (key === lastScores) return;
    lastScores = key;
    let x = FIELD.left;
    ctx.players.forEach((player, i) => {
      const view = scoreViews[i];
      if (!view) return;
      view.text.text = t('score', { nick: player.nick, score: sim.dots[i]?.score ?? 0 });
      view.swatch.position.set(x + SCORE_SWATCH_RADIUS, TIMER_Y);
      view.text.position.set(x + SCORE_SWATCH_RADIUS * 2 + NICK_GAP_PX, TIMER_Y);
      x = view.text.x + view.text.width + SCORE_GAP_PX;
    });
  };

  return {
    async init(context) {
      ctx = context;
      bots = new Set(ctx.players.filter((p) => p.kind === 'bot').map((p) => p.id));
      sim = createSim(
        ctx.players.map((p) => p.id),
        ctx.seed,
        {
          durationS: settingNumber('durationS', MATCH_S_DEFAULT),
          dashEnabled: settingBool('dash', DASH_ENABLED_DEFAULT),
        },
      );

      await loadFonts([`600 ${NICK_FONT_PX}px "${FONT_UI}"`, `700 ${TIMER_FONT_PX}px "${FONT_DISPLAY}"`]);
      stage = await createStage(ctx.mount, WORLD_W, WORLD_H);
      const { world } = stage;
      const textColor = cssVar('--text');

      world.addChild(drawField(), starsLayer);

      const hud = new Container();
      timerText = new Text({
        text: '',
        style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: TIMER_FONT_PX, fill: textColor },
      });
      timerText.anchor.set(1, 0.5);
      timerText.position.set(FIELD.right, TIMER_Y);
      hud.addChild(timerText);

      scoreViews = ctx.players.map((player) => {
        const swatch = new Graphics().circle(0, 0, SCORE_SWATCH_RADIUS).fill(player.color);
        const text = new Text({
          text: '',
          style: { fontFamily: [FONT_UI, FONT_FALLBACK], fontWeight: '600', fontSize: SCORE_FONT_PX, fill: textColor },
        });
        text.anchor.set(0, 0.5);
        hud.addChild(swatch, text);
        return { swatch, text };
      });
      world.addChild(hud);

      for (const player of ctx.players) {
        const node = new Container();
        const circle = new Graphics().circle(0, 0, DOT_RADIUS).fill(player.color);
        const nick = new Text({
          text: player.nick,
          style: { fontFamily: [FONT_UI, FONT_FALLBACK], fontWeight: '600', fontSize: NICK_FONT_PX, fill: textColor },
        });
        nick.anchor.set(0.5, 1);
        nick.y = -DOT_RADIUS - NICK_GAP_PX;
        node.addChild(circle, nick);
        world.addChild(node);
        dotViews.set(player.id, { node });
      }
    },

    update(dtS) {
      if (paused || ended) return;
      sim.step(dtS, (id) => (bots.has(id) ? botInput(sim, id) : ctx.input.read(id)));
      for (const id of sim.pickups) ctx.fx(id, { vib: PICKUP_VIBRATE_MS, flash: STAR_COLOR });
      tail.push({
        dots: sim.dots.map((d) => ({ x: d.pos.x, y: d.pos.y })),
        stars: sim.stars.map((s) => ({ ...s })),
        timeLeftS: sim.timeLeftS,
      });
      if (tail.length > TAIL_FRAMES) tail.shift();
      if (sim.over) endMatch();
    },

    replay() {
      // Проигрываем сохранённые кадры с частотой REPLAY_FRAME_HZ — на той же сцене, без симуляции.
      const frames = [...tail];
      if (frames.length === 0) return Promise.resolve();
      return new Promise<void>((done) => {
        let i = 0;
        const loop: FixedLoop = new FixedLoop(
          {
            update() {
              i++;
              if (i >= frames.length) {
                loop.stop();
                replayLoop = null;
                done();
              }
            },
            render() {
              const frame = frames[Math.min(i, frames.length - 1)] as Frame;
              sim.dots.forEach((dot, n) => {
                const p = frame.dots[n];
                if (p) dotViews.get(dot.id)?.node.position.set(p.x, p.y);
              });
              drawStarsAt(frame.stars);
              stage.render();
            },
          },
          undefined,
          REPLAY_FRAME_HZ,
        );
        replayLoop = loop;
        loop.start();
      });
    },

    results() {
      const ranked = rankByScore(sim.dots.map((d) => ({ playerId: d.id, score: d.score })));
      const topScore = ranked[0]?.score ?? 0;
      return {
        // «Больше всех звёзд» — всем, кто разделил первое место, если звёзды вообще были.
        awards:
          topScore > 0
            ? ranked
                .filter((r) => r.score === topScore)
                .map((r) => ({ playerId: r.playerId, title: t('awardStars'), value: `${r.score} ★` }))
            : [],
        table: { columns: [t('colStars')], rows: ranked.map((r) => ({ playerId: r.playerId, cells: [String(r.score)] })) },
      };
    },

    render(alpha) {
      for (const dot of sim.dots) {
        const view = dotViews.get(dot.id);
        view?.node.position.set(
          dot.prev.x + (dot.pos.x - dot.prev.x) * alpha,
          dot.prev.y + (dot.pos.y - dot.prev.y) * alpha,
        );
      }
      drawStars();
      layoutScores();
      const seconds = Math.ceil(sim.timeLeftS);
      if (seconds !== lastTimer) {
        lastTimer = seconds;
        timerText.text = t('timer', { s: seconds });
      }
      stage.render();
    },

    pause() {
      paused = true;
    },

    resume() {
      paused = false;
    },

    finish() {
      sim.stop();
      endMatch();
    },

    mainButton(playerId) {
      return { progress: sim.dashReady(playerId) };
    },

    status() {
      const total = Math.ceil(sim.timeLeftS);
      const time = `${Math.floor(total / SECONDS_PER_MINUTE)}:${String(total % SECONDS_PER_MINUTE).padStart(2, '0')}`;
      return t('status', { time });
    },

    dispose() {
      replayLoop?.stop();
      replayLoop = null;
      stage?.destroy();
      dotViews.clear();
    },
  };
}
