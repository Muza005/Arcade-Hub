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
  | 'time'
  | 'setHull'
  | 'hull_arrow'
  | 'hull_delta'
  | 'hull_wing'
  | 'hull_ring'
  | 'hull_core'
  | 'hull_box'
  | 'hull_diamond'
  | 'hull_star5'
  | 'hull_star4'
  | 'setCollisions'
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
  | 'bot_strong';

export const strings: GameStrings<SpaceWarKey> = {
  ru: {
    title: 'Space War',
    tagline: 'Уворачивайся, рискуй ради множителя, отстреливайся.',
    howTo1: 'Уворачивайся от астероидов',
    howTo2: 'Пролетай вплотную — растёт множитель',
    howTo3: 'Power сам стреляет по камням',
    modeCoop: 'Кооператив',
    modeCoopDesc: 'Общие жизни, держитесь вместе',
    modeVersus: 'Соревнование',
    modeVersusDesc: 'Каждый сам за себя',
    modeTeams: 'Командное',
    modeTeamsDesc: 'Команда — это цвет',
    warning: 'Корабль в игре — его могут сбить',
    fps: '{n} FPS',
    colTime: 'Продержался',
    colScore: 'Очки',
    setHull: 'Корпус',
    hull_arrow: 'Стрела',
    hull_delta: 'Дельта',
    hull_wing: 'Крыло',
    hull_ring: 'Кольцо',
    hull_core: 'Ядро',
    hull_box: 'Короб',
    hull_diamond: 'Ромб',
    hull_star5: 'Звезда',
    hull_star4: 'Звезда-4',
    setCollisions: 'Столкновения кораблей',
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
  },
  en: {
    title: 'Space War',
    tagline: 'Dodge, risk it for the multiplier, shoot back.',
    howTo1: 'Dodge the asteroids',
    howTo2: 'Fly close — the multiplier grows',
    howTo3: 'Power auto-aims at rocks',
    modeCoop: 'Co-op',
    modeCoopDesc: 'Shared lives, stick together',
    modeVersus: 'Versus',
    modeVersusDesc: 'Every pilot for themselves',
    modeTeams: 'Teams',
    modeTeamsDesc: 'Your colour is your team',
    warning: 'Your ship is in play — it can be shot down',
    fps: '{n} FPS',
    colTime: 'Survived',
    colScore: 'Score',
    setHull: 'Hull',
    hull_arrow: 'Arrow',
    hull_delta: 'Delta',
    hull_wing: 'Wing',
    hull_ring: 'Ring',
    hull_core: 'Core',
    hull_box: 'Box',
    hull_diamond: 'Diamond',
    hull_star5: 'Star',
    hull_star4: 'Star-4',
    setCollisions: 'Ship collisions',
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
  },
};
