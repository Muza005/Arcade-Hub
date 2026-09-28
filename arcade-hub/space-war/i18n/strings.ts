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
  | 'fps';

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
  },
};
