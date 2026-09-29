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
/** Лимит частиц по качеству. На низком — только короткие осколки от камней, искры множителя выключены. */
export const PARTICLES_MAX = { low: 40, mid: 300, high: 1500 } as const;
export const BUNDLE_GAME_KB = 500;
/** Первые кадры после старта не считаются: загрузка и прогрев шейдеров. */
export const QUALITY_WARMUP_S = 0.5;

// ─── Визуал (Б4) ─────────────────────────────────────────────────
// Параллакс-звёзды: три слоя в шейдере, дальние мельче, тусклее и медленнее
export const STAR_LAYERS = [
  { cell: 90, drift: 4, parallax: 0.15, bright: 0.35 },
  { cell: 150, drift: 9, parallax: 0.35, bright: 0.6 },
  { cell: 240, drift: 16, parallax: 0.6, bright: 0.9 },
] as const;
export const STAR_DENSITY = 0.35; // доля ячеек со звездой
// Тряска камеры (trauma: сдвиг ∝ trauma², спадает линейно); × ползунок «Тряска» хаба
export const SHAKE_HIT = 0.45;
export const SHAKE_DEATH = 0.8;
export const SHAKE_BREAK_LARGE = 0.12;
export const SHAKE_MAX_PX = 18;
export const SHAKE_DECAY_PER_S = 1.6;
export const SHAKE_FREQ_HZ = 28;
// Вспышка экрана; × ползунок «Вспышки» хаба
export const FLASH_HIT_ALPHA = 0.16;
export const FLASH_DEATH_ALPHA = 0.3;
export const FLASH_DECAY_S = 0.25;
// Hit-stop: мир замирает на мгновение — часть симуляции, в записи повторяется так же
export const HIT_STOP_S = 0.05;
export const HIT_STOP_DEATH_S = 0.12;
// Bloom (с среднего качества): свечение рисуется в уменьшенную текстуру, размывается и ложится сверху
export const BLOOM_SCALE = 0.25;
export const BLOOM_BLUR = 10;
export const BLOOM_BLUR_QUALITY = 4; // меньше — размытие распадается на заметные копии
export const BLOOM_STRENGTH = 0.7; // × ползунок «Bloom» хаба
// Хроматическая аберрация (только высокое): импульсом при ударе — постоянная размывала картинку
export const CHROMA_HIT_PX = 5;
export const CHROMA_DECAY_S = 0.35;
// Частицы
export const SPARK_TEXTURE_PX = 16; // мягкая точка в атласе
export const SHARD_TEXTURE_PX = 20; // чёрточка осколка
export const ATLAS_GAP = 2;
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
/** От стены корабль держится на длину корпуса: нос не заходит за рамку поля. */
export const SHIP_WALL_MARGIN = 36; // корпус (SHIP_SIZE) + свечение
/** Корабль поворачивается носом по скорости: не быстрее этого и только когда реально летит. */
export const SHIP_TURN_RATE = 10; // TUNE: рад/с
export const SHIP_FACE_MIN_SPEED = 40; // TUNE: px/с
/** Старт: корабли по кругу вокруг центра поля. */
export const SPAWN_RING_RADIUS = 240;
export const SHIP_LIVES = 5;
export const DISCONNECT_INVULN_S = 2;
export const KEYBOARD_MAX = 2;

// Вид корабля: неоновый контур в цвет игрока, ник над ним, язычок тяги
export const SHIP_SIZE = 28; // от центра до носа, px
export const SHIP_TAIL_K = 0.7; // корма уже носа
export const SHIP_LINE_PX = 3;
export const SHIP_GLOW_PX = 10; // широкий полупрозрачный контур под основным — мягкое свечение
export const SHIP_GLOW_ALPHA = 0.22;
export const FLAME_LENGTH = 22; // при полной тяге
export const FLAME_WIDTH_K = 0.45;
export const FLAME_ALPHA = 0.8;
export const NICK_FONT_PX = 20;
export const NICK_GAP_PX = 16;
export const NICK_ALPHA = 0.85;

// ─── Астероиды (Б2) ──────────────────────────────────────────────
export type AsteroidSize = 'small' | 'medium' | 'large';
export const ASTEROID_RADIUS = { small: 18, medium: 34, large: 58 } as const; // TUNE
export const ASTEROID_SPEED = { small: [150, 230], medium: [100, 170], large: [60, 115] } as const; // TUNE: px/с
export const ASTEROID_SPIN = 1.2; // TUNE: рад/с, вращение только для вида
/** Поток камней на одного игрока, шт/с; на N игроков — × (1 + FLOW_PLAYER_K · (N − 1)). */
export const ASTEROID_SPAWN_PER_S = 1.1; // TUNE
export const ASTEROID_SIZE_WEIGHTS = { small: 0.4, medium: 0.35, large: 0.25 } as const; // TUNE
/** Камень летит в случайную точку центральной части поля: доля отступа от краёв. */
export const ASTEROID_AIM_INSET = 0.2;
export const ASTEROID_SPAWN_GAP = 8; // рождается за краем поля, px
export const ASTEROIDS_MAX = 160; // размер пула
/** Хитбокс камня чуть меньше рисунка: задевание краем контура прощается. */
export const ASTEROID_HITBOX_K = 0.85;
// Раскол: крупный → 2 средних, средний → 2 мелких, мелкий рассыпается в безвредные осколки
export const SPLIT_COUNT = 2;
export const SPLIT_SPREAD_RAD = 0.6;
export const SPLIT_SPEED_K = 1.25;
export const GRID_CELL = 128; // ячейка сетки столкновений, px
// Удар по кораблю
export const HIT_INVULN_S = 2; // TUNE: короткая неуязвимость после удара
export const INVULN_BLINK_HZ = 8;
export const GAME_OVER_DELAY_S = 1.5; // взрыв последнего корабля успевают увидеть
// Вид камней: процедурные формы, запекаются в текстуры один раз
export const ASTEROID_SHAPE_SEED = 0x5eed; // только для вида, симуляцию не трогает
export const ASTEROID_SHAPE_VARIANTS = 6;
export const ASTEROID_VERTICES = [9, 14] as const;
export const ASTEROID_JAGGED = 0.28; // разброс радиуса вершин
export const ASTEROID_COLOR = '#A99BFF';
export const ASTEROID_FILL = '#0B0D1C';
export const ASTEROID_LINE_PX = 3;
export const ASTEROID_GLOW_PX = 9; // неоновый ореол контура
export const ASTEROID_GLOW_ALPHA = 0.18;
export const ASTEROID_TEXTURE_PAD = 6;
// Осколки: только вид, урона не наносят
export const DEBRIS_COUNT = { small: 5, medium: 7, large: 9 } as const;
export const DEBRIS_SPEED = [120, 320] as const;
export const DEBRIS_S = 0.6;
export const DEBRIS_VFX_SEED = 0xdeb415; // осколки — только вид, своя случайность
export const INVULN_ALPHA = 0.3; // мигание неуязвимого корабля
// Три состояния камня по урону: целый, трещины, светящиеся разломы на последнем попадании
export const CRACK_COLOR = '#6E62B8';
export const CRACK_GLOW = '#FFB84D';
export const CRACK_LINES = [2, 4] as const;
export const CRACK_LINE_PX = 2;
export const CRACK_GLOW_PX = 3;
export const CHIP_COUNT = 3; // искры от попадания без раскола
// Счёт в углу: кружок цвета игрока и число, по местам (как в «Точках»)
export const HUD_ALPHA = 0.55;
export const HUD_PAD_PX = 28;
export const SCORE_FONT_PX = 26;
export const SCORE_DOT_RADIUS = 11;
export const SCORE_DOT_GAP_PX = 10;
export const SCORE_GAP_PX = 26;
export const HUD_POP_S = 0.45;
export const HUD_POP_SCALE = 0.3;
export const HUD_SLIDE_RATE = 10;

// Жизни под кораблём
export const LIVES_PIP_RADIUS = 4;
export const LIVES_PIP_GAP = 5;
export const LIVES_Y = 44; // под центром корабля
export const LIVES_LOST_ALPHA = 0.2;

// ─── Обратная связь на телефон ───────────────────────────────────
export const VIBRATE_HIT_MS = 40;
export const VIBRATE_EXPLODE_MS = 300; // TUNE: взрыв — длинная вибрация
export const VIBRATE_PICKUP_MS = 25; // TUNE: подбор усиления — два коротких импульса
export const VIBRATE_PICKUP_GAP_MS = 60; // TUNE
export const FLASH_HIT = '#FF4D5E'; // попадание — красная вспышка по краям телефона
export const FLASH_EXPLODE = '#FFFFFF'; // взрыв — белая

// ─── Стрельба и патроны ──────────────────────────────────────────
export const AMMO_MAX = 10;
/** Патрон копится за t = AMMO_BASE_S / (1 + AMMO_MULT_K · (m − 1)), m — итоговый множитель. */
export const AMMO_BASE_S = 3;
export const AMMO_MULT_K = 0.4;
export const ASTEROID_HP = { small: 1, medium: [4, 5], large: 8 } as const; // заказчик: мелкий — с одного выстрела
export const AMMO_START = 10; // TUNE: с чем начинается матч
// Выстрел Power: снаряд летит с упреждением в ближайший камень на поле
export const BULLET_SPEED = 1500; // TUNE: px/с
export const BULLET_RADIUS = 5;
export const BULLET_LIFE_S = 1.2;
export const BULLETS_MAX = 120;
export const BULLET_LENGTH = 18; // вид: чёрточка по направлению полёта
export const BULLET_LINE_PX = 4;

// ─── Множитель ───────────────────────────────────────────────────
export const MULT_MAX = 5;
export const MULT_STEPS = [3, 5, 8, 12] as const; // сближений до ×2, ×3, ×4, ×5 (всего 28)
export const NEAR_MISS_COOLDOWN_S = 0.5;
export const NEAR_MISS_DISTANCE = 90; // TUNE: зазор между хитбоксами, px (было 60 — множитель рос медленно)
export const MULT_IDLE_RESET_S = 5; // заказчик: 5 с после проверки в игре (SPACE_WAR_SPEC §14 п. 3)
// Показ множителя (только большой экран): индекс — ступень ×1…×5
export const MULT_HULL_ALPHA = [0.7, 0.85, 1, 1, 1] as const; // ×2 чуть ярче, ×3 заметно
export const MULT_GLOW_ALPHA = [0.18, 0.2, 0.4, 0.5, 0.65] as const; // ×3 — мягкое свечение
export const MULT_GLOW_PX = [10, 10, 14, 16, 20] as const;
export const MULT_TRAIL_S = [0, 0, 0, 0.35, 0.6] as const; // ×4 — след, ×5 — длиннее
export const MULT_SPARK_S = [0, 0, 0, 1, 1.75] as const; // искры гаснут ~1 с и 1,5–2 с
export const MULT_SPARK_PER_S = [0, 0, 0, 22, 36] as const;
export const SPARK_SPEED = 40;
export const TRAIL_LINE_PX = 6;
export const TRAIL_ALPHA = 0.5;
export const MULT_FONT_PX = 20;
export const MULT_GAP_PX = 6;

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

// ─── Лобби (Б5, SPACE_WAR_SPEC §8) ───────────────────────────────
/** Формы корпуса: треугольник, круг, квадрат, звезда — у каждой свои варианты рисунка. Хитбокс у всех один. */
export const HULLS = [
  'arrow', 'delta', 'wing', 'dart', 'chevron', 'needle', // треугольник
  'ring', 'core', 'half', // круг
  'box', 'diamond', 'kite', 'prism', // квадрат
  'star5', 'star4', // звезда
] as const;
export type Hull = (typeof HULLS)[number];
export const HULL_DEFAULT: Hull = 'arrow';
/** У ботов один статичный корпус. */
export const HULL_BOT: Hull = 'delta';
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export const DIFFICULTY_DEFAULT = 'normal';
export const BOT_LEVELS = ['weak', 'mid', 'strong'] as const;
export const BOT_LEVEL_DEFAULT = 'mid';
export const QUALITY_CHOICES = ['auto', 'low', 'mid', 'high'] as const;
export const GHOST_S_RANGE = { min: 10, max: 30, step: 5 } as const;

// ─── Воскрешение и призрак ───────────────────────────────────────
export const GHOST_S = 15; // настраивается в лобби
export const REVIVE_SHARDS = 3;
