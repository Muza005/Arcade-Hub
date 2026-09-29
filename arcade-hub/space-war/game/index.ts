// Модуль Space War по контракту платформы (ARCADE_HUB_SPEC §16, «Модуль игры»).
// Б0: поле и FPS. Б1: корабли. Б2: астероиды, жизни, проигрыш. Б3: Power, патроны, множитель, очки.
// Б4: звёзды, частицы, тряска, вспышки, hit-stop, bloom, аберрация, три уровня качества. Волны — Б8.
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { createRng } from '../../engine/rng';
import { createStage, cssVar, loadFonts, type Stage } from '../../engine/stage';
import { rankByScore, type GameContext, type GameModule, type GamePlayer, type MatchResult } from '../../shared/game-manifest';
import { readHubSettings } from '../../shared/hub-settings';
import { createTranslator } from '../../shared/i18n';
import {
  ACCENT,
  AMMO_MAX,
  ASTEROID_COLOR,
  BLOOM_STRENGTH,
  BULLET_LENGTH,
  BULLET_LINE_PX,
  CHIP_COUNT,
  CHROMA_HIT_PX,
  CRACK_GLOW,
  DEBRIS_COUNT,
  DEBRIS_S,
  DEBRIS_SPEED,
  DEBRIS_VFX_SEED,
  FIELD_INSET,
  HULL_BOT,
  HULL_DEFAULT,
  HULLS,
  type Hull,
  FIELD_LINE_ALPHA,
  FIELD_LINE_PX,
  FIELD_RADIUS,
  FLASH_DEATH_ALPHA,
  FLASH_EXPLODE,
  FLASH_HIT,
  FLASH_HIT_ALPHA,
  FPS_ALPHA,
  FPS_FONT_PX,
  FPS_PAD_PX,
  FPS_SAMPLE_S,
  HUD_PAD_PX,
  INVULN_BLINK_HZ,
  MULT_SPARK_S,
  MULT_FONT_PX,
  PARTICLES_MAX,
  QUALITY_CHOICES,
  SHAKE_BREAK_LARGE,
  SHAKE_DEATH,
  SHAKE_HIT,
  SHIP_LIVES,
  SPARK_SPEED,
  VIBRATE_EXPLODE_MS,
  VIBRATE_HIT_MS,
  BOT_LEVEL_DEFAULT,
  BOT_LEVELS,
  WORLD_H,
  worldWidth,
  worldZoom,
} from '../config';
import { strings } from '../i18n/strings';
import { spaceWarManifest } from '../manifest';
import { bakeAtlas, rockState, type Atlas } from '../render/atlas';
import { createCamera, type Camera } from '../render/camera';
import { BloomFilter, createChromaFilter, createStarsFilter, type ChromaFilter, type StarsFilter } from '../render/filters';
import { createMultFx, type MultFx } from '../render/mult-fx';
import { createParticles, type Particles } from '../render/particles';
import { createQuality, type Level, type QualityControl } from '../render/quality';
import { createScoreHud, type ScoreHud } from '../render/score-hud';
import { createShipView, type ShipView } from '../render/ship-view';
import { angleDelta } from './ship';
import { createBots, type Bots } from './bots';
import { createSim, type Sim } from './sim';

const t = createTranslator(strings);

const FONT_DISPLAY = 'Unbounded';
const FONT_FALLBACK = 'sans-serif';
const MS_PER_S = 1000;
const PERCENT = 100;
const SECONDS_PER_MINUTE = 60;
/** Взрыв корабля — осколков как от крупного камня, вдвое больше, и столько же искр. */
const EXPLOSION_K = 2;
/** Пролёт вплотную — несколько искр в цвет игрока. */
const NEAR_SPARKS = 4;

/** Корпус игрока из лобби; у ботов — один на всех. */
const hullOf = (player: GamePlayer): Hull => {
  if (player.kind === 'bot') return HULL_BOT;
  const v = player.fields?.hull;
  return HULLS.find((h) => h === v) ?? HULL_DEFAULT;
};

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
  /** Кого ведёт мозг ботов (SPACE_WAR_SPEC §8), а не ввод платформы. */
  let bots = new Set<string>();
  let brains: Bots;
  const views = new Map<string, ShipView>();
  const colors = new Map<string, string>();
  let atlas: Atlas;

  // Сцена: звёзды (свой сдвиг параллакса) → трясущаяся сцена → счёт и вспышка поверх.
  const scene = new Container();
  const rocksLayer = new Container();
  const bulletsView = new Graphics();
  bulletsView.blendMode = 'add';
  const shipsLayer = new Container();
  /** Слой свечения: под bloom — только неон (след, снаряды, корабли, частицы); ореол камней запечён в атлас. */
  const glowLayer = new Container();
  const tagsLayer = new Container();
  /** Спрайт камня по id; спрайты переиспользуются. */
  const rockSprites = new Map<number, Sprite>();
  const spareSprites: Sprite[] = [];
  const vfx = createRng(DEBRIS_VFX_SEED);
  let particles: Particles;
  let multFx: MultFx;
  let scoreHud: ScoreHud;
  let camera: Camera;
  let quality: QualityControl;
  let stars: StarsFilter | null = null;
  let bloom: BloomFilter | null = null;
  let chroma: ChromaFilter | null = null;
  let bloomK = 0;
  /** Аберрация разрешена качеством; включается только на время импульса. */
  let chromaOn = false;
  /** Часы эффектов: идут по шагам симуляции, на паузе стоят. */
  let fxTimeS = 0;
  let lastFrameAt = 0;
  let fpsText: Text | null = null;
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

  /** Качество: лимит частиц, искры множителя, bloom (со среднего), аберрация (только высокое). */
  const applyQuality = (level: Level): void => {
    particles.setLimit(PARTICLES_MAX[level]);
    multFx.sparks = level !== 'low';
    glowLayer.filters = bloom && level !== 'low' && bloomK > 0 ? [bloom] : [];
    chromaOn = chroma !== null && level === 'high';
  };

  const shards = (x: number, y: number, count: number, color: string): void =>
    particles.burst(x, y, { texture: atlas.shard, color, count, speed: DEBRIS_SPEED, life: DEBRIS_S, aligned: true });
  const sparks = (x: number, y: number, count: number, color: string, life: number): void => {
    if (quality.level !== 'low') particles.burst(x, y, { texture: atlas.spark, color, count, speed: [0, SPARK_SPEED * 3], life });
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
      const shape = atlas.asteroids[rock.size][rock.shape] ?? atlas.asteroids[rock.size][0]!;
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

  /** События шага → частицы, тряска, вспышки и обратная связь на телефоне. */
  const react = (): void => {
    const { events } = sim;
    for (const b of events.breaks) {
      shards(b.x, b.y, DEBRIS_COUNT[b.size], ASTEROID_COLOR);
      if (b.size === 'large') camera.shake(SHAKE_BREAK_LARGE);
    }
    for (const c of events.chips) sparks(c.x, c.y, CHIP_COUNT, CRACK_GLOW, DEBRIS_S);
    for (const n of events.near) sparks(n.x, n.y, NEAR_SPARKS, colors.get(n.id) ?? ACCENT, DEBRIS_S);
    for (const id of events.hits) {
      camera.shake(SHAKE_HIT);
      camera.flashScreen(FLASH_HIT, FLASH_HIT_ALPHA);
      camera.pulseChroma();
      if (sim.pilots.get(id)?.alive) ctx.fx(id, { vib: VIBRATE_HIT_MS, flash: FLASH_HIT });
    }
    for (const id of events.deaths) {
      const pilot = sim.pilots.get(id);
      const color = colors.get(id) ?? ACCENT;
      if (pilot) {
        const { x, y } = pilot.ship.pos;
        shards(x, y, DEBRIS_COUNT.large * EXPLOSION_K, color);
        sparks(x, y, DEBRIS_COUNT.large * EXPLOSION_K, color, MULT_SPARK_S[MULT_SPARK_S.length - 1] ?? 1);
      }
      camera.shake(SHAKE_DEATH);
      camera.flashScreen(FLASH_EXPLODE, FLASH_DEATH_ALPHA);
      ctx.fx(id, { vib: VIBRATE_EXPLODE_MS, flash: FLASH_EXPLODE });
      multFx.drop(id);
    }
  };

  return {
    async init(context) {
      ctx = context;
      // Камера отъезжает на шаг за каждые 2 игрока: мир больше, пропорции те же (SPACE_WAR_SPEC §9).
      const zoom = worldZoom(ctx.players.length);
      const worldW = worldWidth(ctx.aspect) * zoom;
      const worldH = WORLD_H * zoom;
      const settings = readHubSettings();
      bots = new Set(ctx.players.filter((p) => p.kind === 'bot').map((p) => p.id));
      sim = createSim(
        ctx.players.map((p) => p.id),
        worldW,
        ctx.seed,
        worldH,
      );
      const botLevel = BOT_LEVELS.find((l) => l === ctx.settings.botLevel) ?? BOT_LEVEL_DEFAULT;
      brains = createBots(sim, [...bots], botLevel, ctx.seed);
      await loadFonts([`700 ${FPS_FONT_PX}px "${FONT_DISPLAY}"`, `700 ${MULT_FONT_PX}px "${FONT_DISPLAY}"`]);
      stage = await createStage(ctx.mount, worldW, worldH, { background: cssVar('--bg') });
      atlas = bakeAtlas(stage.app.renderer);
      particles = createParticles(vfx);
      multFx = createMultFx(particles, atlas.spark);
      camera = createCamera(settings, worldW, worldH, vfx);
      // Качество из лобби; «Авто» — как в настройках хаба (там тоже может быть «Авто» — адаптивное).
      const lobbyQuality = QUALITY_CHOICES.find((q) => q === ctx.settings.quality) ?? 'auto';
      quality = createQuality(lobbyQuality === 'auto' ? settings.quality : lobbyQuality);
      bloomK = (BLOOM_STRENGTH * settings.bloom) / PERCENT;

      // Шейдеры — только на WebGL; на другом рендерере игра идёт без них.
      const webgl = stage.app.renderer.name === 'webgl';
      if (webgl) {
        stars = createStarsFilter();
        bloom = new BloomFilter();
        bloom.strength = bloomK;
        chroma = createChromaFilter();
      }

      const starsSprite = new Sprite(Texture.WHITE);
      starsSprite.width = worldW;
      starsSprite.height = worldH;
      starsSprite.tint = cssVar('--bg');
      if (stars) starsSprite.filters = [stars.filter];

      const field = new Graphics()
        .roundRect(FIELD_INSET, FIELD_INSET, worldW - FIELD_INSET * 2, worldH - FIELD_INSET * 2, FIELD_RADIUS)
        .stroke({ color: ACCENT, width: FIELD_LINE_PX, alpha: FIELD_LINE_ALPHA });

      const textColor = cssVar('--text');
      for (const player of ctx.players) {
        const view = createShipView(textColor);
        view.paint(player.color, hullOf(player));
        view.setBounds(sim.bounds);
        view.setLives(SHIP_LIVES, SHIP_LIVES);
        views.set(player.id, view);
        colors.set(player.id, player.color);
        shipsLayer.addChild(view.node);
        tagsLayer.addChild(view.tag);
      }
      glowLayer.addChild(multFx.view, bulletsView, shipsLayer, particles.view);
      scene.addChild(field, rocksLayer, glowLayer, tagsLayer);

      // Счёт и FPS не уменьшаются вместе с отъездом камеры: свой слой в масштабе zoom.
      const hud = new Container();
      hud.scale.set(zoom);
      scoreHud = createScoreHud(ctx.players, FIELD_INSET + HUD_PAD_PX, FIELD_INSET + HUD_PAD_PX, textColor);
      hud.addChild(scoreHud.view);
      stage.world.addChild(starsSprite, scene, hud, camera.flash);
      // Счётчик FPS — по переключателю в настройках хаба (или ?fps в адресе).
      if (settings.showFps || new URLSearchParams(location.search).has('fps')) {
        fpsText = new Text({
          text: '',
          style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: FPS_FONT_PX, fill: textColor },
        });
        fpsText.alpha = FPS_ALPHA;
        fpsText.anchor.set(1, 0);
        fpsText.position.set(worldW / zoom - FIELD_INSET - FPS_PAD_PX, FIELD_INSET + FPS_PAD_PX);
        hud.addChild(fpsText);
      }
      applyQuality(quality.level);
      sampleStart = lastFrameAt = performance.now();
    },

    update(dtS) {
      if (paused || ended) return;
      sim.step(dtS, (id) => (bots.has(id) ? brains.input(id) : ctx.input.read(id)));
      react();
      camera.update(dtS);
      // Hit-stop: мир на мгновение замер — замирают и частицы, и следы; тряска и вспышка идут.
      if (sim.frozen) return;
      fxTimeS += dtS;
      for (const pilot of sim.pilots.values()) {
        if (!pilot.alive) continue;
        const { id, pos } = pilot.ship;
        multFx.track(id, pos.x, pos.y, pilot.mult, colors.get(id) ?? ACCENT, dtS);
        views.get(id)?.update(dtS);
      }
      multFx.update(dtS);
      particles.update(dtS);
      scoreHud.update(
        ctx.players.map((p) => ({ id: p.id, score: sim.pilots.get(p.id)?.score ?? 0 })),
        dtS,
      );
      if (sim.over) endMatch();
    },

    render(frameAlpha) {
      // В hit-stop шаги не двигают мир — рисуем последний кадр без интерполяции.
      const alpha = sim.frozen ? 1 : frameAlpha;
      scene.position.set(camera.offsetX, camera.offsetY);
      syncRocks(alpha);
      for (const ship of sim.ships) {
        const view = views.get(ship.id);
        const pilot = sim.pilots.get(ship.id);
        if (!view || !pilot) continue;
        view.setVisible(pilot.alive);
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
      stars?.set(fxTimeS, stage.world.scale.x, -camera.offsetX, -camera.offsetY);
      const pulse = chromaOn && chroma && camera.chroma > 0 ? chroma : null;
      pulse?.set(CHROMA_HIT_PX * camera.chroma);
      const worldFilters = pulse ? [pulse.filter] : [];
      if ((stage.world.filters?.length ?? 0) !== worldFilters.length) stage.world.filters = worldFilters;

      const now = performance.now();
      if (!paused && quality.sample(now - lastFrameAt)) applyQuality(quality.level);
      lastFrameAt = now;
      if (fpsText) {
        frames++;
        const elapsedS = (now - sampleStart) / MS_PER_S;
        if (elapsedS >= FPS_SAMPLE_S) {
          fpsText.text = t('fps', { n: Math.round(frames / elapsedS) });
          frames = 0;
          sampleStart = now;
        }
      }
      stage.render();
    },

    pause() {
      paused = true;
    },

    resume() {
      paused = false;
      frames = 0;
      sampleStart = lastFrameAt = performance.now();
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
      views.get(player.id)?.paint(player.color, hullOf(player));
      colors.set(player.id, player.color);
      scoreHud.setColor(player.id, player.color);
    },

    dispose() {
      stage?.destroy();
      atlas?.destroy();
      views.clear();
      rockSprites.clear();
      spareSprites.length = 0;
    },
  };
}
