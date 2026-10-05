// Словарь Space War. Хаб берёт отсюда название, слоган, «Как играть», режимы и предупреждение (через манифест).
import type { GameStrings } from '../../shared/i18n';

export type SpaceWarKey =
  | 'title'
  | 'tagline'
  | 'howTo1'
  | 'howTo2'
  | 'howTo3'
  | 'modeCoop'
  | 'modeCoopDesc'
  | 'modeVersus'
  | 'modeVersusDesc'
  | 'modeTeams'
  | 'modeTeamsDesc'
  | 'warning'
  | 'fps'
  | 'colTime'
  | 'colScore'
  | 'colTotal'
  | 'colTeam'
  | 'time'
  | 'setHull'
  | 'hull_arrow'
  | 'hull_delta'
  | 'hull_wing'
  | 'hull_dart'
  | 'hull_chevron'
  | 'hull_needle'
  | 'hull_half'
  | 'hull_kite'
  | 'hull_prism'
  | 'hull_ring'
  | 'hull_core'
  | 'hull_box'
  | 'hull_diamond'
  | 'hull_star5'
  | 'hull_star4'
  | 'setCollisions'
  | 'setRockBounce'
  | 'setPowerupRate'
  | 'rate_rare'
  | 'rate_normal'
  | 'rate_often'
  | 'rate_max'
  | 'setPowerups'
  | 'setSabotage'
  | 'setDifficulty'
  | 'diff_easy'
  | 'diff_normal'
  | 'diff_hard'
  | 'setField'
  | 'field_auto'
  | 'field_1'
  | 'field_2'
  | 'field_3'
  | 'field_4'
  | 'field_5'
  | 'setQuality'
  | 'q_auto'
  | 'q_low'
  | 'q_mid'
  | 'q_high'
  | 'setGhost'
  | 'setBots'
  | 'bot_weak'
  | 'bot_mid'
  | 'bot_strong'
  | 'noticeWave'
  | 'noticeWaveComp'
  | 'noticeCleared'
  | 'noticeFinish'
  | 'comp_dark'
  | 'comp_fast'
  | 'comp_dense'
  | 'comp_vortex'
  | 'comp_jam'
  | 'comp_small'
  | 'comp_large'
  | 'hudWave'
  | 'hudBreak'
  | 'statusWave'
  | 'statusBreak'
  | 'statusFinish'
  | 'boss_seeder'
  | 'boss_swarm'
  | 'boss_giant'
  | 'boss_vortex'
  | 'boss_hunter'
  | 'boss_fortress'
  | 'hint_seeder'
  | 'hint_hunter'
  | 'hint_swarm'
  | 'hint_fortress'
  | 'hint_giant'
  | 'hint_vortex'
  | 'noticeBoss'
  | 'noticeBossFinal'
  | 'noticeBossDown'
  | 'hudBoss'
  | 'hudTrial'
  | 'statusBoss'
  | 'award_livingShield'
  | 'award_untouched'
  | 'award_daredevil'
  | 'award_sharpshooter'
  | 'award_kamikaze'
  | 'award_multHunter'
  | 'award_collector'
  | 'award_saboteur'
  | 'award_survivor'
  | 'award_onDuty'
  | 'n_hits_one'
  | 'n_hits_few'
  | 'n_hits_many'
  | 'n_hits_other'
  | 'n_near_one'
  | 'n_near_few'
  | 'n_near_many'
  | 'n_near_other'
  | 'n_rocks_one'
  | 'n_rocks_few'
  | 'n_rocks_many'
  | 'n_rocks_other'
  | 'n_rams_one'
  | 'n_rams_few'
  | 'n_rams_many'
  | 'n_rams_other'
  | 'n_saves_one'
  | 'n_saves_few'
  | 'n_saves_many'
  | 'n_saves_other'
  | 'n_pickups_one'
  | 'n_pickups_few'
  | 'n_pickups_many'
  | 'n_pickups_other'
  | 'n_throws_one'
  | 'n_throws_few'
  | 'n_throws_many'
  | 'n_throws_other'
  | 'n_points_one'
  | 'n_points_few'
  | 'n_points_many'
  | 'n_points_other'
  | 'valMult'
  | 'metaLast'
  | 'metaDaily'
  | 'metaBest';

export const strings: GameStrings<SpaceWarKey> = {
  ru: {
    title: 'Space War',
    tagline: 'Уворачивайся, рискуй ради множителя, отстреливайся.',
    howTo1: 'Уворачивайся от астероидов',
    howTo2: 'Пролетай вплотную — растёт множитель',
    howTo3: 'Power сам стреляет по камням',
    modeCoop: 'Кооператив',
    modeCoopDesc: 'Общий счёт, держитесь вместе',
    modeVersus: 'Соревнование',
    modeVersusDesc: 'Каждый сам за себя',
    modeTeams: 'Командное',
    modeTeamsDesc: 'Команда — это цвет',
    warning: 'Корабль в игре — его могут сбить',
    fps: '{n} FPS',
    colTime: 'Продержался',
    colScore: 'Очки',
    colTotal: 'Общий счёт',
    colTeam: 'Команда',
    setHull: 'Корпус',
    hull_arrow: 'Стрела',
    hull_delta: 'Дельта',
    hull_wing: 'Крыло',
    hull_dart: 'Дротик',
    hull_chevron: 'Шеврон',
    hull_needle: 'Игла',
    hull_half: 'Полукруг',
    hull_kite: 'Змей',
    hull_prism: 'Призма',
    hull_ring: 'Кольцо',
    hull_core: 'Ядро',
    hull_box: 'Короб',
    hull_diamond: 'Ромб',
    hull_star5: 'Звезда',
    hull_star4: 'Звезда-4',
    setCollisions: 'Столкновения кораблей',
    setRockBounce: 'Отскок астероидов',
    setPowerupRate: 'Частота усилений',
    rate_rare: 'Редко',
    rate_normal: 'Обычно',
    rate_often: 'Часто',
    rate_max: 'Очень часто',
    setPowerups: 'Усиления',
    setSabotage: 'Саботаж погибших',
    setDifficulty: 'Стартовая сложность',
    diff_easy: 'Лёгкая',
    diff_normal: 'Обычная',
    diff_hard: 'Тяжёлая',
    setField: 'Размер поля',
    field_auto: 'Авто — по игрокам',
    field_1: 'Малое',
    field_2: 'Компактное',
    field_3: 'Среднее',
    field_4: 'Большое',
    field_5: 'Огромное',
    setQuality: 'Качество графики',
    q_auto: 'Авто',
    q_low: 'Низкое',
    q_mid: 'Среднее',
    q_high: 'Высокое',
    setGhost: 'Время призрака, с',
    setBots: 'Уровень ботов',
    bot_weak: 'Слабые',
    bot_mid: 'Средние',
    bot_strong: 'Сильные',
    time: '{m}:{s}',
    noticeWave: 'Волна {n}',
    noticeWaveComp: 'Волна {n} · {c}',
    noticeCleared: 'Волна {n} пройдена · +{score}',
    noticeFinish: 'Финиш',
    comp_dark: 'Затемнение',
    comp_fast: 'Ускоренный поток',
    comp_dense: 'Плотное поле',
    comp_vortex: 'Воронка — центр тянет',
    comp_jam: 'Глушение — патроны не копятся',
    comp_small: 'Мелкий калибр',
    comp_large: 'Крупный калибр',
    hudWave: '{n}/{of} · {time}',
    hudBreak: 'Передышка · {time}',
    statusWave: 'Волна {n} · до конца {time}',
    statusBreak: 'Передышка · {time}',
    statusFinish: 'Финиш',
    boss_seeder: 'Сеятель',
    boss_swarm: 'Рой',
    boss_giant: 'Гигант',
    boss_vortex: 'Воронка',
    boss_hunter: 'Охотник',
    boss_fortress: 'Крепость',
    hint_seeder: 'Сеет камни, пока жив',
    hint_hunter: 'Гонится за ближайшим — уводи, остальные стреляют',
    hint_swarm: 'Стены камней — ищи проход',
    hint_fortress: 'Влети в разрыв и бей ядро вблизи',
    hint_giant: 'Каждое попадание откалывает кусок',
    hint_vortex: 'Затягивает в центр — держись на краю',
    noticeBoss: 'Волна {n} · {boss}',
    noticeBossFinal: 'Волна {n} · {boss} · финал',
    noticeBossDown: '{boss} повержен · +{score}',
    hudBoss: '{n}/{of} · {boss}',
    hudTrial: '{n}/{of} · {boss} · {time}',
    statusBoss: 'Волна {n} · {boss}',
    award_livingShield: 'Живой щит',
    award_untouched: 'Ни царапины',
    award_daredevil: 'Самый безрассудный',
    award_sharpshooter: 'Меткий',
    award_kamikaze: 'Камикадзе',
    award_multHunter: 'Охотник за множителем',
    award_collector: 'Собиратель',
    award_saboteur: 'Главный саботажник',
    award_survivor: 'Выживший',
    award_onDuty: 'В строю',
    n_hits_one: '{n} удар',
    n_hits_few: '{n} удара',
    n_hits_many: '{n} ударов',
    n_hits_other: '{n} удара',
    n_near_one: '{n} сближение',
    n_near_few: '{n} сближения',
    n_near_many: '{n} сближений',
    n_near_other: '{n} сближения',
    n_rocks_one: '{n} камень',
    n_rocks_few: '{n} камня',
    n_rocks_many: '{n} камней',
    n_rocks_other: '{n} камня',
    n_rams_one: '{n} таран',
    n_rams_few: '{n} тарана',
    n_rams_many: '{n} таранов',
    n_rams_other: '{n} тарана',
    n_saves_one: '{n} спасение',
    n_saves_few: '{n} спасения',
    n_saves_many: '{n} спасений',
    n_saves_other: '{n} спасения',
    n_pickups_one: '{n} усиление',
    n_pickups_few: '{n} усиления',
    n_pickups_many: '{n} усилений',
    n_pickups_other: '{n} усиления',
    n_throws_one: '{n} бросок',
    n_throws_few: '{n} броска',
    n_throws_many: '{n} бросков',
    n_throws_other: '{n} броска',
    n_points_one: '{n} очко',
    n_points_few: '{n} очка',
    n_points_many: '{n} очков',
    n_points_other: '{n} очка',
    valMult: '×{n}',
    metaLast: 'Волна {waves} · лучший — {nick}, {score}',
    metaDaily: 'Рекорд дня — {nick}, {score}',
    metaBest: 'Лучший — {nick}, {score}',
  },
  en: {
    title: 'Space War',
    tagline: 'Dodge, risk it for the multiplier, shoot back.',
    howTo1: 'Dodge the asteroids',
    howTo2: 'Fly close — the multiplier grows',
    howTo3: 'Power auto-aims at rocks',
    modeCoop: 'Co-op',
    modeCoopDesc: 'Shared score, stick together',
    modeVersus: 'Versus',
    modeVersusDesc: 'Every pilot for themselves',
    modeTeams: 'Teams',
    modeTeamsDesc: 'Your colour is your team',
    warning: 'Your ship is in play — it can be shot down',
    fps: '{n} FPS',
    colTime: 'Survived',
    colScore: 'Score',
    colTotal: 'Total',
    colTeam: 'Team',
    setHull: 'Hull',
    hull_arrow: 'Arrow',
    hull_delta: 'Delta',
    hull_wing: 'Wing',
    hull_dart: 'Dart',
    hull_chevron: 'Chevron',
    hull_needle: 'Needle',
    hull_half: 'Half',
    hull_kite: 'Kite',
    hull_prism: 'Prism',
    hull_ring: 'Ring',
    hull_core: 'Core',
    hull_box: 'Box',
    hull_diamond: 'Diamond',
    hull_star5: 'Star',
    hull_star4: 'Star-4',
    setCollisions: 'Ship collisions',
    setRockBounce: 'Asteroid bounce',
    setPowerupRate: 'Power-up frequency',
    rate_rare: 'Rare',
    rate_normal: 'Normal',
    rate_often: 'Often',
    rate_max: 'Very often',
    setPowerups: 'Power-ups',
    setSabotage: 'Sabotage by the fallen',
    setDifficulty: 'Starting difficulty',
    diff_easy: 'Easy',
    diff_normal: 'Normal',
    diff_hard: 'Hard',
    setField: 'Field size',
    field_auto: 'Auto — by players',
    field_1: 'Small',
    field_2: 'Compact',
    field_3: 'Medium',
    field_4: 'Large',
    field_5: 'Huge',
    setQuality: 'Graphics quality',
    q_auto: 'Auto',
    q_low: 'Low',
    q_mid: 'Medium',
    q_high: 'High',
    setGhost: 'Ghost time, s',
    setBots: 'Bot level',
    bot_weak: 'Weak',
    bot_mid: 'Medium',
    bot_strong: 'Strong',
    time: '{m}:{s}',
    noticeWave: 'Wave {n}',
    noticeWaveComp: 'Wave {n} · {c}',
    noticeCleared: 'Wave {n} cleared · +{score}',
    noticeFinish: 'Finish',
    comp_dark: 'Blackout',
    comp_fast: 'Fast stream',
    comp_dense: 'Dense field',
    comp_vortex: 'Vortex — the center pulls',
    comp_jam: 'Jamming — no ammo refill',
    comp_small: 'Small caliber',
    comp_large: 'Large caliber',
    hudWave: '{n}/{of} · {time}',
    hudBreak: 'Break · {time}',
    statusWave: 'Wave {n} · {time} left',
    statusBreak: 'Break · {time}',
    statusFinish: 'Finish',
    boss_seeder: 'Seeder',
    boss_swarm: 'Swarm',
    boss_giant: 'Giant',
    boss_vortex: 'Vortex',
    boss_hunter: 'Hunter',
    boss_fortress: 'Fortress',
    hint_seeder: 'Sows rocks while alive',
    hint_hunter: 'Chases the closest ship — lead it, others shoot',
    hint_swarm: 'Walls of rocks — find the gap',
    hint_fortress: 'Fly through a gap and hit the core up close',
    hint_giant: 'Every hit chips off a chunk',
    hint_vortex: 'Pulls to the centre — stay on the edge',
    noticeBoss: 'Wave {n} · {boss}',
    noticeBossFinal: 'Wave {n} · {boss} · final',
    noticeBossDown: '{boss} down · +{score}',
    hudBoss: '{n}/{of} · {boss}',
    hudTrial: '{n}/{of} · {boss} · {time}',
    statusBoss: 'Wave {n} · {boss}',
    award_livingShield: 'Living shield',
    award_untouched: 'Not a scratch',
    award_daredevil: 'Daredevil',
    award_sharpshooter: 'Sharpshooter',
    award_kamikaze: 'Kamikaze',
    award_multHunter: 'Multiplier hunter',
    award_collector: 'Collector',
    award_saboteur: 'Chief saboteur',
    award_survivor: 'Survivor',
    award_onDuty: 'On duty',
    n_hits_one: '{n} hit',
    n_hits_few: '{n} hits',
    n_hits_many: '{n} hits',
    n_hits_other: '{n} hits',
    n_near_one: '{n} near miss',
    n_near_few: '{n} near misses',
    n_near_many: '{n} near misses',
    n_near_other: '{n} near misses',
    n_rocks_one: '{n} rock',
    n_rocks_few: '{n} rocks',
    n_rocks_many: '{n} rocks',
    n_rocks_other: '{n} rocks',
    n_rams_one: '{n} ram',
    n_rams_few: '{n} rams',
    n_rams_many: '{n} rams',
    n_rams_other: '{n} rams',
    n_saves_one: '{n} save',
    n_saves_few: '{n} saves',
    n_saves_many: '{n} saves',
    n_saves_other: '{n} saves',
    n_pickups_one: '{n} power-up',
    n_pickups_few: '{n} power-ups',
    n_pickups_many: '{n} power-ups',
    n_pickups_other: '{n} power-ups',
    n_throws_one: '{n} throw',
    n_throws_few: '{n} throws',
    n_throws_many: '{n} throws',
    n_throws_other: '{n} throws',
    n_points_one: '{n} point',
    n_points_few: '{n} points',
    n_points_many: '{n} points',
    n_points_other: '{n} points',
    valMult: '×{n}',
    metaLast: 'Wave {waves} · best — {nick}, {score}',
    metaDaily: 'Daily best — {nick}, {score}',
    metaBest: 'Best — {nick}, {score}',
  },
};
