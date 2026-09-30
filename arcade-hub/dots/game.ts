// Модуль «Точек» по контракту платформы (ARCADE_HUB_SPEC §16, «Модуль игры»).
// Шаблон для новой игры: симуляция — sim.ts, отрисовка — здесь, числа — config.ts, строки — strings.ts.
import { Container, Graphics, Text } from 'pixi.js';
import { IDLE_INPUT } from '../engine/input';
import { FixedLoop } from '../engine/loop';
import { createNotice, type Notice } from '../engine/notice';
import { createStage, cssVar, loadFonts, type Stage } from '../engine/stage';
import { parseAimShot } from '../shared/aim';
import { FIXED_STEP_HZ } from '../shared/config';
import { createTranslator } from '../shared/i18n';
import { rankByScore, type GameContext, type GameModule, type GamePlayer } from '../shared/game-manifest';
import {
  DASH_ENABLED_DEFAULT,
  DOT_RADIUS,
  FIELD_LINE_PX,
  FIELD_RADIUS,
  HUD_ALPHA,
  HUD_PAD_PX,
  HUD_POP_S,
  HUD_POP_SCALE,
  HUD_SLIDE_RATE,
  LEADER_RING_GAP_PX,
  LEADER_RING_PX,
  MATCH_S_DEFAULT,
  NICK_FONT_PX,
  NICK_GAP_PX,
  NOTICE_FONT_PX,
  NOTICE_LEFT_AT_S,
  NOTICE_PAD_X,
  NOTICE_PAD_Y,
  NOTICE_PLATE_ALPHA,
  NOTICE_Y,
  PICKUP_VIBRATE_MS,
  PLUS_FONT_PX,
  PLUS_RISE_PX,
  PLUS_S,
  REPLAY_FRAME_HZ,
  REPLAY_TAIL_S,
  SCORE_DOT_GAP_PX,
  SCORE_DOT_RADIUS,
  SCORE_FONT_PX,
  SCORE_GAP_PX,
  SECONDS_PER_MINUTE,
  SHAPES,
  SHAPE_DEFAULT,
  SQUARE_CORNER_K,
  SQUARE_K,
  type Shape,
  STAR_COLOR,
  STAR_INNER_RATIO,
  STAR_POINTS,
  STAR_RADIUS,
  TIMER_FONT_PX,
  TIMER_URGENT_S,
  WORLD_H,
  fieldFor,
  worldWidth,
  THROW_COOLDOWN_S,
  THROW_ENABLED_DEFAULT,
  THROW_STAR_COLOR,
} from './config';
import { dotsManifest } from './manifest';
import { botInput } from './bot';
import { createSim, type Sim, type Vec } from './sim';
import { strings } from './strings';

const t = createTranslator(strings);
/** Иконка карточки броска (цвет — currentColor). */
const ICON_STAR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" fill="currentColor"/></svg>';

const FONT_UI = 'Golos Text';
const FONT_DISPLAY = 'Unbounded';
const FONT_FALLBACK = 'sans-serif';

/** Игрок на поле и его фишка счёта в углу. */
interface PlayerView {
  node: Container;
  circle: Graphics;
  nick: Text;
  chip: Container;
  chipDot: Graphics;
  chipRing: Graphics;
  chipText: Text;
  /** Текущее и целевое положение фишки: при обгоне фишки плавно меняются местами. */
  chipX: number;
  chipTargetX: number;
  /** 1 в момент очка, спадает до 0 за HUD_POP_S. */
  pop: number;
}

/** Всплывающее «+1» над игроком. */
interface Plus {
  text: Text;
  x: number;
  y: number;
  ageS: number;
}

export function createDotsGame(): GameModule {
  let ctx: GameContext;
  let sim: Sim;
  let stage: Stage;
  let paused = false;
  let ended = false;
  /** Боты управляются самой игрой: платформа для них ввода не даёт. */
  let bots = new Set<string>();
  /** Бросок звёзд включён: телефоны получают «прицел» и не летают (проверка раскладки). */
  let throwers = new Set<string>();

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

  const views = new Map<string, PlayerView>();
  const starsLayer = new Graphics();
  const plusLayer = new Container();
  const pluses: Plus[] = [];
  let timerText: Text;
  let timerPop = 0;
  let lastScores = '';
  let lastTimer = -1;
  let notice: Notice;
  /** Отметки «осталось N с», которые ещё не показаны. */
  let pendingLeft: number[] = [];
  let hudY = 0;

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

  const drawField = (): Graphics => {
    const f = sim.field;
    return new Graphics()
      .roundRect(f.left, f.top, f.right - f.left, f.bottom - f.top, FIELD_RADIUS)
      .fill(cssVar('--surface'))
      .stroke({ color: cssVar('--line'), width: FIELD_LINE_PX });
  };

  const drawStars = (): void => {
    drawStarsAt(sim.stars);
    for (const star of sim.flying) {
      starsLayer.star(star.pos.x, star.pos.y, STAR_POINTS, STAR_RADIUS, STAR_RADIUS * STAR_INNER_RATIO);
    }
    starsLayer.fill(THROW_STAR_COLOR);
  };
  const drawStarsAt = (stars: readonly Vec[]): void => {
    starsLayer.clear();
    for (const star of stars) {
      starsLayer.star(star.x, star.y, STAR_POINTS, STAR_RADIUS, STAR_RADIUS * STAR_INNER_RATIO);
    }
    starsLayer.fill(STAR_COLOR);
  };

  /** Круг или скруглённый квадрат — поле игрока «Форма» из лобби. */
  const drawShape = (g: Graphics, shape: Shape, r: number, color: string): Graphics => {
    g.clear();
    if (shape === 'square') {
      const s = r * SQUARE_K;
      g.roundRect(-s, -s, s * 2, s * 2, s * SQUARE_CORNER_K);
    } else g.circle(0, 0, r);
    return g.fill(color);
  };
  const shapeOf = (player: GamePlayer): Shape => {
    const v = player.fields?.shape;
    return SHAPES.find((s) => s === v) ?? SHAPE_DEFAULT;
  };

  const paintPlayer = (view: PlayerView, player: GamePlayer): void => {
    drawShape(view.circle, shapeOf(player), DOT_RADIUS, player.color);
    drawShape(view.chipDot, shapeOf(player), SCORE_DOT_RADIUS, player.color);
    view.nick.text = player.nick;
  };

  /** Места поменялись или выросло число — пересчитать, куда едут фишки. */
  const layoutScores = (): void => {
    const key = sim.dots.map((d) => d.score).join(',');
    if (key === lastScores) return;
    lastScores = key;
    // Сортировка устойчивая: при равном счёте порядок входа.
    const ranked = [...sim.dots].sort((a, b) => b.score - a.score);
    const top = ranked[0]?.score ?? 0;
    let x = sim.field.left + HUD_PAD_PX + SCORE_DOT_RADIUS;
    for (const dot of ranked) {
      const view = views.get(dot.id);
      if (!view) continue;
      view.chipText.text = String(dot.score);
      view.chipRing.visible = top > 0 && dot.score === top;
      view.chipTargetX = x;
      x += SCORE_DOT_RADIUS + SCORE_DOT_GAP_PX + view.chipText.width + SCORE_GAP_PX + SCORE_DOT_RADIUS;
    }
  };

  const spawnPlus = (id: string): void => {
    const dot = sim.dots.find((d) => d.id === id);
    const player = ctx.players.find((p) => p.id === id);
    if (!dot || !player) return;
    const text = new Text({
      text: t('plus'),
      style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: PLUS_FONT_PX, fill: player.color },
    });
    text.anchor.set(0.5, 1);
    const y = dot.pos.y - DOT_RADIUS - NICK_GAP_PX - NICK_FONT_PX;
    plusLayer.addChild(text);
    pluses.push({ text, x: dot.pos.x, y, ageS: 0 });
  };

  /** Анимации интерфейса идут от шагов симуляции: на паузе замирают вместе с игрой. */
  const animate = (dtS: number): void => {
    const slide = Math.min(1, dtS * HUD_SLIDE_RATE);
    for (const view of views.values()) {
      view.chipX += (view.chipTargetX - view.chipX) * slide;
      view.pop = Math.max(0, view.pop - dtS / HUD_POP_S);
    }
    timerPop = Math.max(0, timerPop - dtS / HUD_POP_S);
    for (let i = pluses.length - 1; i >= 0; i--) {
      const plus = pluses[i] as Plus;
      plus.ageS += dtS;
      if (plus.ageS < PLUS_S) continue;
      plus.text.destroy();
      pluses.splice(i, 1);
    }
    notice.update(dtS);
  };

  const clearFx = (): void => {
    for (const plus of pluses) plus.text.destroy();
    pluses.length = 0;
    notice.hide();
  };

  return {
    async init(context) {
      ctx = context;
      bots = new Set(ctx.players.filter((p) => p.kind === 'bot').map((p) => p.id));
      if (settingBool('throw', THROW_ENABLED_DEFAULT)) throwers = new Set(ctx.players.filter((p) => p.kind === 'phone').map((p) => p.id));
      const worldW = worldWidth(ctx.aspect);
      sim = createSim(
        ctx.players.map((p) => p.id),
        ctx.seed,
        {
          durationS: settingNumber('durationS', MATCH_S_DEFAULT),
          dashEnabled: settingBool('dash', DASH_ENABLED_DEFAULT),
          field: fieldFor(worldW),
        },
      );

      await loadFonts([`600 ${NICK_FONT_PX}px "${FONT_UI}"`, `700 ${TIMER_FONT_PX}px "${FONT_DISPLAY}"`]);
      // Экран целиком цвета поля: на любом соотношении сторон поле уходит в край.
      stage = await createStage(ctx.mount, worldW, WORLD_H, { background: cssVar('--surface') });
      const { world } = stage;
      const textColor = cssVar('--text');
      const field = sim.field;
      hudY = field.top + HUD_PAD_PX;

      world.addChild(drawField(), starsLayer);

      for (const player of ctx.players) {
        const node = new Container();
        const circle = new Graphics();
        const nick = new Text({
          text: '',
          style: { fontFamily: [FONT_UI, FONT_FALLBACK], fontWeight: '600', fontSize: NICK_FONT_PX, fill: textColor },
        });
        nick.anchor.set(0.5, 1);
        nick.y = -DOT_RADIUS - NICK_GAP_PX;
        node.addChild(circle, nick);
        world.addChild(node);

        const chip = new Container();
        const chipRing = new Graphics()
          .circle(0, 0, SCORE_DOT_RADIUS + LEADER_RING_GAP_PX)
          .stroke({ color: STAR_COLOR, width: LEADER_RING_PX });
        chipRing.visible = false;
        const chipDot = new Graphics();
        const chipText = new Text({
          text: '0',
          style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: SCORE_FONT_PX, fill: textColor },
        });
        chipText.anchor.set(0, 0.5);
        chipText.x = SCORE_DOT_RADIUS + SCORE_DOT_GAP_PX;
        chip.addChild(chipRing, chipDot, chipText);
        chip.y = hudY;

        const view: PlayerView = { node, circle, nick, chip, chipDot, chipRing, chipText, chipX: 0, chipTargetX: 0, pop: 0 };
        paintPlayer(view, player);
        views.set(player.id, view);
      }

      const hud = new Container();
      for (const view of views.values()) hud.addChild(view.chip);
      timerText = new Text({
        text: '',
        style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: TIMER_FONT_PX, fill: textColor },
      });
      timerText.anchor.set(1, 0.5);
      timerText.position.set(field.right - HUD_PAD_PX, hudY);
      hud.addChild(timerText);
      world.addChild(plusLayer, hud);

      // Фишки сразу на своих местах, без въезда.
      layoutScores();
      for (const view of views.values()) view.chipX = view.chipTargetX;

      notice = createNotice(
        {
          text: { fontFamily: [FONT_UI, FONT_FALLBACK], fontWeight: '600', fontSize: NOTICE_FONT_PX, fill: textColor },
          fill: cssVar('--bg'),
          fillAlpha: NOTICE_PLATE_ALPHA,
          padX: NOTICE_PAD_X,
          padY: NOTICE_PAD_Y,
        },
        worldW / 2,
        NOTICE_Y,
      );
      world.addChild(notice.view);
      notice.show(t('noticeStart'));
      pendingLeft = NOTICE_LEFT_AT_S.filter((s) => s < sim.timeLeftS);
    },

    update(dtS) {
      if (paused || ended) return;
      sim.step(dtS, (id) => (bots.has(id) ? botInput(sim, id) : throwers.has(id) ? IDLE_INPUT : ctx.input.read(id)));
      for (const id of sim.pickups) {
        ctx.fx(id, { vib: PICKUP_VIBRATE_MS, flash: STAR_COLOR });
        const view = views.get(id);
        if (view) view.pop = 1;
        spawnPlus(id);
      }
      tail.push({
        dots: sim.dots.map((d) => ({ x: d.pos.x, y: d.pos.y })),
        stars: sim.stars.map((s) => ({ ...s })),
        timeLeftS: sim.timeLeftS,
      });
      if (tail.length > TAIL_FRAMES) tail.shift();
      layoutScores();
      animate(dtS);
      const due = pendingLeft.find((s) => sim.timeLeftS <= s);
      if (due !== undefined) {
        pendingLeft = pendingLeft.filter((s) => s < due);
        notice.show(t('noticeLeft', { s: due }));
      }
      if (sim.over) endMatch();
    },

    replay() {
      // Проигрываем сохранённые кадры с частотой REPLAY_FRAME_HZ — на той же сцене, без симуляции.
      const frames = [...tail];
      clearFx();
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
                if (p) views.get(dot.id)?.node.position.set(p.x, p.y);
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
        const view = views.get(dot.id);
        if (!view) continue;
        view.node.position.set(
          dot.prev.x + (dot.pos.x - dot.prev.x) * alpha,
          dot.prev.y + (dot.pos.y - dot.prev.y) * alpha,
        );
        view.chip.x = view.chipX;
        view.chip.scale.set(1 + HUD_POP_SCALE * view.pop);
        view.chip.alpha = HUD_ALPHA + (1 - HUD_ALPHA) * view.pop;
      }
      for (const plus of pluses) {
        const k = plus.ageS / PLUS_S;
        plus.text.position.set(plus.x, plus.y - PLUS_RISE_PX * k);
        plus.text.alpha = 1 - k * k;
      }
      drawStars();

      const seconds = Math.ceil(sim.timeLeftS);
      const urgent = seconds <= TIMER_URGENT_S;
      if (seconds !== lastTimer) {
        lastTimer = seconds;
        timerText.text = t('timer', { s: seconds });
        timerText.style.fill = urgent ? STAR_COLOR : cssVar('--text');
        if (urgent) timerPop = 1;
      }
      timerText.alpha = urgent ? 1 : HUD_ALPHA;
      timerText.scale.set(1 + HUD_POP_SCALE * timerPop * timerPop);
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

    aim(playerId) {
      if (!throwers.has(playerId)) return undefined;
      return { cards: [{ id: 'star', icon: ICON_STAR, readyInS: sim.throwReadyInS(playerId), cooldownS: THROW_COOLDOWN_S }] };
    },

    action(playerId, payload) {
      const shot = parseAimShot(payload);
      if (shot && throwers.has(playerId)) sim.throwStar(playerId, shot);
    },

    status() {
      const total = Math.ceil(sim.timeLeftS);
      const time = `${Math.floor(total / SECONDS_PER_MINUTE)}:${String(total % SECONDS_PER_MINUTE).padStart(2, '0')}`;
      return t('status', { time });
    },

    updatePlayer(player) {
      const view = views.get(player.id);
      if (!view) return;
      paintPlayer(view, player);
    },

    dispose() {
      replayLoop?.stop();
      replayLoop = null;
      pluses.length = 0;
      stage?.destroy();
      views.clear();
    },
  };
}
