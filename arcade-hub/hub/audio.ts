// Звук хаба (ARCADE_HUB_SPEC §19) через Howler.js: звуки интерфейса и тихая фоновая музыка меню.
// Браузер не даёт играть звук до первого действия человека — Howler сам разблокирует его на первом нажатии.
import { Howl, Howler } from 'howler';
import { MENU_MUSIC_VOLUME, MUSIC_FADE_MS, UI_SOUND_VOLUME } from '../shared/config';
import type { HubSettings } from '../shared/hub-settings';
import clickUrl from './assets/sounds/click.wav';
import joinUrl from './assets/sounds/join.wav';
import openUrl from './assets/sounds/open.wav';
import selectUrl from './assets/sounds/select.wav';

export type UiSound = 'click' | 'select' | 'open' | 'join';

export interface UiSounds {
  play(name: UiSound): void;
  /** Общий выключатель звука хаба (кнопка в верхней полосе). */
  setEnabled(on: boolean): void;
  /** Громкости из настроек хаба. */
  configure(settings: HubSettings): void;
  /** Музыка меню: уходит при запуске игры, возвращается в меню. */
  music(on: boolean): void;
}

const PERCENT = 100;
const MS_PER_S = 1000;

// ─── Музыка меню: спокойный цикл из четырёх аккордов, собирается в браузере (без файлов) ───
const MUSIC_RATE = 22050;
const CHORD_S = 4;
/** Ля минор: Am7 → Fmaj7 → Cmaj7 → G6. Частоты, Гц. */
const CHORDS: readonly (readonly number[])[] = [
  [220.0, 261.63, 329.63, 392.0],
  [174.61, 220.0, 261.63, 329.63],
  [261.63, 329.63, 392.0, 493.88],
  [196.0, 246.94, 293.66, 329.63],
];
const BASS = [110.0, 87.31, 130.81, 98.0];
const PAD_GAIN = 0.05;
const BASS_GAIN = 0.07;
const ARP_GAIN = 0.035;
const ARP_STEP_S = 0.5;
const ATTACK_S = 1.2;
const PLUCK_S = 0.9;
const PLUCK_ATTACK_S = 0.01;
/** Экспоненциальный спад не доходит до нуля — гасим до почти тишины. */
const SILENCE = 0.0001;

async function renderMusic(): Promise<AudioBuffer | null> {
  const Offline = window.OfflineAudioContext;
  if (!Offline) return null;
  const length = CHORDS.length * CHORD_S;
  const ctx = new Offline(1, MUSIC_RATE * length, MUSIC_RATE);

  const tone = (freq: number, type: OscillatorType, start: number, dur: number, peak: number, attack: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(SILENCE, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur);
  };

  CHORDS.forEach((chord, i) => {
    const start = i * CHORD_S;
    for (const f of chord) tone(f, 'triangle', start, CHORD_S + ATTACK_S / 2, PAD_GAIN, ATTACK_S);
    tone(BASS[i] as number, 'sine', start, CHORD_S, BASS_GAIN, ATTACK_S / 2);
    // Лёгкое арпеджио октавой выше.
    for (let step = 0; step * ARP_STEP_S < CHORD_S; step++) {
      const note = (chord[step % chord.length] as number) * 2;
      tone(note, 'sine', start + step * ARP_STEP_S, PLUCK_S, ARP_GAIN, PLUCK_ATTACK_S);
    }
  });
  return ctx.startRendering();
}

export function createUiSounds(enabled: boolean): UiSounds {
  let uiVolume = UI_SOUND_VOLUME;
  let menuSounds = true;
  let musicLevel = MENU_MUSIC_VOLUME;
  let musicWanted = true;

  const make = (src: string): Howl => new Howl({ src: [src], volume: UI_SOUND_VOLUME, preload: true });
  const sounds: Record<UiSound, Howl> = {
    click: make(clickUrl),
    select: make(selectUrl),
    open: make(openUrl),
    join: make(joinUrl),
  };
  Howler.mute(!enabled);

  // Музыка идёт через общий выход Howler: кнопка звука и общая громкость действуют и на неё.
  let musicGain: GainNode | null = null;
  const fadeTo = (value: number, ms: number): void => {
    const ctx = Howler.ctx;
    if (!musicGain || !ctx) return;
    const now = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(now);
    musicGain.gain.setValueAtTime(musicGain.gain.value, now);
    musicGain.gain.linearRampToValueAtTime(value, now + ms / MS_PER_S);
  };
  void renderMusic()
    .then((buffer) => {
      const ctx = Howler.ctx;
      if (!buffer || !ctx || !Howler.masterGain) return;
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(Howler.masterGain);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(musicGain);
      source.start();
      if (musicWanted) fadeTo(musicLevel, MUSIC_FADE_MS);
    })
    .catch(() => undefined);

  return {
    play: (name) => {
      if (menuSounds) {
        sounds[name].volume(uiVolume);
        sounds[name].play();
      }
    },
    setEnabled: (on) => Howler.mute(!on),
    configure(settings) {
      Howler.volume(settings.master / PERCENT);
      uiVolume = (UI_SOUND_VOLUME * settings.effects) / PERCENT;
      menuSounds = settings.menuSounds;
      musicLevel = (MENU_MUSIC_VOLUME * settings.music) / PERCENT;
      if (musicWanted) fadeTo(musicLevel, MUSIC_FADE_MS);
    },
    music(on) {
      musicWanted = on;
      fadeTo(on ? musicLevel : 0, MUSIC_FADE_MS);
    },
  };
}
