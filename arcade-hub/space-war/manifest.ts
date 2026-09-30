// Манифест Space War (SPACE_WAR_SPEC §12, ARCADE_HUB_SPEC §16). Код игры грузится только в load().
import type { GameManifest } from '../shared/game-manifest';
import cardArt from './assets/card.svg';
import cover from './assets/cover.svg';
import logo from './assets/logo.svg';
import modeCoopIcon from './assets/mode-coop.svg';
import modeTeamsIcon from './assets/mode-teams.svg';
import modeVersusIcon from './assets/mode-versus.svg';
import { ACCENT, ACCENT_ALT, KEYBOARD_MAX } from './config';
import { strings } from './i18n/strings';
import { lobbySchema } from './lobby/schema';

export const spaceWarManifest: GameManifest = {
  id: 'space-war',
  title: 'title',
  tagline: 'tagline',
  howToPlay: ['howTo1', 'howTo2', 'howTo3'],
  accent: ACCENT,
  accentAlt: ACCENT_ALT,
  cover,
  cardArt,
  logo,
  players: { min: 1, max: 10, keyboardMax: KEYBOARD_MAX },
  sessionMinutes: [15, 25],
  controls: ['keyboard', 'phone-joystick', 'phone-gyro', 'phone-buttons'],
  modes: [
    { id: 'coop', title: 'modeCoop', description: 'modeCoopDesc', icon: modeCoopIcon },
    { id: 'versus', title: 'modeVersus', description: 'modeVersusDesc', icon: modeVersusIcon },
    // Цвет — это команда: в лобби несколько игроков могут выбрать один цвет.
    { id: 'teams', title: 'modeTeams', description: 'modeTeamsDesc', icon: modeTeamsIcon, sharedColors: true },
  ],
  status: 'available',
  version: '3',
  load: async () => (await import('./game')).createSpaceWarGame(),
  strings,
  // Главная кнопка — Power (патроны и ободок накопления — этап Б3).
  controllerLayout: { mainButton: true, warning: 'warning' },
  // Боты — три уровня (этап Б6); до тех пор корабли ботов стоят на месте.
  bots: true,
  lobby: lobbySchema,
};
