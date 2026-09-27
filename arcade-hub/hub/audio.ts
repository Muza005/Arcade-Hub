// Звуки интерфейса хаба (ARCADE_HUB_SPEC §19) через Howler.js.
// Браузер не даёт играть звук до первого действия человека — Howler сам разблокирует его на первом нажатии.
import { Howl, Howler } from 'howler';
import { UI_SOUND_VOLUME } from '../shared/config';
import clickUrl from './assets/sounds/click.wav';
import openUrl from './assets/sounds/open.wav';
import selectUrl from './assets/sounds/select.wav';

export type UiSound = 'click' | 'select' | 'open';

export interface UiSounds {
  play(name: UiSound): void;
  /** Общий выключатель звука хаба (кнопка в верхней полосе). */
  setEnabled(on: boolean): void;
}

export function createUiSounds(enabled: boolean): UiSounds {
  const make = (src: string): Howl => new Howl({ src: [src], volume: UI_SOUND_VOLUME, preload: true });
  const sounds: Record<UiSound, Howl> = { click: make(clickUrl), select: make(selectUrl), open: make(openUrl) };
  Howler.mute(!enabled);

  return {
    play: (name) => void sounds[name].play(),
    setEnabled: (on) => Howler.mute(!on),
  };
}
