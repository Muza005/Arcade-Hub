// Манифест «Точек» (DOTS_SPEC «Манифест», ARCADE_HUB_SPEC §16). Код игры грузится только в load().
import type { GameManifest } from '../shared/game-manifest';
import cardArt from './assets/card.svg';
import cover from './assets/cover.svg';
import logo from './assets/logo.svg';
import modeFfaIcon from './assets/mode-ffa.svg';
import { ACCENT } from './config';
import { strings } from './strings';

export const dotsManifest: GameManifest = {
  id: 'dots',
  title: 'title',
  tagline: 'tagline',
  howToPlay: ['howTo1', 'howTo2', 'howTo3'],
  accent: ACCENT,
  cover,
  cardArt,
  logo,
  players: { min: 1, max: 10, keyboardMax: 2 },
  sessionMinutes: [1, 2],
  controls: ['keyboard', 'phone-joystick', 'phone-gyro', 'phone-buttons'],
  modes: [{ id: 'ffa', title: 'modeFfa', description: 'modeFfaDesc', icon: modeFfaIcon }],
  status: 'available',
  version: '1',
  load: async () => (await import('./game')).createDotsGame(),
  strings,
};
