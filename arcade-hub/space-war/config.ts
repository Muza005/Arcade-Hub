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
export const ATLAS_GAP = 4; // между кадрами: соседний кадр не просвечивает по краю
/** Прозрачный запас вокруг искры и осколка внутри кадра: при повороте и сглаживании край не режется. */
export const ATLAS_FX_PAD = 6;
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
export const SHIP_LIVES = 5; // у каждого свои — во всех режимах (решение заказчика)
// Режимы (Б7, SPACE_WAR_SPEC §5): кооператив — общий счёт; соревнование — по очкам; командное — цвет = команда
export const MODES = ['coop', 'versus', 'teams'] as const;
export type Mode = (typeof MODES)[number];
export const MODE_DEFAULT: Mode = 'coop';
// Столкновения кораблей: отталкивание; таран сбрасывает множитель обоим (не в кооперативе и не своим)
export const SHIP_BOUNCE = 0.8; // TUNE: упругость удара кораблей
export const SHIP_PUSH_MIN = 180; // TUNE: px/с — минимум, с которым корабли расходятся, чтобы не слипались
export const RAM_SPARKS = 6;
export const SHAKE_RAM = 0.2;
export const VIBRATE_RAM_MS = 30;
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
export const LABEL_GAP_PX = 16; // от носа до цифры множителя

// ─── Астероиды (Б2) ──────────────────────────────────────────────
export type AsteroidSize = 'small' | 'medium' | 'large';
export const ASTEROID_RADIUS = { small: 18, medium: 34, large: 58 } as const; // TUNE
export const ASTEROID_SPEED = { small: [160, 240], medium: [110, 180], large: [80, 130] } as const; // TUNE: px/с
export const ASTEROID_SPIN = 1.2; // TUNE: рад/с, вращение только для вида
/** Поток камней на одного игрока, шт/с; на N игроков — × (1 + FLOW_PLAYER_K · (N − 1)). */
export const ASTEROID_SPAWN_PER_S = 0.8; // TUNE (было 1.1: на 10 игроках поле превращалось в кашу)
export const ASTEROID_SIZE_WEIGHTS = { small: 0.4, medium: 0.35, large: 0.25 } as const; // TUNE
/** Камень летит в случайную точку центральной части поля: доля отступа от краёв. */
export const ASTEROID_AIM_INSET = 0.2;
export const ASTEROID_SPAWN_GAP = 8; // рождается за краем поля, px
export const ASTEROIDS_MAX = 240; // размер пула (стены Роя — до сотни камней сразу)
/** Хитбокс камня чуть меньше рисунка: задевание краем контура прощается. */
export const ASTEROID_HITBOX_K = 0.85;
/** Настройка лобби «Камни отскакивают»: упругий удар, масса ∝ площади; выкл. — пролетают насквозь. */
export const ROCK_BOUNCE_DEFAULT = false;
export const ROCK_RESTITUTION = 0.9;
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
export const ASTEROID_GLOW_PX = 16; // неоновый ореол контура: несколько полос, к краю прозрачнее
export const ASTEROID_GLOW_LAYERS = 4;
export const ASTEROID_GLOW_ALPHA = 0.22; // у самого контура
/** Запас кадра за самой дальней вершиной и ореолом: свечение не обрезается краем кадра. */
export const ASTEROID_TEXTURE_PAD = 4;
// Осколки: только вид, урона не наносят
export const DEBRIS_COUNT = { small: 5, medium: 7, large: 9 } as const;
export const DEBRIS_SPEED = [120, 320] as const;
export const DEBRIS_S = 0.9; // было 0,6: через полсекунды осколков уже не было видно
export const BREAK_SPARKS_K = 2; // искр при взрыве камня — вдвое больше, чем осколков
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
export const LIVES_Y = 44; // под центром корабля
export const LIVES_LOST_ALPHA = 0.2;
/** Жизни сердечками и патроны полосками под кораблём — по шаблону заказчика (размеры шаблона, px мира). */
export const HEART_STEP = 13; // сердечко 9 px, зазор 4
export const AMMO_BARS = 5; // каждая полоска — 2 патрона; выстрел убирает половину
export const AMMO_BAR_W = 12;
export const AMMO_BAR_H = 3;
export const AMMO_BAR_GAP = 2;
export const AMMO_Y = 53.5; // под сердечками
export const AMMO_EMPTY_COLOR = '#494949';

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
export const AMMO_BASE_S = 2; // решение заказчика (было 3)
export const AMMO_MULT_K = 0.8; // ×2 — 1,1 с, ×3 — 0,77, ×4 — 0,59, ×5 — 0,48 (решение заказчика: на ×5 ≈ 0,5 с)
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
export const WAVE_DENSITY_GROWTH = 0.06; // TUNE: +6 % камней за волну (к 20-й — ×2,1)
export const WAVE_SPEED_GROWTH = 0.03; // TUNE: +3 % скорости за волну (к 20-й — ×1,6)
/** Нижний предел роста на лёгкой стартовой сложности: поток не падает ниже половины базы. */
export const WAVE_GROWTH_MIN = 0.5;
/** Стартовая сложность из лобби — сдвиг по волнам: лёгкая начинает как «волна −3», сложная — как пятая. */
export const DIFFICULTY_WAVE_SHIFT = { easy: -3, normal: 0, hard: 4 } as const;
/** После 20-й волны — финиш: пауза, чтобы увидеть уведомление. */
export const WAVE_FINISH_DELAY_S = 3;
export const WAVES_SEED_SALT = 0x3a7e5; // своя случайность осложнений, из сида матча

// Осложнения (SPACE_WAR_SPEC §5 «Волны»). Решение заказчика: в каждой волне, кроме первой и волн боссов,
// без повторов в матче — обычных волн как раз столько, сколько осложнений, порядок — из сида.
export const COMPLICATIONS = [
  'dark', 'fast', 'dense', 'vortex', 'jam', 'small', 'large',
  'current', 'slippery', 'recoil', 'aliens', 'phantom', 'bombs',
] as const;
export type Complication = (typeof COMPLICATIONS)[number];
export const COMPLICATION_FROM_WAVE = 2; // первая волна — без осложнения, чтобы освоиться
/** Множитель потока камней. */
export const COMPLICATION_FLOW: Record<Complication, number> = {
  dark: 1, fast: 1, dense: 2, vortex: 1, jam: 1, small: 3,
  large: 0.6, // TUNE: одни крупные при том же потоке — стена
  current: 1, slippery: 1, recoil: 1, aliens: 1, phantom: 1,
  bombs: 2, // бомб вдвое больше, чем камней было бы в этой волне
};
/** Множитель скорости камней. */
export const COMPLICATION_SPEED: Record<Complication, number> = {
  dark: 1, fast: 1.5, dense: 0.6, vortex: 1, jam: 1, small: 1, large: 1,
  current: 2, slippery: 1, recoil: 1, aliens: 1, phantom: 1, bombs: 1,
};
// Течение: постоянная сила сносит корабли и камни в одну сторону (из сида: ←, →, ↑ или ↓); камни идут только по ней.
export const CURRENT_SHIP_ACCEL = 920; // TUNE: px/с²; с сопротивлением корабль сносит ~300 px/с (заказчик: ×2)
export const CURRENT_ROCK_ACCEL = 120; // px/с² — камни разгоняются по течению
export const CURRENT_SPREAD_RAD = 0.25; // камни идут почти параллельно
export const CURRENT_STREAKS = 40; // на поле — бледные чёрточки по течению
export const CURRENT_STREAK_PX = 70;
export const CURRENT_STREAK_ALPHA = 0.12;
// Скользкий космос: сопротивление ниже — корабль тормозит гораздо дольше.
export const SLIPPERY_DRAG_K = 0.22;
// Отдача: каждый выстрел толкает корабль назад.
export const RECOIL_SPEED = 240; // TUNE: px/с — средне
// Инопланетяне: мельче мелкого камня, быстрее камней; с краёв летят к ближайшему кораблю сквозь камни;
// три попадания; цепляются к кораблю и замедляют его (до пяти — дальше не хуже); в конце волны отстают и уходят.
export const ALIEN_RADIUS = 11;
export const ALIEN_HP = 3;
export const ALIEN_SPEED = 270; // TUNE: px/с
export const ALIEN_STEER = 2.2; // 1/с: как быстро доворачивает на корабль
export const ALIEN_FLOW_K = 1.5; // инопланетян в секунду — в 1,5 раза больше, чем камней
export const ALIENS_MAX = 60;
export const ALIEN_SLOW_STEP = 0.11; // каждый прилипший — минус 11 % тяги и предела скорости
export const ALIEN_SLOW_MAX_COUNT = 5; // дальше не медленнее (−55 %)
export const ALIEN_LEAVE_SPEED = 260;
export const ALIEN_SCORE = 30; // × множитель
export const ALIEN_BODY = '#7CFF8A';
export const ALIEN_EYE = '#B05CFF';
export const ALIEN_BEAM = '#B05CFF';
export const ALIEN_TRAIL_S = 0.35; // неоновый фиолетовый след гаснет за столько
export const ALIEN_TRAIL_PX = 5; // толщина следа у тельца
// Призрак: камни гаснут на 2 с, вспыхивают на 1 с; попадание — видно 0,5 с. Удариться можно и о погасший.
export const PHANTOM_HIDE_S = 2;
export const PHANTOM_SHOW_S = 1;
export const PHANTOM_REVEAL_S = 0.25; // заказчик: вдвое короче
export const PHANTOM_REVEAL_IN_S = 0.06; // попадание — камень плавно проявляется
export const PHANTOM_REVEAL_OUT_S = 0.15; // и плавно гаснет
export const PHANTOM_ALPHA = 0.05;
export const PHANTOM_FADE_S = 0.25;
// Бомбы: вместо камней — бомбы трёх размеров. Бомба о бомбу — обе взрываются; выстрел — взрыв;
// корабль врезался — минус жизнь и сильный отброс. Взрыв отталкивает бомбы и корабли: ближе — сильнее.
export const BOOM_RADIUS = { small: 170, medium: 230, large: 300 } as const;
export const BOOM_PUSH = 2100; // px/с у центра, к краю радиуса — до нуля (заказчик: ×3)
export const BOOM_PUSH_K = { small: 0.8, medium: 1, large: 1.4 } as const; // большая бомба толкает сильнее
export const BOOM_HIT_PUSH = 2700; // корабль, врезавшийся в бомбу, отлетает сильно
/** Отброс корабля — отдельный импульс поверх его скорости: не режется пределом скорости, гаснет сам. */
export const KNOCK_DRAG = 3.5; // 1/с
export const BOOM_COLOR = '#FF6B3D';
export const BOOM_SPARKS = 26;
export const BOMB_FUSE_TINT = '#FFB8A0'; // бомба мигает: светлее и обратно
export const VORTEX_SHIP_PULL = 420; // TUNE: px/с² к центру; с сопротивлением корабль сносит ~140 px/с
export const VORTEX_ROCK_PULL = 90; // TUNE: px/с², только пока камень летит к центру — потом уходит
export const DARK_RADIUS = 260; // TUNE: круг видимости вокруг корабля
export const DARK_ALPHA = 0.96;
export const DARK_EDGE = 0.45; // доля радиуса на мягкий край
export const DARK_FADE_S = 1; // темнота наплывает и уходит
export const DARK_TEXTURE_RES = 0.25; // темноту рисуем в четверть разрешения — края всё равно мягкие
// Воронка: к центру сходятся бледные кольца — видно, куда тянет.
export const VORTEX_RINGS = 3;
export const VORTEX_RING_MAX = 420; // радиус, с которого кольцо начинает сходиться
export const VORTEX_RING_S = 2.4; // за столько кольцо доходит до центра
export const VORTEX_RING_ALPHA = 0.22;
export const VORTEX_RING_PX = 3;

// Интерфейс волн: номер и время — мелко вверху по центру; уведомления — под ними.
export const WAVE_HUD_FONT_PX = 22;
export const NOTICE_FONT_PX = 34;
export const NOTICE_Y = 140;
export const NOTICE_PAD_X = 32;
export const NOTICE_PAD_Y = 14;
export const NOTICE_PLATE_ALPHA = 0.7;
export const CAMERA_ZOOM_STEP_PLAYERS = 2; // шаг отдаления на каждые 2 игрока
export const CAMERA_ZOOM_STEP = 0.15; // TUNE: на столько мир шире и выше за шаг (10 игроков — ×1,6)
/** Размер мира под экран и число игроков: камера отъезжает, пропорции поля не меняются. */
export const worldZoom = (players: number): number =>
  1 + CAMERA_ZOOM_STEP * Math.floor(Math.max(0, players - 1) / CAMERA_ZOOM_STEP_PLAYERS);
/** Настройка лобби «Размер поля» (решение заказчика): «Авто» — по числу игроков, или любой из шагов вручную. */
export const FIELD_SIZES = [1, 2, 3, 4, 5] as const; // шаг 1 — как на 1–2 игроков, 5 — как на 9–10
export type FieldSize = (typeof FIELD_SIZES)[number];
export const FIELD_SIZE_DEFAULT = 'auto';
export const fieldZoom = (size: unknown, players: number): number =>
  FIELD_SIZES.includes(size as FieldSize) ? 1 + CAMERA_ZOOM_STEP * ((size as FieldSize) - 1) : worldZoom(players);

// ─── Боссы ───────────────────────────────────────────────────────
export const BOSS_HP_PLAYER_K = 0.7; // прочность = база · (1 + 0.7 · (N − 1))
export const BOSS_BASE_HP = { seeder: 25, hunter: 26, fortress: 18, giant: 30 } as const;
export const SWARM_DURATION_S = 28;
export const VORTEX_DURATION_S = 30;
export type BossKind = 'seeder' | 'hunter' | 'swarm' | 'fortress' | 'giant' | 'vortex';
export type TargetBossKind = keyof typeof BOSS_BASE_HP;
/** Волна → босс (решение заказчика: боссы чаще — 4, 8, 11, 14, 17, 20; поздние волны и без того длиннее).
 *  Цели (seeder, hunter, fortress, giant) идут, пока живы; испытания (swarm, vortex) — ровно своё время. */
export const BOSS_OF_WAVE: Readonly<Record<number, BossKind>> = {
  4: 'seeder',
  8: 'hunter',
  11: 'swarm',
  14: 'fortress',
  17: 'giant',
  20: 'vortex',
};
/** Волны боссов: в них осложнений нет. */
export const BOSS_WAVES: readonly number[] = Object.keys(BOSS_OF_WAVE).map(Number);
export const BOSS_HITBOX_K = 0.9; // тело босса чуть меньше рисунка
/** Цель, которую никто не добивает (одни слабые боты), уходит через столько секунд — без очков за босса. */
export const BOSS_TARGET_MAX_S = 120;
/** Поток камней с краёв в волне босса (доля обычного). */
export const BOSS_FLOW: Record<BossKind, number> = { seeder: 0.3, hunter: 0.4, swarm: 0.3, fortress: 0.35, giant: 0.5, vortex: 1 };
export const BOSS_ENTRY_SPEED = 160; // цель вплывает из-за верхнего края
export const BOSS_ROAM_INSET = 0.25; // цель бродит по середине поля
export const BOSS_ROAM_S = 5; // и меняет точку, к которой плывёт
export const BOSS_STEER = 0.8; // 1/с: насколько быстро цель поворачивает к точке
export const BOSS_COLOR = '#FF5DA2';
/** Свой цвет у каждого босса: рисунок, полоска прочности, взрыв. Охотник красится в цвет жертвы, это — без жертвы. */
export const BOSS_COLORS: Record<BossKind, string> = {
  seeder: '#5CFFB0',
  hunter: '#FF3B5C',
  swarm: '#FF8A8A',
  fortress: '#FFC46B',
  giant: '#FF8A3D',
  vortex: '#B57BFF',
};
export const BOSS_LINE_PX = 5;
export const BOSS_HP_RING_PX = 6;
export const BOSS_HP_RING_GAP = 14;
export const BOSS_EXPLOSION_SHARDS = 60;
export const SHAKE_BOSS_DEATH = 1;
export const BOSS_BAR_W = 440; // полоска вверху: у цели — прочность, у испытания — сколько осталось
export const BOSS_BAR_H = 10;
// Полоска босса вверху (решение заказчика: эффектно и понятно): имя, деления, след урона, вспышка от попадания
export const BOSS_BAR_SEGMENTS = 10;
export const BOSS_BAR_TRAIL_S = 0.6; // белый «след» отнятой прочности догоняет за столько
export const BOSS_FLASH_S = 0.12; // рисунок босса белеет от попадания
export const BOSS_HINT_S = 6; // подсказка «как победить» под полоской в начале волны
export const BOSS_HINT_FONT_PX = 22;
// Сеятель: не атакует, выбрасывает камни, пока жив.
export const SEEDER_RADIUS = 90;
export const SEEDER_SPEED = 70;
export const SEEDER_EMIT_PER_S = 0.9; // TUNE; × (1 + FLOW_PLAYER_K · (N − 1))
export const SEEDER_MEDIUM_CHANCE = 0.35; // остальное — мелкие
export const SEEDER_SPIN = 0.4;
// Охотник (решение заказчика): гонится за ближайшим живым кораблём (без неуязвимости), красится в его цвет,
// чуть медленнее камней и с небольшой инерцией — резкий манёвр уводит; расталкивает камни перед собой и
// бросает мелкие камни в жертву. Удар о него — минус жизнь и множитель, ему ничего. Убить — прочностью.
export const HUNTER_RADIUS = 46;
export const HUNTER_SPEED = 165; // TUNE: px/с — медленнее большинства камней
export const HUNTER_STEER = 1.6; // TUNE: 1/с — инерция: чем меньше, тем дальше проскакивает
export const HUNTER_SWITCH_K = 0.75; // другая жертва — только если она ближе на четверть
export const HUNTER_PUSH_RADIUS = 150; // камни ближе — отталкиваются
export const HUNTER_PUSH = 900; // px/с²
export const HUNTER_SHOT_S = 2.4; // TUNE: бросок мелкого камня в жертву; ÷ (1 + FLOW_PLAYER_K · (N − 1))
export const HUNTER_SHOT_SPEED = 300;
export const HUNTER_SHOT_RANGE = 900; // дальше жертвы не бросает
export const HUNTER_TETHER_ALPHA = 0.35; // пунктир «на прицеле» от Охотника к жертве
// Крепость (решение заказчика): ядро в центре, два кольца камней-брони вращаются навстречу, в кольцах разрывы.
// Автонаведение бьёт в ближайшее — издалека патроны уходят в броню; влетел в разрыв ближе к ядру — бей ядро.
// С игроками растут прочность и скорость колец. Ядро убито — броня разлетается обычными камнями.
export const FORTRESS_CORE_RADIUS = 56;
export const FORTRESS_ROCK: AsteroidSize = 'medium';
/** Кольца: радиус, мест для камней, разрывы (сколько мест подряд пусто, сколько таких разрывов), скорость, рад/с. */
export const FORTRESS_RINGS = [
  { radius: 195, slots: 15, gap: 2, gaps: 2, spin: 0.32 },
  { radius: 345, slots: 27, gap: 2, gaps: 2, spin: -0.22 },
] as const;
export const FORTRESS_SPIN_PLAYER_K = 0.08; // вращение × (1 + 0.08 · (N − 1))
export const FORTRESS_FORM_S = 1.6; // кольца разворачиваются от ядра
export const FORTRESS_BREAK_SPEED = 220; // броня разлетается, когда ядро убито
export const FORTRESS_TINT = '#FFD27A';
// Гигант: от каждого попадания откалывается живой кусок.
export const GIANT_RADIUS = 150;
export const GIANT_SPEED = 45;
export const GIANT_CHUNK: AsteroidSize = 'medium';
export const GIANT_CHUNK_SPREAD_RAD = 0.6;
export const GIANT_SPIN = 0.15;
export const GIANT_SHAPE_POINTS = 14;
export const GIANT_SHAPE_JITTER = 0.18;
// Рой: камни стеной проходят поле, перестраиваются; убить нельзя.
// Рой (решение заказчика): в начале все камни поля взрываются (с шансом усиления), дальше — 10 стен с проходом
// с разных сторон по очереди; иногда две стены сразу с противоположных сторон — проходы у них на одной линии.
export const SWARM_WALLS = 10;
export const SWARM_WALL_EVERY_S = 2.3; // TUNE: новая стена (или пара) — через столько
export const SWARM_WARN_S = 1; // перед выходом стена мигает у края — видно, откуда и где проход
export const SWARM_PAIR_CHANCE = 0.3; // доля пар «с двух сторон сразу»
export const SWARM_SPACING = 50; // между камнями стены: корабль не пролезет
export const SWARM_PLAYER_K = 0.03; // скорость стен × (1 + 0.03 · (N − 1))
export const SWARM_WALL_SPEED = 360; // TUNE: px/с, с какой стена идёт через поле
export const SWARM_GAP = 250; // проход в стене
export const SWARM_GAP_INSET = 120; // проход не у самого края
export const SWARM_OUTSIDE = 80; // стена начинает и кончает за краем
export const SWARM_TINT = '#FF8A8A';
export const SWARM_WARN_HZ = 3; // мигание полосы-предупреждения
export const SWARM_WARN_INSET = SWARM_OUTSIDE + 10; // полоса — чуть внутри поля у края выхода
export const SWARM_WALL_W = 22; // бледная полоса стены
export const SWARM_CHEVRONS = 3; // стрелок в проходе
// Воронка-босс: неуязвимое ядро в центре, тянет сильнее осложнения.
export const VORTEX_BOSS_K = 1.8;
export const VORTEX_PLAYER_K = 0.06; // тяга × (1 + 0.06 · (N − 1))
export const VORTEX_CORE_RADIUS = 60;
export const VORTEX_ARMS = 4;
export const VORTEX_ARM_TURNS = 1.2;
export const VORTEX_SPIN = 1.4;

// ─── Усиления ────────────────────────────────────────────────────
export const POWERUP_DROP_CHANCE = 1 / 20; // с разрушенного астероида — «Редко»
/** Настройка лобби «Частота усилений» (решение заказчика): множитель шанса выпадения. «Редко» — как было, «Очень часто» — в 6 раз чаще. */
export const POWERUP_RATES = { rare: 1, normal: 2, often: 4, max: 6 } as const;
export type PowerupRate = keyof typeof POWERUP_RATES;
export const POWERUP_RATE_KEYS = Object.keys(POWERUP_RATES) as PowerupRate[];
export const POWERUP_RATE_DEFAULT: PowerupRate = 'normal';
export const POWERUP_LIFETIME_S = 10;
export const SHIELD_S = 8;
export const FREEZE_S = 3;
export const OVERLOAD_S = 5;
export const OVERLOAD_FACTOR = 2; // максимум итогового множителя ×10
export const JAMMER_S = 5;
export const POWERUPS = ['repair', 'ammo', 'shield', 'freeze', 'overload', 'double', 'jammer'] as const;
export type PowerupKind = (typeof POWERUPS)[number];
/** Решение заказчика: Расчистки нет; Заморозка, Перегрузка и «×2 пули» — во всех режимах; Глушилка — только против соперников. */
export const POWERUPS_OF_MODE: Record<Mode, readonly PowerupKind[]> = {
  coop: ['repair', 'ammo', 'shield', 'freeze', 'overload', 'double'],
  versus: ['repair', 'ammo', 'shield', 'freeze', 'overload', 'double', 'jammer'],
  teams: ['repair', 'ammo', 'shield', 'freeze', 'overload', 'double', 'jammer'],
};
export const POWERUP_RADIUS = 24; // радиус подбора
export const POWERUP_BLINK_S = 2; // последние секунды на поле — мигает
export const POWERUP_BLINK_HZ = 4;
/** Цвета — по шаблону иконок заказчика (свечение, вспышка подбора). */
export const POWERUP_COLOR: Record<PowerupKind, string> = {
  repair: '#2BFF4A',
  ammo: '#FFA51F',
  shield: '#0059FF',
  freeze: '#00FFE6',
  overload: '#FF3B30',
  double: '#FFC46B',
  jammer: '#FFFFFF',
};
// «×2 пули» (решение заказчика): 10 с два снаряда за один патрон, каждый — двойной урон.
export const DOUBLE_S = 10;
export const DOUBLE_DAMAGE = 2;
export const DOUBLE_OFFSET = 9; // снаряды идут рядом, на столько в стороны от оси
export const DOUBLE_SPARK_PER_S = 10; // мелкие искры на полосках патронов, пока действует
// Выпадение: вспышка и свечение, усиление подпрыгивает и медленно плывёт в случайную сторону.
export const POWERUP_ICON_PX = 48; // видимый размер значка
export const POWERUP_DRIFT_SPEED = 22; // px/с
export const POWERUP_HOP_S = 0.7;
export const POWERUP_HOP_PX = 30;
export const POWERUP_BOB_PX = 4; // потом — мягко покачивается
export const POWERUP_BOB_HZ = 0.8;
export const POWERUP_HALO_PX = 52; // радиус мягкого ореола (гаусс — гаснет к краю)
export const POWERUP_HALO_ALPHA = 0.35;
export const POWERUP_DROP_SPARKS = 18;
export const POWERUP_DROP_RING_S = 0.45;
export const POWERUP_DROP_RING_PX = 70;
// Подбор: неяркая вспышка корабля цветом усиления; ремонт — сердечко подрастает, боезапас — полоски ярче и чуть больше.
export const PICKUP_FLASH_S = 0.4;
export const PICKUP_FLASH_ALPHA = 0.55;
export const PICKUP_FLASH_PX = 7;
export const HEART_POP_S = 1;
export const HEART_POP_SCALE = 0.7;
export const AMMO_GLOW_S = 1;
export const AMMO_GLOW_SCALE = 0.35;
export const AMMO_GLOW_ALPHA = 0.5;
export const AMMO_JAMMED_COLOR = '#6B6B6B'; // под Глушилкой полоски серые
/** Перегрузка: корабль и след ярко-бордовые (не красный палитры); за 1 с до конца тускнеет. */
export const OVERLOAD_COLOR = '#C2185B';
export const OVERLOAD_FADE_S = 1;
export const SHIELD_RADIUS_K = 1.5; // пузырь щита — столько размеров корабля
export const SHIELD_LINE_PX = 3;
export const SHIELD_ALPHA = 0.7;
export const SHIELD_BLINK_S = 1.5;
export const FREEZE_TINT = '#BDF3FF';
export const VIBRATE_PICKUP = [25, 70, 25]; // два коротких импульса
export const BOT_POWERUP_RANGE = 420; // средний и сильный бот летит к усилению, если оно близко

// ─── Саботаж ─────────────────────────────────────────────────────
export const SAB_COOLDOWN_S = { rock: 5, bomb: 8 } as const; // + 1 с за каждого погибшего
export const SAB_ROCK_HP = [4, 5] as const;
export const SAB_SPEED_STEPS = [0.5, 1, 2, 3] as const; // × скорость обычного астероида
// Ступени силы, отмена и рамка — у раскладки «прицел» платформы (shared/config: AIM_*).
export type SabKind = keyof typeof SAB_COOLDOWN_S;
export const SAB_KINDS: readonly SabKind[] = ['rock', 'bomb'];
export const SAB_DEAD_EXTRA_S = 1; // + к кулдауну за каждого погибшего
export const SAB_ROCK_SIZE: AsteroidSize = 'medium';
export const BOMB_RADIUS = 20;
export const BOMB_BLAST_RADIUS = 280; // TUNE: радиус отброса
export const BOMB_PUSH = 900; // TUNE: px/с у центра взрыва, к краю радиуса — до нуля
export const BOMB_FUSE_HZ = 4; // мигание фитиля
export const SHAKE_BOMB = 0.35;
export const SAB_TRAIL_ALPHA = 0.25;
// Боты-саботажники: после готовности ждут, целятся в соперника с упреждением.
export const BOT_SAB_WAIT_S = { weak: 2.5, mid: 1.2, strong: 0.5 } as const;
export const BOT_SAB_STEP = 3;
export const BOT_SAB_ROCK_CHANCE = 0.5; // иначе — бомба
export const BOT_SAB_LEAD_S = 0.8;

// ─── Лобби (Б5, SPACE_WAR_SPEC §8) ───────────────────────────────
/** Формы корпуса: треугольник, круг, квадрат, звезда — у каждой свои варианты рисунка. Хитбокс у всех один. */
export const HULLS = [
  'arrow', 'spire', 'delta', 'needle', 'stealth', 'chevron', // треугольные
  'planet', 'jelly', 'saucer', 'comet', 'arch', 'dome', // круглые
  'diamond', 'gem', 'crystal', 'prism', 'ark', 'tower', // гранёные
  'rocket', 'jet', 'raptor', 'starship', 'nova', 'bat', // крылатые
  'spark', 'star', 'bolt', 'sword', 'cat', 'ghost', // особые
] as const;
export type Hull = (typeof HULLS)[number];
export const HULL_DEFAULT: Hull = 'arrow';
/** У ботов один статичный корпус. */
export const HULL_BOT: Hull = 'delta';
export const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_DEFAULT: Difficulty = 'normal';
export const BOT_LEVELS = ['weak', 'mid', 'strong'] as const;
export const BOT_LEVEL_DEFAULT = 'mid';
// Цвета вариантов в лобби: от спокойного к жаркому — понятно без подписи
const CALM = '#8FA3BF';
const EASY = '#4ADE80';
const WARM = '#FFC46B';
const HOT = '#FF5D5D';
export const RATE_COLOR: Record<PowerupRate, string> = { rare: CALM, normal: EASY, often: WARM, max: '#FF5DA2' };
export const DIFFICULTY_COLOR: Record<Difficulty, string> = { easy: EASY, normal: WARM, hard: HOT };
export const BOT_LEVEL_COLOR: Record<BotLevel, string> = { weak: EASY, mid: WARM, strong: HOT };
export const QUALITY_CHOICES = ['auto', 'low', 'mid', 'high'] as const;
export const GHOST_S_RANGE = { min: 10, max: 30, step: 5 } as const;

// ─── Боты (Б6, SPACE_WAR_SPEC §8) ────────────────────────────────
export type BotLevel = 'weak' | 'mid' | 'strong';
/** Задержка реакции: бот видит мир таким, каким он был столько секунд назад. */
export const BOT_REACTION_S = { weak: 0.4, mid: 0.2, strong: 0.08 } as const;
export const BOT_THRUST = { weak: 0.6, mid: 0.85, strong: 1 } as const; // доля полного ввода
/** Пауза между выстрелами; слабый не стреляет. */
export const BOT_FIRE_GAP_S = { weak: Number.POSITIVE_INFINITY, mid: 0.8, strong: 0.45 } as const;
export const BOT_LOOKAHEAD_S = 1.4; // на сколько вперёд бот предсказывает камни (плюс своя задержка реакции)
export const BOT_SAFE_MARGIN = 60; // запас сверх хитбоксов
export const BOT_AVOID_WEIGHT = 3;
export const BOT_WALL_MARGIN = 150; // ближе к стене — отталкивается
export const BOT_EDGE_HOME = 280; // слабый держится у края на таком расстоянии (ближе — камни из-за края не успеть увидеть)
export const BOT_WANDER_S = 3; // средний и сильный меняют точку, к которой плывут
export const BOT_WANDER_INSET = 0.2; // точки — в середине поля
export const BOT_ARRIVE_PX = 220; // ближе — сбавляет ход
export const BOT_CRUISE = 0.5; // к цели — вполсилы, полный ход — на уклонение
export const BOT_HUNT_RANGE = 520; // сильный ищет камень для сближения не дальше
export const BOT_FIRE_RANGE = 650; // средний стреляет по крупным не дальше
export const BOT_FIRE_MIN_RANGE = 260; // и не ближе: раскол вплотную бьёт по себе
export const BOT_THREAT_FIRE = 0.35; // сильный стреляет, когда угроза выше
export const BOT_SEED_SALT = 0xb07b07; // своя случайность ботов, из сида матча
export const BOT_BRAKE_SPEED = 1000; // px/с: такую скорость бот гасит полным ходом против неё
export const BOT_HUNT_GAP_K = 0.5; // сильный целится в середину зоны сближения

// ─── Воскрешение и призрак ───────────────────────────────────────
export const GHOST_S = 15; // настраивается в лобби
export const REVIVE_SHARDS = 3;
export const REVIVE_LIVES = 1;
export const REVIVE_INVULN_S = 2.5;
export const SHARD_RADIUS = 18;
export const SHARD_SPEED = 320; // разлетаются в разные стороны
export const SHARD_DRAG = 1.6; // 1/с: и останавливаются
export const SHARD_PUSH_SPEED = 420; // чужой корабль отталкивает осколок
export const SHARD_PULSE_HZ = 2;
export const GHOST_ALPHA = 0.35;
export const GHOST_PUSH_RADIUS = 110; // призрак слегка отталкивает камни
export const GHOST_PUSH = 160; // px/с²
export const GHOST_RING_PX = 3;
export const GHOST_RING_GAP = 34;

// ─── Звук (Б12) ──────────────────────────────────────────────────
// Всё синтезируется в браузере (без файлов) и идёт через общий выход Howler хаба:
// кнопка звука и общая громкость хаба действуют и на игру; музыка и эффекты — ползунками настроек хаба.
export const SFX_VOLUME = 0.55; // эффекты при ползунке 100 %
export const MUSIC_VOLUME = 0.32; // музыка при ползунке 100 %
export const SFX_VOICES_MAX = 24; // одновременно звучащих эффектов
export const SFX_MIN_GAP_S = 0.04; // один и тот же звук — не чаще
export const SFX_PAN = 0.6; // стереопанорама по положению на экране
export const MUSIC_BPM = 120;
export const MUSIC_BARS = 8;
export const MUSIC_RATE = 22050;
export const MUSIC_FADE_S = 1.2; // слои входят и уходят
export const MUSIC_PAUSE_K = 0.3; // на паузе музыка тише
/** Слой «мало жизней»: у кого-то из живых людей осталась последняя жизнь. */
export const LOW_LIVES = 1;
export const AUDIO_NOISE_SEED = 0x5a0d; // шум для эффектов — из своего генератора

// ─── Итоги и записи (Б13) ────────────────────────────────────────
export const REPLAY_TAIL_S = 5; // замедленный повтор последних секунд матча
export const REPLAY_SLOW = 0.4; // во столько раз медленнее (5 с → 12,5 с)
