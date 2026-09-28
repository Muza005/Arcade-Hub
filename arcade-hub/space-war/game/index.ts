// Модуль Space War по контракту платформы (ARCADE_HUB_SPEC §16, «Модуль игры»).
// Б0: поле и FPS. Б1: корабли. Б2: астероиды, жизни, проигрыш. Б3: Power, патроны, множитель, очки. Волны — Б8.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { IDLE_INPUT } from '../../engine/input';
import { createRng } from '../../engine/rng';
import { createStage, cssVar, loadFonts, type Stage } from '../../engine/stage';
import { rankByScore, type GameContext, type GameModule, type GamePlayer, type MatchResult } from '../../shared/game-manifest';
import { createTranslator } from '../../shared/i18n';
import {
  ACCENT,
  AMMO_MAX,
  BULLET_LENGTH,
  BULLET_LINE_PX,
  CHIP_COUNT,
  CRACK_GLOW,
  DEBRIS_COUNT,
  DEBRIS_VFX_SEED,
  FIELD_INSET,
  FIELD_LINE_ALPHA,
  FIELD_LINE_PX,
  FIELD_RADIUS,
  FLASH_EXPLODE,
  FLASH_HIT,
  FPS_ALPHA,
  FPS_FONT_PX,
  FPS_PAD_PX,
  FPS_SAMPLE_S,
  HUD_PAD_PX,
  INVULN_BLINK_HZ,
  NICK_FONT_PX,
  SHIP_LIVES,
  VIBRATE_EXPLODE_MS,
  VIBRATE_HIT_MS,
  WORLD_H,
  ASTEROID_COLOR,
  worldWidth,
} from '../config';
import { strings } from '../i18n/strings';
import { spaceWarManifest } from '../manifest';
import { bakeAsteroids, rockState, type AsteroidTextures } from '../render/asteroid-art';
import { createDebris, type Debris } from '../render/debris';
import { createMultFx, type MultFx } from '../render/mult-fx';
import { createScoreHud, type ScoreHud } from '../render/score-hud';
import { createShipView, type ShipView } from '../render/ship-view';
import { angleDelta } from './ship';
import { createSim, type Sim } from './sim';

const t = createTranslator(strings);

const FONT_DISPLAY = 'Unbounded';
const FONT_UI = 'Golos Text';
const FONT_FALLBACK = 'sans-serif';
const MS_PER_S = 1000;
const SECONDS_PER_MINUTE = 60;
/** Взрыв корабля — осколков как от крупного камня, вдвое больше. */
const EXPLOSION_K = 2;

const formatTime = (seconds: number): string => {
  const total = Math.floor(seconds);
  return t('time', { m: Math.floor(total / SECONDS_PER_MINUTE), s: String(total % SECONDS_PER_MINUTE).padStart(2, '0') });
};

export function createSpaceWarGame(): GameModule {
  let ctx: GameContext;
  let stage: Stage;
  let ended = false;
  let paused = false;
  let sim: Sim;
  /** Боты — этап Б6; до тех пор без ввода. */
  let bots = new Set<string>();
  const views = new Map<string, ShipView>();
  const colors = new Map<string, string>();
  let textures: AsteroidTextures;
  const rocksLayer = new Container();
  /** Спрайт камня по id; спрайты переиспользуются. */
  const rockSprites = new Map<number, Sprite>();
  const spareSprites: Sprite[] = [];
  let debris: Debris;
  let multFx: MultFx;
  let scoreHud: ScoreHud;
  const bulletsView = new Graphics();
  const vfx = createRng(DEBRIS_VFX_SEED);
  let fpsText: Text;
  /** FPS считается по кадрам отрисовки: это замер производительности, не симуляция. */
  let frames = 0;
  let sampleStart = 0;

  /** Места — по итоговым очкам (с бонусом за оставшиеся жизни). */
  const result = (): MatchResult => ({
    gameId: spaceWarManifest.id,
    mode: ctx.mode,
    seed: ctx.seed,
    version: spaceWarManifest.version,
    rows: rankByScore(ctx.players.map((p) => ({ playerId: p.id, score: sim.finalScore(p.id) }))),
  });
  const survivedS = (id: string): number => sim.pilots.get(id)?.diedAtS ?? sim.timeS;

  const endMatch = (): void => {
    if (ended) return;
    ended = true;
    ctx.end(result());
  };

  const syncRocks = (alpha: number): void => {
    const seen = new Set<number>();
    for (const rock of sim.asteroids) {
      seen.add(rock.id);
      let sprite = rockSprites.get(rock.id);
      if (!sprite) {
        sprite = spareSprites.pop() ?? new Sprite();
        sprite.anchor.set(0.5);
        rocksLayer.addChild(sprite);
        rockSprites.set(rock.id, sprite);
      }
      const shape = textures[rock.size][rock.shape] ?? textures[rock.size][0]!;
      sprite.texture = shape[rockState(rock.hp, rock.maxHp)] ?? shape[0]!;
      sprite.position.set(rock.prev.x + (rock.pos.x - rock.prev.x) * alpha, rock.prev.y + (rock.pos.y - rock.prev.y) * alpha);
      sprite.rotation = rock.angle;
    }
    for (const [id, sprite] of rockSprites) {
      if (seen.has(id)) continue;
      rockSprites.delete(id);
      sprite.removeFromParent();
      spareSprites.push(sprite);
    }
  };

  return {
    async init(context) {
      ctx = context;
      const worldW = worldWidth(ctx.aspect);
      bots = new Set(ctx.players.filter((p) => p.kind === 'bot').map((p) => p.id));
      sim = createSim(
        ctx.players.map((p) => p.id),
        worldW,
        ctx.seed,
      );
      await loadFonts([`700 ${FPS_FONT_PX}px "${FONT_DISPLAY}"`, `600 ${NICK_FONT_PX}px "${FONT_UI}"`]);
      stage = await createStage(ctx.mount, worldW, WORLD_H, { background: cssVar('--bg') });
      textures = bakeAsteroids(stage.app.renderer);
      debris = createDebris();
      multFx = createMultFx(vfx);

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

      stage.world.addChild(field, multFx.view, rocksLayer, bulletsView, debris.view);
      const textColor = cssVar('--text');
      for (const player of ctx.players) {
        const view = createShipView(textColor);
        view.paint(player.color, player.nick);
        view.setBounds(sim.bounds);
        view.setLives(SHIP_LIVES, SHIP_LIVES);
        views.set(player.id, view);
        colors.set(player.id, player.color);
        stage.world.addChild(view.node);
      }
      scoreHud = createScoreHud(ctx.players, FIELD_INSET + HUD_PAD_PX, FIELD_INSET + HUD_PAD_PX, textColor);
      stage.world.addChild(scoreHud.view, fpsText);
      sampleStart = performance.now();
    },

    update(dtS) {
      if (paused || ended) return;
      sim.step(dtS, (id) => (bots.has(id) ? IDLE_INPUT : ctx.input.read(id)));
      const { events } = sim;
      for (const b of events.breaks) debris.burst(b.x, b.y, DEBRIS_COUNT[b.size], ASTEROID_COLOR, vfx.next);
      for (const c of events.chips) debris.burst(c.x, c.y, CHIP_COUNT, CRACK_GLOW, vfx.next);
      for (const id of events.hits) {
        const pilot = sim.pilots.get(id);
        if (pilot?.alive) ctx.fx(id, { vib: VIBRATE_HIT_MS, flash: FLASH_HIT });
      }
      for (const id of events.deaths) {
        const pilot = sim.pilots.get(id);
        if (pilot) {
          const color = colors.get(id) ?? ACCENT;
          debris.burst(pilot.ship.pos.x, pilot.ship.pos.y, DEBRIS_COUNT.large * EXPLOSION_K, color, vfx.next);
        }
        ctx.fx(id, { vib: VIBRATE_EXPLODE_MS, flash: FLASH_EXPLODE });
        multFx.drop(id);
      }
      for (const pilot of sim.pilots.values()) {
        if (!pilot.alive) continue;
        const { id, pos } = pilot.ship;
        multFx.track(id, pos.x, pos.y, pilot.mult, colors.get(id) ?? ACCENT, dtS);
        views.get(id)?.update(dtS);
      }
      multFx.update(dtS);
      scoreHud.update(
        ctx.players.map((p) => ({ id: p.id, score: sim.pilots.get(p.id)?.score ?? 0 })),
        dtS,
      );
      debris.update(dtS);
      if (sim.over) endMatch();
    },

    render(alpha) {
      syncRocks(alpha);
      for (const ship of sim.ships) {
        const view = views.get(ship.id);
        const pilot = sim.pilots.get(ship.id);
        if (!view || !pilot) continue;
        view.node.visible = pilot.alive;
        if (!pilot.alive) continue;
        view.set(
          ship.prev.x + (ship.pos.x - ship.prev.x) * alpha,
          ship.prev.y + (ship.pos.y - ship.prev.y) * alpha,
          ship.prevAngle + angleDelta(ship.prevAngle, ship.angle) * alpha,
          ship.thrust,
        );
        view.setLives(pilot.lives, SHIP_LIVES);
        view.setMult(pilot.mult);
        // Мигание от времени неуязвимости: на паузе замирает вместе с игрой.
        view.setBlink(pilot.invulnS > 0 && Math.floor(pilot.invulnS * INVULN_BLINK_HZ * 2) % 2 === 0);
      }
      bulletsView.clear();
      for (const b of sim.bullets) {
        const x = b.prev.x + (b.pos.x - b.prev.x) * alpha;
        const y = b.prev.y + (b.pos.y - b.prev.y) * alpha;
        const k = BULLET_LENGTH / (Math.hypot(b.vel.x, b.vel.y) || 1);
        bulletsView
          .moveTo(x, y)
          .lineTo(x - b.vel.x * k, y - b.vel.y * k)
          .stroke({ color: colors.get(b.owner) ?? ACCENT, width: BULLET_LINE_PX, cap: 'round' });
      }
      multFx.draw();
      scoreHud.draw();
      debris.draw();

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

    results() {
      return {
        awards: [],
        table: {
          columns: [t('colScore'), t('colTime')],
          rows: result().rows.map((r) => ({
            playerId: r.playerId,
            cells: [String(r.score), formatTime(survivedS(r.playerId))],
          })),
        },
      };
    },

    mainButton(playerId) {
      // Power: число патронов и ободок накопления следующего; полный запас — полный ободок.
      const pilot = sim.pilots.get(playerId);
      if (!pilot) return undefined;
      return { value: pilot.ammo, progress: pilot.ammo >= AMMO_MAX ? 1 : pilot.ammoProgress };
    },

    updatePlayer(player: GamePlayer) {
      views.get(player.id)?.paint(player.color, player.nick);
      colors.set(player.id, player.color);
      scoreHud.setColor(player.id, player.color);
    },

    dispose() {
      if (textures) for (const shapes of Object.values(textures)) for (const states of shapes) for (const tex of states) tex.destroy(true);
      stage?.destroy();
      views.clear();
      rockSprites.clear();
      spareSprites.length = 0;
    },
  };
}
