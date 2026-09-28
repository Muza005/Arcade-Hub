// Модуль Space War по контракту платформы (ARCADE_HUB_SPEC §16, «Модуль игры»).
// Б0: поле и счётчик FPS. Б1: корабли. Б2: астероиды, жизни, проигрыш. Стрельба и волны — следующие этапы.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { IDLE_INPUT } from '../../engine/input';
import { createRng } from '../../engine/rng';
import { createStage, cssVar, loadFonts, type Stage } from '../../engine/stage';
import type { GameContext, GameModule, GamePlayer, MatchResult } from '../../shared/game-manifest';
import { createTranslator } from '../../shared/i18n';
import {
  ACCENT,
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
import { bakeAsteroids, type AsteroidTextures } from '../render/asteroid-art';
import { createDebris, type Debris } from '../render/debris';
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
  const vfx = createRng(DEBRIS_VFX_SEED);
  let fpsText: Text;
  /** FPS считается по кадрам отрисовки: это замер производительности, не симуляция. */
  let frames = 0;
  let sampleStart = 0;

  /** Места — по тому, кто дольше продержался; очки появятся на этапе Б3. */
  const result = (): MatchResult => {
    const survived = (id: string): number => sim.pilots.get(id)?.diedAtS ?? sim.timeS;
    const sorted = [...ctx.players].sort((a, b) => survived(b.id) - survived(a.id));
    let place = 0;
    let prev = Number.NaN;
    return {
      gameId: spaceWarManifest.id,
      mode: ctx.mode,
      seed: ctx.seed,
      version: spaceWarManifest.version,
      rows: sorted.map((p, i) => {
        const s = survived(p.id);
        if (s !== prev) place = i + 1;
        prev = s;
        return { playerId: p.id, score: 0, place };
      }),
    };
  };

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
        sprite.texture = textures[rock.size][rock.shape] ?? textures[rock.size][0]!;
        rocksLayer.addChild(sprite);
        rockSprites.set(rock.id, sprite);
      }
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

      stage.world.addChild(field, rocksLayer, debris.view);
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
      stage.world.addChild(fpsText);
      sampleStart = performance.now();
    },

    update(dtS) {
      if (paused || ended) return;
      sim.step(dtS, (id) => (bots.has(id) ? IDLE_INPUT : ctx.input.read(id)));
      const { events } = sim;
      for (const b of events.breaks) debris.burst(b.x, b.y, DEBRIS_COUNT[b.size], ASTEROID_COLOR, vfx.next);
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
      }
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
        // Мигание от времени неуязвимости: на паузе замирает вместе с игрой.
        view.setBlink(pilot.invulnS > 0 && Math.floor(pilot.invulnS * INVULN_BLINK_HZ * 2) % 2 === 0);
      }
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
      const rows = result().rows;
      return {
        awards: [],
        table: {
          columns: [t('colTime')],
          rows: rows.map((r) => ({
            playerId: r.playerId,
            cells: [formatTime(sim.pilots.get(r.playerId)?.diedAtS ?? sim.timeS)],
          })),
        },
      };
    },

    updatePlayer(player: GamePlayer) {
      views.get(player.id)?.paint(player.color, player.nick);
      colors.set(player.id, player.color);
    },

    dispose() {
      if (textures) for (const list of Object.values(textures)) for (const tex of list) tex.destroy(true);
      stage?.destroy();
      views.clear();
      rockSprites.clear();
      spareSprites.length = 0;
    },
  };
}
