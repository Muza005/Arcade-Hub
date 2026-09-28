// Константы Space War (SPACE_WAR_SPEC §4). Все числа баланса игры — только здесь.
// TUNE — стартовые заглушки: подбираются на своих этапах, до тех пор значение условное.

// ─── Мир и оформление ─────────────────────────────────────────────
/** Мир по высоте всегда WORLD_H, по ширине — под экран на старте матча (ctx.aspect). */
export const WORLD_H = 1080;
export const worldWidth = (aspect: number): number => Math.round(WORLD_H * aspect);
export const ACCENT = '#3DE0FF';
export const ACCENT_ALT = '#8B5CFF';
export const FIELD_INSET = 16; // рамка поля от края экрана
export const FIELD_RADIUS = 28;
export const FIELD_LINE_PX = 2;
export const FIELD_LINE_ALPHA = 0.35;

// ─── Качество и производительность ───────────────────────────────
export const FRAME_BUDGET_MS = 8; // наш бюджет из 16 мс
export const QUALITY_DOWNGRADE_FRAME_MS = 20; // кадр дольше этого...
export const QUALITY_DOWNGRADE_HOLD_S = 2; // ...2 с подряд → качество на ступень ниже
export const QUALITY_PROBE_S = 3; // первичный замер при старте
export const PARTICLES_MAX = { mid: 300, high: 1500 } as const;
export const BUNDLE_GAME_KB = 500;
// Счётчик FPS (этап Б0): обновляется дважды в секунду, мелко в углу
export const FPS_SAMPLE_S = 0.5;
export const FPS_FONT_PX = 22;
export const FPS_ALPHA = 0.55;
export const FPS_PAD_PX = 28;

// ─── Корабль ─────────────────────────────────────────────────────
export const SHIP_THRUST = 2400; // TUNE: px/с² при полном отклонении
export const SHIP_DRAG = 3; // TUNE: 1/с — отпустил управление, скорость гаснет плавно
export const SHIP_MAX_SPEED = 620; // TUNE: px/с
/** Хитбокс — окружность, одинаковая у всех форм корпуса. */
export const SHIP_HITBOX_RADIUS = 22; // TUNE
export const SHIP_LIVES = 5;
export const DISCONNECT_INVULN_S = 2;
export const KEYBOARD_MAX = 2;

// ─── Обратная связь на телефон ───────────────────────────────────
export const VIBRATE_HIT_MS = 40;
export const VIBRATE_EXPLODE_MS = 300; // TUNE: взрыв — длинная вибрация
export const VIBRATE_PICKUP_MS = 25; // TUNE: подбор усиления — два коротких импульса
export const VIBRATE_PICKUP_GAP_MS = 60; // TUNE

// ─── Стрельба и патроны ──────────────────────────────────────────
export const AMMO_MAX = 10;
/** Патрон копится за t = AMMO_BASE_S / (1 + AMMO_MULT_K · (m − 1)), m — итоговый множитель. */
export const AMMO_BASE_S = 3;
export const AMMO_MULT_K = 0.4;
export const ASTEROID_HP = { small: 2, medium: [4, 5], large: 8 } as const;

// ─── Множитель ───────────────────────────────────────────────────
export const MULT_MAX = 5;
export const MULT_STEPS = [3, 5, 8, 12] as const; // сближений до ×2, ×3, ×4, ×5 (всего 28)
export const NEAR_MISS_COOLDOWN_S = 0.5;
export const NEAR_MISS_DISTANCE = 60; // TUNE: зазор между хитбоксами, px
export const MULT_IDLE_RESET_S = 3; // TUNE: SPACE_WAR_SPEC §14 п. 3 — уточнить до Б3

// ─── Очки ────────────────────────────────────────────────────────
export const SCORE_WAVE = 100; // × номер волны, без множителя
export const SCORE_NEAR_MISS = 10; // × множитель
export const SCORE_ASTEROID = { small: 20, medium: 50, large: 120 } as const; // × множитель
export const SCORE_BOSS = 1000;
export const SCORE_REVIVE = 300; // только кооператив
export const SCORE_LIFE_LEFT = 250; // за каждую жизнь в конце

// ─── Волны ───────────────────────────────────────────────────────
export const WAVE_LIMIT = 20;
export const WAVE_PAUSE_S = 5;
export const WAVE_DURATION_BASE_S = 30;
export const WAVE_DURATION_STEP_S = 3;
export const WAVE_DURATION_MAX_S = 60;
/** Длительность волны: min(30 + 3 · (n − 1), 60) с. */
export const waveDurationS = (wave: number): number =>
  Math.min(WAVE_DURATION_BASE_S + WAVE_DURATION_STEP_S * (wave - 1), WAVE_DURATION_MAX_S);
export const FLOW_PLAYER_K = 0.5; // поток = база · (1 + 0.5 · (N − 1))
export const WAVE_DENSITY_GROWTH = 0.08; // TUNE: +8 % камней за волну
export const WAVE_SPEED_GROWTH = 0.04; // TUNE: +4 % скорости за волну
export const CAMERA_ZOOM_STEP_PLAYERS = 2; // шаг отдаления на каждые 2 игрока

// ─── Боссы ───────────────────────────────────────────────────────
export const BOSS_HP_PLAYER_K = 0.7; // прочность = база · (1 + 0.7 · (N − 1))
export const BOSS_BASE_HP = { seeder: 25, giant: 30 } as const;
export const SWARM_DURATION_S = 25;
export const VORTEX_DURATION_S = 30;

// ─── Усиления ────────────────────────────────────────────────────
export const POWERUP_DROP_CHANCE = 1 / 20; // с разрушенного астероида
export const POWERUP_LIFETIME_S = 10;
export const SHIELD_S = 8;
export const FREEZE_S = 3;
export const OVERLOAD_S = 5;
export const OVERLOAD_FACTOR = 2; // максимум итогового множителя ×10
export const JAMMER_S = 5;
export const JAMMER_TARGETS = 3; // всегда 3 ближайших соперника, даже если их меньше

// ─── Саботаж ─────────────────────────────────────────────────────
export const SAB_COOLDOWN_S = { rock: 5, bomb: 8 } as const; // + 1 с за каждого погибшего
export const SAB_ROCK_HP = [4, 5] as const;
export const SAB_SPEED_STEPS = [0.5, 1, 2, 3] as const; // × скорость обычного астероида
export const SAB_STEP_THRESHOLDS = [0.25, 0.5, 0.75] as const; // доли диагонали рамки
export const SAB_CANCEL_CM = 1.5; // короче — отмена; тап тоже отмена
export const SAB_FRAME_MIN_HEIGHT = 0.6; // рамка ≥ 60 % высоты телефона

// ─── Воскрешение и призрак ───────────────────────────────────────
export const GHOST_S = 15; // настраивается в лобби
export const REVIVE_SHARDS = 3;
