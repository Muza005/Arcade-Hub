// Модуль Space War по контракту платформы (ARCADE_HUB_SPEC §16, «Модуль игры»).
// Б0: поле и FPS. Б1: корабли. Б2: астероиды, жизни, проигрыш. Б3: Power, патроны, множитель, очки.
// Б4: звёзды, частицы, тряска, вспышки, hit-stop, bloom, аберрация, три уровня качества. Б8: волны и осложнения. Б9: боссы.
// Б10: призрак, осколки, воскрешение, саботажник (раскладка «прицел» на телефоне). Б11: усиления. Б12: звук. Б13: итоги (повтор, награды, полоски волн), метки записи.
import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { createNotice, type Notice } from '../../engine/notice';
import { createRng } from '../../engine/rng';
import { FixedLoop } from '../../engine/loop';
import { createStage, cssVar, loadFonts, type Stage } from '../../engine/stage';
import { FIXED_STEP_HZ } from '../../shared/config';
import { rankByScore, type Award, type GameContext, type GameModule, type GamePlayer, type MatchResult, type ReplayMark } from '../../shared/game-manifest';
import { parseAimShot } from '../../shared/aim';
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
  BREAK_SPARKS_K,
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
  MODE_DEFAULT,
  MODES,
  RAM_SPARKS,
  SHAKE_RAM,
  VIBRATE_RAM_MS,
  type Mode,
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
  SHAKE_MAX_PX,
  SHIP_LIVES,
  SPARK_SPEED,
  VIBRATE_EXPLODE_MS,
  VIBRATE_HIT_MS,
  BOT_LEVEL_DEFAULT,
  BOT_LEVELS,
  DIFFICULTIES,
  DIFFICULTY_DEFAULT,
  HUD_ALPHA,
  NOTICE_FONT_PX,
  NOTICE_PAD_X,
  NOTICE_PAD_Y,
  NOTICE_PLATE_ALPHA,
  NOTICE_Y,
  SCORE_BOSS,
  SCORE_WAVE,
  BOSS_BAR_H,
  BOSS_BAR_W,
  BOSS_BAR_SEGMENTS,
  BOSS_BAR_TRAIL_S,
  BOSS_COLORS,
  BOSS_FLASH_S,
  BOSS_HINT_FONT_PX,
  BOSS_HINT_S,
  FORTRESS_TINT,
  ALIEN_BEAM,
  ALIEN_BODY,
  BOMB_FUSE_HZ,
  BOMB_FUSE_TINT,
  BOOM_COLOR,
  BOOM_RADIUS,
  BOOM_SPARKS,
  PHANTOM_ALPHA,
  PHANTOM_FADE_S,
  PHANTOM_REVEAL_IN_S,
  PHANTOM_REVEAL_OUT_S,
  PHANTOM_REVEAL_S,
  PHANTOM_HIDE_S,
  PHANTOM_SHOW_S,
  BOSS_EXPLOSION_SHARDS,
  SHAKE_BOSS_DEATH,
  SWARM_TINT,
  BOMB_BLAST_RADIUS,
  GHOST_S,
  SAB_KINDS,
  SHAKE_BOMB,
  FREEZE_TINT,
  OVERLOAD_COLOR,
  OVERLOAD_FADE_S,
  POWERUP_COLOR,
  SHIELD_BLINK_S,
  LOW_LIVES,
  REPLAY_SLOW,
  REPLAY_TAIL_S,
  ROCK_BOUNCE_DEFAULT,
  POWERUP_RATE_DEFAULT,
  POWERUP_RATE_KEYS,
  POWERUP_RATES,
  VIBRATE_PICKUP,
  AMMO_Y,
  DOUBLE_SPARK_PER_S,
  POWERUP_DROP_SPARKS,
  VIBRATE_HIT_MS as VIBRATE_GHOST_MS,
  WAVE_HUD_FONT_PX,
  WAVE_LIMIT,
  WORLD_H,
  worldWidth,
  fieldZoom,
} from '../config';
import { createGameAudio, type GameAudio, type Sfx } from '../audio/sound';
import { hullSvg } from '../hull-shapes';
import { pluralForm } from '../i18n/plural';
import { strings } from '../i18n/strings';
import { spaceWarManifest } from '../manifest';
import { bakeAtlas, rockState, type Atlas } from '../render/atlas';
import { createCamera, type Camera } from '../render/camera';
import { createAfterlifeView, type AfterlifeView } from '../render/afterlife-view';
import { createBossView, type BossView } from '../render/boss-view';
import { mixColor } from '../render/color';
import { createPowerupView, loadPowerupIcons, type PowerupView } from '../render/powerup-view';
import { createAlienView, createCurrentView, type AlienView, type CurrentView } from '../render/alien-view';
import { createDarkness, type Darkness } from '../render/darkness';
import { createVortexFx, type VortexFx } from '../render/vortex-fx';
import { BloomFilter, createChromaFilter, createStarsFilter, type ChromaFilter, type StarsFilter } from '../render/filters';
import { createMultFx, type MultFx } from '../render/mult-fx';
import { createParticles, type Particles } from '../render/particles';
import { createQuality, type Level, type QualityControl } from '../render/quality';
import { createScoreHud, type ScoreHud } from '../render/score-hud';
import { createShipView, type ShipView } from '../render/ship-view';
import { angleDelta } from './ship';
import { createBots, type Bots } from './bots';
import { pickAwards, type AwardValue } from './awards';
import { createSim, type Pilot, type Sim } from './sim';
import { waveLengthS } from './waves';
import { snapshot } from './tail';

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
/** Искры «×2 пули» — по ширине полосок патронов. */
const AMMO_SPARK_SPREAD = 34;
/** Взрыв бомбы — кольцо искр. */
const BLAST_SPARKS = 36;

/** Корпус игрока из лобби; у ботов — один на всех. */
const hullOf = (player: GamePlayer): Hull => {
  if (player.kind === 'bot') return HULL_BOT;
  const v = player.fields?.hull;
  return HULLS.find((h) => h === v) ?? HULL_DEFAULT;
};

/** Иконки карточек саботажника (цвет — currentColor): камень — неровный многоугольник, бомба — круг с фитилём. */
const SAB_ICONS = {
  rock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 3l7-1 6 5 1 7-4 7-8 1-5-5-1-8z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  bomb: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="11" cy="14" r="7.5" fill="currentColor"/><path d="M15.5 8.5l3-3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="20" cy="4" r="1.8" fill="currentColor"/></svg>',
} as const;
const isSabKind = (v: string): v is (typeof SAB_KINDS)[number] => (SAB_KINDS as readonly string[]).includes(v);

const formatTime = (seconds: number): string => {
  const total = Math.floor(seconds);
  return t('time', { m: Math.floor(total / SECONDS_PER_MINUTE), s: String(total % SECONDS_PER_MINUTE).padStart(2, '0') });
};
/** Обратный отсчёт: 0:01 держится до самого конца, 0:00 не показывается. */
const formatLeft = (seconds: number): string => formatTime(Math.ceil(Math.max(0, seconds)));

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
  let notice: Notice;
  let waveText: Text;
  let darkness: Darkness;
  let vortexFx: VortexFx;
  let bossView: BossView;
  let afterView: AfterlifeView;
  let powerupView: PowerupView;
  let alienView: AlienView;
  let currentView: CurrentView;
  let audio: GameAudio | null = null;
  /** Последние шаги — для замедленного повтора в итогах; метки волн и гибелей — для шкалы записи. */
  const tail: Sim[] = [];
  const TAIL_STEPS = REPLAY_TAIL_S * FIXED_STEP_HZ;
  const marks: ReplayMark[] = [];
  /** Идёт повтор в итогах: телефоны не вибрируют, живая симуляция отложена. */
  let replaying = false;
  let replayLoop: FixedLoop | null = null;
  /** Вибрация и вспышка на телефоне — только во время матча, не в повторе. */
  const buzz: GameContext['fx'] = (id, fx) => {
    if (!replaying) ctx.fx(id, fx);
  };
  const BREAK_SFX: Record<'small' | 'medium' | 'large', Sfx> = { small: 'breakSmall', medium: 'breakMedium', large: 'breakLarge' };
  /** Ступень множителя поднимает свист сближения. */
  const NEAR_PITCH_STEP = 0.12;
  let ghostTotalS = GHOST_S;
  const phones = new Set<string>();
  let bossBar: Graphics;
  /** Подсказка «как победить» под полоской в начале волны босса. */
  let bossHint: Text;
  let bossHintS = 0;
  /** Белый след отнятой прочности и вспышка полоски от попадания. */
  let barTrail = 1;
  let barFlashS = 0;
  let barHits = 0;
  let waveTextY = 0;
  /** Цель этой волны уже повержена — вместо «волна пройдена» остаётся уведомление о победе. */
  let bossDownWave = 0;
  let bg = '';
  const holes: Array<{ x: number; y: number }> = [];
  let frames = 0;
  let sampleStart = 0;

  let mode: Mode = MODE_DEFAULT;
  /** Команда игрока в командном режиме — его цвет на старте матча (§5 «Режимы»). */
  const teamOf = new Map<string, string>();
  const teamTotal = (team: string): number =>
    ctx.players.filter((p) => teamOf.get(p.id) === team).reduce((sum, p) => sum + sim.finalScore(p.id), 0);

  /** Места по режиму: соревнование — личные очки; кооператив — одна общая победа с общим счётом;
   *  командное — очки команды, у всех её игроков одно место. Итоговые очки — с бонусом за жизни. */
  const result = (): MatchResult => {
    // С результатом — до какой волны дошли (строка «Волна 14 · лучший — …» на карточке игры).
    const base = {
      gameId: spaceWarManifest.id,
      mode: ctx.mode,
      seed: ctx.seed,
      version: spaceWarManifest.version,
      meta: { wave: sim.waves.wave },
    };
    if (mode === 'coop') {
      const total = ctx.players.reduce((sum, p) => sum + sim.finalScore(p.id), 0);
      return { ...base, rows: ctx.players.map((p) => ({ playerId: p.id, score: total, place: 1 })) };
    }
    if (mode === 'teams') {
      const teams = [...new Set(teamOf.values())];
      const ranked = rankByScore(teams.map((team) => ({ playerId: team, score: teamTotal(team) })));
      const placeOf = new Map(ranked.map((r) => [r.playerId, r]));
      const rows = ctx.players.map((p) => {
        const team = placeOf.get(teamOf.get(p.id) ?? '');
        return { playerId: p.id, score: team?.score ?? 0, place: team?.place ?? ranked.length };
      });
      return { ...base, rows: rows.sort((a, b) => a.place - b.place) };
    }
    return { ...base, rows: rankByScore(ctx.players.map((p) => ({ playerId: p.id, score: sim.finalScore(p.id) }))) };
  };
  const survivedS = (id: string): number => sim.pilots.get(id)?.diedAtS ?? sim.timeS;

  /** Подпись награды: число в нужной форме («37 сближений»), множитель или время. */
  const awardValue = (v: AwardValue): string => {
    if (v.kind === 'mult') return t('valMult', { n: v.n });
    if (v.kind === 'time') return formatTime(v.s);
    return t(`n_${v.kind}_${pluralForm(v.n)}`, { n: v.n });
  };

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

  /** Призрак: 0 — камни видны, 1 — погасли. Гаснут на 2 с, горят 1 с, переходы плавные; в конце волны — видны. */
  const phantomHide = (): number => {
    if (sim.waves.complication !== 'phantom') return 0;
    const period = PHANTOM_HIDE_S + PHANTOM_SHOW_S;
    const t = sim.waves.elapsedS % period;
    if (t < PHANTOM_FADE_S) return t / PHANTOM_FADE_S;
    if (t < PHANTOM_HIDE_S) return 1;
    if (t < PHANTOM_HIDE_S + PHANTOM_FADE_S) return 1 - (t - PHANTOM_HIDE_S) / PHANTOM_FADE_S;
    return 0;
  };

  /** Перегрузка: бордовый корабль и след; за OVERLOAD_FADE_S до конца тускнеет к цвету игрока. */
  const overloadTint = (pilot: Pilot): string | null => {
    if (pilot.overloadS <= 0) return null;
    return mixColor(colors.get(pilot.ship.id) ?? ACCENT, OVERLOAD_COLOR, pilot.overloadS / OVERLOAD_FADE_S);
  };

  const syncRocks = (alpha: number): void => {
    const seen = new Set<number>();
    const phantomK = phantomHide();
    const fuseOn = Math.floor(fxTimeS * BOMB_FUSE_HZ * 2) % 2 === 1;
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
      sprite.texture = rock.bomb ? atlas.bombs[rock.size] : (shape[rockState(rock.hp, rock.maxHp)] ?? shape[0]!);
      // Призрак: камень почти не виден, кроме вспышек и попаданий.
      // Попадание: камень плавно проявляется и плавно гаснет.
      const shown = rock.seenS > 0 ? Math.min(1, (PHANTOM_REVEAL_S - rock.seenS) / PHANTOM_REVEAL_IN_S, rock.seenS / PHANTOM_REVEAL_OUT_S) : 0;
      sprite.alpha = 1 - phantomK * (1 - shown) * (1 - PHANTOM_ALPHA);
      // Камни Роя — другим оттенком: их не разбить; камень саботажника — в цвет бросившего; бомба мигает.
      sprite.tint = rock.bomb
        ? fuseOn
          ? BOMB_FUSE_TINT
          : 0xffffff
        : rock.armor
        ? FORTRESS_TINT
        : rock.immortal
        ? SWARM_TINT
        : rock.owner
          ? (colors.get(rock.owner) ?? 0xffffff)
          : sim.freezeS > 0
            ? FREEZE_TINT
            : 0xffffff;
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

  /** Номер волны и что усложнилось — уведомлением; конец волны — бонус; после 20-й — финиш. */
  const announce = (): void => {
    for (const e of sim.events.waves) {
      if (e.kind === 'start') {
        const c = sim.waves.complication;
        const boss = sim.waves.boss;
        if (boss) {
          notice.show(t(e.wave === WAVE_LIMIT ? 'noticeBossFinal' : 'noticeBoss', { n: e.wave, boss: t(`boss_${boss}`) }));
          bossHint.text = t(`hint_${boss}`);
          bossHintS = BOSS_HINT_S;
          barTrail = 1;
          barHits = 0;
        }
        else if (c) notice.show(t('noticeWaveComp', { n: e.wave, c: t(`comp_${c}`) }));
        else notice.show(t('noticeWave', { n: e.wave }));
      } else if (sim.waves.phase === 'done') {
        notice.show(t('noticeFinish'));
      } else if (bossDownWave !== e.wave && [...sim.pilots.values()].some((p) => p.alive)) {
        notice.show(t('noticeCleared', { n: e.wave, score: SCORE_WAVE * e.wave }));
      }
    }
    for (const d of sim.events.bossDown) {
      bossDownWave = sim.waves.wave;
      notice.show(t('noticeBossDown', { boss: t(`boss_${d.kind}`), score: SCORE_BOSS }));
    }
  };

  const waveLine = (): string => {
    const w = sim.waves;
    if (w.phase === 'done') return t('noticeFinish');
    if (w.phase === 'break') return t('hudBreak', { time: formatLeft(w.leftS) });
    // У цели вместо времени — её имя и полоска прочности.
    if (sim.boss && sim.boss.maxHp > 0) return t('hudBoss', { n: w.wave, of: WAVE_LIMIT, boss: t(`boss_${sim.boss.kind}`) });
    if (sim.boss) return t('hudTrial', { n: w.wave, of: WAVE_LIMIT, boss: t(`boss_${sim.boss.kind}`), time: formatLeft(w.leftS) });
    return t('hudWave', { n: w.wave, of: WAVE_LIMIT, time: formatLeft(w.leftS) });
  };

  /** Цвет Охотника — цвет его жертвы. */
  const preyColor = (): string | undefined => (sim.boss?.prey ? colors.get(sim.boss.prey) : undefined);

  /** Полоска босса: у цели — прочность делениями с белым следом урона и вспышкой; у испытания — оставшееся время. */
  const drawBossBar = (): void => {
    bossBar.clear();
    const boss = sim.boss;
    bossHint.visible = boss !== null && bossHintS > 0;
    if (!boss) return;
    const color = bossView.color(boss, preyColor());
    const timed = boss.maxHp <= 0;
    const frac = timed ? Math.max(0, sim.waves.leftS / waveLengthS(sim.waves.wave)) : boss.hp / boss.maxHp;
    const x = waveText.x - BOSS_BAR_W / 2;
    const y = waveTextY + waveText.height / 2 + BOSS_BAR_H;
    const h = BOSS_BAR_H;
    const pad = 3;
    bossBar
      .roundRect(x - pad, y - pad, BOSS_BAR_W + pad * 2, h + pad * 2, (h + pad * 2) / 2)
      .fill({ color: bg, alpha: 0.7 })
      .stroke({ color: barFlashS > 0 ? '#FFFFFF' : color, width: 1.5, alpha: barFlashS > 0 ? 0.9 : 0.45 });
    if (!timed && barTrail > frac) bossBar.roundRect(x, y, BOSS_BAR_W * barTrail, h, h / 2).fill({ color: '#FFFFFF', alpha: 0.5 });
    if (frac > 0) {
      bossBar.roundRect(x, y, BOSS_BAR_W * frac, h, h / 2).fill({ color });
      bossBar.roundRect(x, y, BOSS_BAR_W * frac, h / 2, h / 4).fill({ color: '#FFFFFF', alpha: 0.22 });
    }
    // Деления: сколько осталось — видно с одного взгляда.
    for (let i = 1; i < BOSS_BAR_SEGMENTS; i++) bossBar.rect(x + (BOSS_BAR_W * i) / BOSS_BAR_SEGMENTS - 1, y, 2, h).fill({ color: bg, alpha: 0.85 });
    bossHint.style.fill = color;
    bossHint.position.set(waveText.x, y + h + pad + BOSS_HINT_FONT_PX);
    bossHint.alpha = Math.min(1, bossHintS) * HUD_ALPHA * 1.4;
  };

  /** Шаг полоски: след догоняет прочность, попадание — вспышка; подсказка гаснет. */
  const stepBossBar = (dtS: number): void => {
    bossHintS = Math.max(0, bossHintS - dtS);
    barFlashS = Math.max(0, barFlashS - dtS);
    const boss = sim.boss;
    if (!boss || boss.maxHp <= 0) return;
    const frac = boss.hp / boss.maxHp;
    barTrail = Math.max(frac, barTrail - dtS / BOSS_BAR_TRAIL_S);
    if (boss.hits > barHits) barFlashS = BOSS_FLASH_S;
    barHits = boss.hits;
  };

  /** События шага → частицы, тряска, вспышки и обратная связь на телефоне. */
  /** Звуки шага: панорама — по положению на поле. */
  const sound = (): void => {
    if (!audio) return;
    const { events } = sim;
    const width = sim.bounds.right + sim.bounds.left;
    const pan = (x: number): number => x / width;
    const at = (id: string): number => pan(sim.pilots.get(id)?.ship.pos.x ?? width / 2);
    for (const id of events.shots) audio.play('shot', at(id));
    for (const c of events.chips) audio.play('chip', pan(c.x));
    for (const b of events.breaks) audio.play(BREAK_SFX[b.size], pan(b.x));
    for (const n of events.near) audio.play('near', pan(n.x), 1 + NEAR_PITCH_STEP * ((sim.pilots.get(n.id)?.mult ?? 1) - 1));
    for (const id of events.hits) audio.play('hit', at(id));
    for (const id of events.deaths) audio.play('explode', at(id));
    for (const b of events.bumps) audio.play(b.ram ? 'ram' : 'bump', pan(b.x));
    for (const p of events.pickups) audio.play(p.kind === 'overload' ? 'overload' : 'pickup', pan(p.x));
    for (const id of events.jammed) audio.play('jam', at(id));
    for (const b of events.blasts) audio.play('blast', pan(b.x));
    for (const b of events.booms) audio.play('blast', pan(b.x));
    for (const a of events.alienDown) audio.play('breakSmall', pan(a.x));
    for (const d of events.bossDown) audio.play('bossDown', pan(d.x));
    for (const w of events.waves) audio.play(w.kind === 'start' ? 'waveStart' : 'waveClear');
    for (const r of events.revives) audio.play('revive', pan(r.x));
    for (const id of events.ghosts) audio.play('ghost', at(id));
    for (const s of events.sabShots) audio.play('sabLaunch', at(s.id));
    // Слои музыки: волна всегда; босс — в его волне; «мало жизней» — у кого-то из живых людей последняя жизнь.
    const low = ctx.players.some((p) => p.kind !== 'bot' && (sim.pilots.get(p.id)?.alive ?? false) && (sim.pilots.get(p.id)?.lives ?? 0) <= LOW_LIVES);
    audio.layers({ wave: true, boss: sim.waves.boss !== null, low });
  };

  const react = (): void => {
    const { events } = sim;
    for (const bump of events.bumps) {
      sparks(bump.x, bump.y, RAM_SPARKS, bump.ram ? FLASH_HIT : ACCENT, DEBRIS_S);
      if (!bump.ram) continue;
      camera.shake(SHAKE_RAM);
      buzz(bump.a, { vib: VIBRATE_RAM_MS });
      buzz(bump.b, { vib: VIBRATE_RAM_MS });
    }
    // Выпадение: искры и кольцо-вспышка цветом усиления.
    for (const d of events.drops) {
      sparks(d.x, d.y, POWERUP_DROP_SPARKS, POWERUP_COLOR[d.kind], DEBRIS_S);
      powerupView.burst(d.x, d.y, d.kind);
    }
    // Подбор: неяркая вспышка корабля цветом усиления; боезапас — полоски ярче; ремонт — новое сердечко подрастает.
    for (const p of events.pickups) {
      sparks(p.x, p.y, DEBRIS_COUNT.medium, POWERUP_COLOR[p.kind], DEBRIS_S);
      const view = views.get(p.id);
      view?.flash(POWERUP_COLOR[p.kind]);
      if (p.kind === 'ammo') view?.glowAmmo();
      buzz(p.id, { vib: VIBRATE_PICKUP });
    }
    for (const id of events.healed) {
      const lives = sim.pilots.get(id)?.lives ?? 0;
      views.get(id)?.popHeart(lives - 1);
    }
    for (const id of events.jammed) buzz(id, { vib: VIBRATE_HIT_MS });
    for (const id of events.ghosts) buzz(id, { vib: VIBRATE_GHOST_MS });
    for (const id of events.saboteurs) buzz(id, { vib: VIBRATE_GHOST_MS });
    for (const r of events.revives) {
      const color = colors.get(r.id) ?? ACCENT;
      sparks(r.x, r.y, DEBRIS_COUNT.large, color, DEBRIS_S);
      buzz(r.id, { vib: VIBRATE_EXPLODE_MS, flash: color });
    }
    for (const b of events.blasts) {
      const color = colors.get(b.owner) ?? ACCENT;
      shards(b.x, b.y, DEBRIS_COUNT.large, color);
      sparks(b.x, b.y, DEBRIS_COUNT.large * EXPLOSION_K, color, DEBRIS_S);
      // Кольцо искр до края радиуса отброса — видно, кого задело.
      if (quality.level !== 'low') {
        particles.burst(b.x, b.y, { texture: atlas.spark, color, count: BLAST_SPARKS, speed: [BOMB_BLAST_RADIUS / DEBRIS_S, BOMB_BLAST_RADIUS / DEBRIS_S], life: DEBRIS_S });
      }
      camera.shake(SHAKE_BOMB);
    }
    for (const d of events.bossDown) {
      const color = BOSS_COLORS[d.kind];
      shards(d.x, d.y, BOSS_EXPLOSION_SHARDS, color);
      sparks(d.x, d.y, BOSS_EXPLOSION_SHARDS, color, MULT_SPARK_S[MULT_SPARK_S.length - 1] ?? 1);
      camera.shake(SHAKE_BOSS_DEATH);
      camera.flashScreen(FLASH_EXPLODE, FLASH_DEATH_ALPHA);
      buzz(d.by, { vib: VIBRATE_EXPLODE_MS });
    }
    for (const b of events.breaks) {
      // Взрыв камня: осколки и вспышка искр — заметно даже краем глаза.
      shards(b.x, b.y, DEBRIS_COUNT[b.size], ASTEROID_COLOR);
      sparks(b.x, b.y, DEBRIS_COUNT[b.size] * BREAK_SPARKS_K, ASTEROID_COLOR, DEBRIS_S);
      if (b.size === 'large') camera.shake(SHAKE_BREAK_LARGE);
    }
    for (const c of events.chips) sparks(c.x, c.y, CHIP_COUNT, CRACK_GLOW, DEBRIS_S);
    // Бомбы: взрыв — осколки, искры кольцом до края отброса, тряска.
    for (const b of events.booms) {
      shards(b.x, b.y, DEBRIS_COUNT[b.size] * EXPLOSION_K, BOOM_COLOR);
      sparks(b.x, b.y, BOOM_SPARKS, BOOM_COLOR, DEBRIS_S);
      if (quality.level !== 'low') {
        const reach = BOOM_RADIUS[b.size] / DEBRIS_S;
        particles.burst(b.x, b.y, { texture: atlas.spark, color: BOOM_COLOR, count: BLAST_SPARKS, speed: [reach, reach], life: DEBRIS_S });
      }
      camera.shake(SHAKE_BOMB);
    }
    for (const a of events.alienDown) {
      shards(a.x, a.y, DEBRIS_COUNT.small, ALIEN_BODY);
      sparks(a.x, a.y, DEBRIS_COUNT.medium, ALIEN_BEAM, DEBRIS_S);
    }
    for (const id of events.stuck) buzz(id, { vib: VIBRATE_HIT_MS });
    for (const n of events.near) sparks(n.x, n.y, NEAR_SPARKS, colors.get(n.id) ?? ACCENT, DEBRIS_S);
    for (const id of events.hits) {
      camera.shake(SHAKE_HIT);
      camera.flashScreen(FLASH_HIT, FLASH_HIT_ALPHA);
      camera.pulseChroma();
      if (sim.pilots.get(id)?.alive) buzz(id, { vib: VIBRATE_HIT_MS, flash: FLASH_HIT });
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
      buzz(id, { vib: VIBRATE_EXPLODE_MS, flash: FLASH_EXPLODE });
      multFx.drop(id);
    }
  };

  const game: GameModule = {
    async init(context) {
      ctx = context;
      // Камера отъезжает на шаг за каждые 2 игрока: мир больше, пропорции те же (SPACE_WAR_SPEC §9).
      const zoom = fieldZoom(ctx.settings.fieldSize, ctx.players.length);
      const worldW = worldWidth(ctx.aspect) * zoom;
      const worldH = WORLD_H * zoom;
      const settings = readHubSettings();
      bots = new Set(ctx.players.filter((p) => p.kind === 'bot').map((p) => p.id));
      mode = MODES.find((m) => m === ctx.mode) ?? MODE_DEFAULT;
      ghostTotalS = typeof ctx.settings.ghostS === 'number' ? ctx.settings.ghostS : GHOST_S;
      for (const p of ctx.players) if (p.kind === 'phone') phones.add(p.id);
      for (const p of ctx.players) teamOf.set(p.id, p.color);
      sim = createSim(
        ctx.players.map((p) => p.id),
        worldW,
        ctx.seed,
        worldH,
        {
          mode,
          collisions: ctx.settings.collisions !== false,
          teamOf: (id) => teamOf.get(id) ?? id,
          difficulty: DIFFICULTIES.find((d) => d === ctx.settings.difficulty) ?? DIFFICULTY_DEFAULT,
          // ?wave=N в адресе — начать с N-й волны (проверка боссов и поздних волн).
          startWave: Number(new URLSearchParams(location.search).get('wave')) || 1,
          ghostS: ghostTotalS,
          sabotage: ctx.settings.sabotage !== false,
          powerups: ctx.settings.powerups !== false,
          powerupRate: POWERUP_RATES[POWERUP_RATE_KEYS.find((r) => r === ctx.settings.powerupRate) ?? POWERUP_RATE_DEFAULT],
          rockBounce: typeof ctx.settings.rockBounce === 'boolean' ? ctx.settings.rockBounce : ROCK_BOUNCE_DEFAULT,
        },
      );
      const botLevel = BOT_LEVELS.find((l) => l === ctx.settings.botLevel) ?? BOT_LEVEL_DEFAULT;
      brains = createBots(sim, [...bots], botLevel, ctx.seed, mode, (id) => teamOf.get(id) ?? id);
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
      audio = createGameAudio(settings);

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
      // Частицы своих границ не считают (ParticleContainer): без явной области bloom считал её по кораблям,
      // снарядам и боссу — осколки и искры за её краем обрезались или пропадали целиком. Область — всё поле.
      const world = new Rectangle(-SHAKE_MAX_PX, -SHAKE_MAX_PX, worldW + SHAKE_MAX_PX * 2, worldH + SHAKE_MAX_PX * 2);
      particles.view.boundsArea = world;
      glowLayer.filterArea = world;
      vortexFx = createVortexFx((sim.bounds.left + sim.bounds.right) / 2, (sim.bounds.top + sim.bounds.bottom) / 2, ACCENT);
      bg = cssVar('--bg');
      bossView = createBossView(vfx);
      glowLayer.addChildAt(bossView.view, 0);
      afterView = createAfterlifeView();
      alienView = createAlienView();
      currentView = createCurrentView(vfx, sim.bounds, ACCENT);
      glowLayer.addChild(alienView.view);
      powerupView = createPowerupView(await loadPowerupIcons());
      glowLayer.addChild(afterView.view);
      // Значки усилений — над камнями, вне bloom: их свечение уже нарисовано.
      scene.addChild(field, vortexFx.view, currentView.view, rocksLayer, powerupView.view, glowLayer, tagsLayer);

      // Счёт и FPS не уменьшаются вместе с отъездом камеры: свой слой в масштабе zoom.
      const hud = new Container();
      hud.scale.set(zoom);
      // Командное — фишка на команду (её цвет и сумма очков); иначе — на игрока.
      const chips = mode === 'teams' ? [...new Set(teamOf.values())].map((c) => ({ id: c, color: c })) : ctx.players;
      scoreHud = createScoreHud(chips, FIELD_INSET + HUD_PAD_PX, FIELD_INSET + HUD_PAD_PX, textColor);
      hud.addChild(scoreHud.view);
      // Номер волны и время — мелко вверху по центру; уведомления — под ними.
      waveText = new Text({
        text: '',
        style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: WAVE_HUD_FONT_PX, fill: textColor },
      });
      waveText.alpha = HUD_ALPHA;
      waveText.anchor.set(0.5);
      waveTextY = FIELD_INSET + HUD_PAD_PX;
      waveText.position.set(worldW / zoom / 2, waveTextY);
      bossBar = new Graphics();
      bossBar.alpha = HUD_ALPHA * 1.6;
      bossHint = new Text({
        text: '',
        style: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: BOSS_HINT_FONT_PX, fill: textColor },
      });
      bossHint.anchor.set(0.5);
      bossHint.visible = false;
      notice = createNotice(
        {
          text: { fontFamily: [FONT_DISPLAY, FONT_FALLBACK], fontWeight: '700', fontSize: NOTICE_FONT_PX, fill: textColor },
          fill: cssVar('--bg'),
          fillAlpha: NOTICE_PLATE_ALPHA,
          padX: NOTICE_PAD_X,
          padY: NOTICE_PAD_Y,
        },
        worldW / zoom / 2,
        NOTICE_Y,
      );
      hud.addChild(waveText, bossBar, bossHint, notice.view);
      darkness = createDarkness(stage.app.renderer, worldW, worldH, cssVar('--bg'));
      stage.world.addChild(starsSprite, scene, darkness.view, hud, camera.flash);
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

    update(dtS, tick) {
      if (paused || ended) return;
      // Боты-саботажники бросают по своему решению — в начале шага, как и люди.
      for (const id of bots) {
        const shot = brains.sabotage(id);
        if (shot) sim.sabotage(id, shot);
      }
      sim.step(dtS, (id) => (bots.has(id) ? brains.input(id) : ctx.input.read(id)));
      // Метки шкалы записи: начало волны и гибель.
      for (const w of sim.events.waves) if (w.kind === 'start') marks.push({ tick, kind: 'wave', label: t('noticeWave', { n: w.wave }) });
      for (const id of sim.events.deaths) marks.push({ tick, kind: 'death', label: ctx.players.find((p) => p.id === id)?.nick ?? id });
      tail.push(snapshot(sim));
      if (tail.length > TAIL_STEPS) tail.shift();
      react();
      sound();
      announce();
      notice.update(dtS);
      darkness.update(sim.waves.complication === 'dark', dtS);
      vortexFx.update(sim.waves.complication === 'vortex' || sim.boss?.kind === 'vortex', dtS);
      currentView.update(sim.waves.complication === 'current', sim.waves.flow, dtS);
      camera.update(dtS);
      // Hit-stop: мир на мгновение замер — замирают и частицы, и следы; тряска и вспышка идут.
      if (sim.frozen) return;
      fxTimeS += dtS;
      for (const pilot of sim.pilots.values()) {
        if (!pilot.alive) continue;
        const { id, pos } = pilot.ship;
        multFx.track(id, pos.x, pos.y, pilot.mult, overloadTint(pilot) ?? colors.get(id) ?? ACCENT, dtS);
        views.get(id)?.update(dtS);
      }
      multFx.update(dtS);
      powerupView.update(dtS);
      bossView.update(dtS);
      stepBossBar(dtS);
      // «×2 пули»: мелкие искры на полосках патронов, пока действует.
      if (quality.level !== 'low') {
        for (const pilot of sim.pilots.values()) {
          if (!pilot.alive || pilot.doubleS <= 0 || vfx.next() > DOUBLE_SPARK_PER_S * dtS) continue;
          const { x, y } = pilot.ship.pos;
          particles.burst(x + vfx.range(-AMMO_SPARK_SPREAD, AMMO_SPARK_SPREAD), y + AMMO_Y, {
            texture: atlas.spark,
            color: POWERUP_COLOR.double,
            count: 1,
            speed: [0, SPARK_SPEED],
            life: DEBRIS_S,
          });
        }
      }
      particles.update(dtS);
      const live = (id: string): number => sim.pilots.get(id)?.score ?? 0;
      scoreHud.update(
        mode === 'teams'
          ? [...new Set(teamOf.values())].map((team) => ({
              id: team,
              score: ctx.players.filter((p) => teamOf.get(p.id) === team).reduce((sum, p) => sum + live(p.id), 0),
            }))
          : ctx.players.map((p) => ({ id: p.id, score: live(p.id) })),
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
        const ghost = pilot.phase === 'ghost';
        view.setVisible(pilot.alive || ghost);
        view.setGhost(ghost);
        if (!pilot.alive && !ghost) continue;
        view.set(
          ship.prev.x + (ship.pos.x - ship.prev.x) * alpha,
          ship.prev.y + (ship.pos.y - ship.prev.y) * alpha,
          ship.prevAngle + angleDelta(ship.prevAngle, ship.angle) * alpha,
          ship.thrust,
        );
        view.setLives(pilot.lives, SHIP_LIVES);
        view.setAmmo(pilot.ammo, AMMO_MAX);
        view.setJammed(pilot.jamS > 0);
        view.setMult(pilot.mult);
        view.setOverload(overloadTint(pilot));
        view.setShield(pilot.shieldS > 0, pilot.shieldS < SHIELD_BLINK_S && Math.floor(pilot.shieldS * INVULN_BLINK_HZ * 2) % 2 === 0);
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
      vortexFx.draw();
      powerupView.draw(sim.powerups, alpha, fxTimeS);
      currentView.draw();
      alienView.draw(sim.aliens, alpha, fxTimeS, (id) => {
        const p = sim.pilots.get(id);
        return p ? { x: p.ship.prev.x + (p.ship.pos.x - p.ship.prev.x) * alpha, y: p.ship.prev.y + (p.ship.pos.y - p.ship.prev.y) * alpha } : undefined;
      });
      afterView.draw(
        sim.shards,
        sim.bombs,
        [...sim.pilots.values()]
          .filter((p) => p.phase === 'ghost')
          .map((p) => ({
            x: p.ship.prev.x + (p.ship.pos.x - p.ship.prev.x) * alpha,
            y: p.ship.prev.y + (p.ship.pos.y - p.ship.prev.y) * alpha,
            color: colors.get(p.ship.id) ?? ACCENT,
            left: Math.max(0, p.ghostS / ghostTotalS),
          })),
        (id) => colors.get(id) ?? ACCENT,
        alpha,
        fxTimeS,
      );
      const boss = sim.boss;
      // Охотник: пунктир и рамка к жертве — по её сглаженной позиции.
      const victim = boss?.prey ? sim.pilots.get(boss.prey) : undefined;
      const prey =
        victim?.alive === true
          ? {
              x: victim.ship.prev.x + (victim.ship.pos.x - victim.ship.prev.x) * alpha,
              y: victim.ship.prev.y + (victim.ship.pos.y - victim.ship.prev.y) * alpha,
              color: colors.get(victim.ship.id) ?? ACCENT,
            }
          : undefined;
      bossView.draw(
        boss,
        boss ? boss.prev.x + (boss.pos.x - boss.prev.x) * alpha : 0,
        boss ? boss.prev.y + (boss.pos.y - boss.prev.y) * alpha : 0,
        fxTimeS,
        bg,
        prey ? { prey } : undefined,
      );
      waveText.text = waveLine();
      drawBossBar();
      holes.length = 0;
      for (const pilot of sim.pilots.values()) {
        if (!pilot.alive) continue;
        const { pos, prev } = pilot.ship;
        holes.push({
          x: prev.x + (pos.x - prev.x) * alpha + camera.offsetX,
          y: prev.y + (pos.y - prev.y) * alpha + camera.offsetY,
        });
      }
      darkness.draw(holes);
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
      audio?.pause(true);
    },

    resume() {
      paused = false;
      audio?.pause(false);
      frames = 0;
      sampleStart = lastFrameAt = performance.now();
    },

    finish() {
      endMatch();
    },

    status() {
      // Строка на паузе (SPACE_WAR_SPEC §6): «Волна N · до конца м:сс».
      const w = sim.waves;
      if (w.phase === 'done') return t('statusFinish');
      if (w.phase === 'break') return t('statusBreak', { time: formatLeft(w.leftS) });
      if (sim.boss && sim.boss.maxHp > 0) return t('statusBoss', { n: w.wave, boss: t(`boss_${sim.boss.kind}`) });
      return t('statusWave', { n: w.wave, time: formatLeft(w.leftS) });
    },

    results() {
      // Награды — каждому по одной из статистики; таблица — корабль, полоска дожитых волн, одна цифра.
      const players = ctx.players.map((p) => ({
        id: p.id,
        stats: sim.pilots.get(p.id)?.stats ?? { hits: 0, near: 0, kills: 0, shots: 0, rams: 0, revives: 0, pickups: 0, sabShots: 0, maxMult: 1, waves: 0 },
        survivedS: survivedS(p.id),
        score: sim.finalScore(p.id),
      }));
      const hullIcon = (id: string): { icon?: string } => {
        const player = ctx.players.find((p) => p.id === id);
        return player ? { icon: hullSvg(hullOf(player)) } : {};
      };
      const awards: Award[] = pickAwards(players).map((a) => ({
        playerId: a.id,
        title: t(`award_${a.key}`),
        value: awardValue(a.value),
        ...hullIcon(a.id),
      }));
      const main = mode === 'teams' ? 'colTeam' : 'colScore';
      return {
        awards,
        table: {
          columns: [t(main)],
          rows: result().rows.map((r) => {
            const player = ctx.players.find((p) => p.id === r.playerId);
            return {
              playerId: r.playerId,
              // Кооператив — личный вклад (места у всех общие), командное — очки команды, соревнование — свои.
              cells: [String(mode === 'coop' ? sim.finalScore(r.playerId) : r.score)],
              ...(player ? { icon: hullSvg(hullOf(player)) } : {}),
              bar: { value: sim.pilots.get(r.playerId)?.stats.waves ?? 0, max: WAVE_LIMIT },
            };
          }),
        },
      };
    },

    marks() {
      return [...marks];
    },

    replay() {
      // Замедленный повтор последних секунд: снимки шагов подставляются вместо симуляции, частицы — по их событиям.
      const frames = [...tail];
      if (frames.length === 0) return Promise.resolve();
      const live = sim;
      replaying = true;
      notice.hide();
      return new Promise<void>((done) => {
        let f = 0;
        let shown = -1;
        const finish = (): void => {
          replayLoop?.stop();
          replayLoop = null;
          replaying = false;
          sim = live;
          done();
        };
        const loop = new FixedLoop({
          update: (dtS) => {
            f += REPLAY_SLOW;
            const i = Math.min(frames.length - 1, Math.floor(f));
            for (let k = shown + 1; k <= i; k++) {
              sim = frames[k] as Sim;
              react();
            }
            shown = i;
            particles.update(dtS * REPLAY_SLOW);
            camera.update(dtS * REPLAY_SLOW);
            for (const view of views.values()) view.update(dtS * REPLAY_SLOW);
            if (f >= frames.length - 1) finish();
          },
          render: () => {
            sim = frames[Math.min(frames.length - 1, Math.floor(f))] as Sim;
            game.render(f - Math.floor(f));
          },
        });
        replayLoop = loop;
        loop.start();
      });
    },

    aim(playerId) {
      // Экран саботажника — только у телефонов: клавиатурному прицелиться нечем.
      const pilot = sim.pilots.get(playerId);
      if (!pilot || pilot.phase !== 'saboteur' || !phones.has(playerId)) return undefined;
      return {
        cards: SAB_KINDS.map((kind) => ({ id: kind, icon: SAB_ICONS[kind], readyInS: pilot.sabS[kind], cooldownS: sim.sabCooldownS(kind) })),
      };
    },

    action(playerId, payload) {
      const shot = parseAimShot(payload);
      if (!shot || !isSabKind(shot.card)) return;
      sim.sabotage(playerId, { kind: shot.card, x: shot.x, y: shot.y, dx: shot.dx, dy: shot.dy, step: shot.step });
    },

    mainButton(playerId) {
      // Power: число патронов и ободок накопления следующего; полный запас — полный ободок.
      const pilot = sim.pilots.get(playerId);
      if (!pilot) return undefined;
      // Под Глушилкой Power погашен с пометкой; патроны копятся как обычно.
      return { value: pilot.ammo, progress: pilot.ammo >= AMMO_MAX ? 1 : pilot.ammoProgress, ...(pilot.jamS > 0 ? { off: true } : {}) };
    },

    updatePlayer(player: GamePlayer) {
      // В командном цвет — это команда: посреди матча она не меняется.
      if (mode === 'teams') {
        views.get(player.id)?.paint(colors.get(player.id) ?? player.color, hullOf(player));
        return;
      }
      views.get(player.id)?.paint(player.color, hullOf(player));
      colors.set(player.id, player.color);
      scoreHud.setColor(player.id, player.color);
    },

    dispose() {
      replayLoop?.stop();
      replayLoop = null;
      audio?.dispose();
      audio = null;
      darkness?.destroy();
      powerupView?.destroy();
      stage?.destroy();
      atlas?.destroy();
      views.clear();
      rockSprites.clear();
      spareSprites.length = 0;
    },
  };
  return game;
}
