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
  | 'setPowerups'
  | 'setSabotage'
  | 'setDifficulty'
  | 'diff_easy'
  | 'diff_normal'
  | 'diff_hard'
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
  | 'noticeBoss'
  | 'noticeBossFinal'
  | 'noticeBossDown'
  | 'hudBoss'
  | 'statusBoss';

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
    setRockBounce: 'Камни отскакивают друг от друга',
    setPowerups: 'Усиления',
    setSabotage: 'Саботаж погибших',
    setDifficulty: 'Стартовая сложность',
    diff_easy: 'Лёгкая',
    diff_normal: 'Обычная',
    diff_hard: 'Тяжёлая',
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
    noticeBoss: 'Волна {n} · {boss}',
    noticeBossFinal: 'Волна {n} · {boss} · финал',
    noticeBossDown: '{boss} повержен · +{score}',
    hudBoss: '{n}/{of} · {boss}',
    statusBoss: 'Волна {n} · {boss}',
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
    setRockBounce: 'Rocks bounce off each other',
    setPowerups: 'Power-ups',
    setSabotage: 'Sabotage by the fallen',
    setDifficulty: 'Starting difficulty',
    diff_easy: 'Easy',
    diff_normal: 'Normal',
    diff_hard: 'Hard',
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
    noticeBoss: 'Wave {n} · {boss}',
    noticeBossFinal: 'Wave {n} · {boss} · final',
    noticeBossDown: '{boss} down · +{score}',
    hudBoss: '{n}/{of} · {boss}',
    statusBoss: 'Wave {n} · {boss}',
  },
};
