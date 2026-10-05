// Звук Space War (этап Б12): эффекты и послойная музыка, синтезированные в браузере.
// Выход — общий мастер Howler хаба: кнопка звука и общая громкость действуют и здесь.
// Громкость музыки и эффектов — ползунки настроек хаба. На ход матча звук не влияет.
import { Howler } from 'howler';
import { createRng } from '../../engine/rng';
import type { HubSettings } from '../../shared/hub-settings';
import {
  AUDIO_NOISE_SEED,
  MUSIC_BARS,
  MUSIC_BPM,
  MUSIC_FADE_S,
  MUSIC_PAUSE_K,
  MUSIC_RATE,
  MUSIC_VOLUME,
  SFX_MIN_GAP_S,
  SFX_PAN,
  SFX_VOICES_MAX,
  SFX_VOLUME,
} from '../config';

export type Sfx =
  | 'shot'
  | 'chip'
  | 'breakSmall'
  | 'breakMedium'
  | 'breakLarge'
  | 'near'
  | 'hit'
  | 'explode'
  | 'ram'
  | 'bump'
  | 'pickup'
  | 'overload'
  | 'jam'
  | 'blast'
  | 'bossDown'
  | 'waveStart'
  | 'waveClear'
  | 'revive'
  | 'ghost'
  | 'sabLaunch';

export type MusicLayer = 'wave' | 'boss' | 'low';

export interface GameAudio {
  /** pan — положение по ширине экрана, 0…1; pitch — множитель высоты (например, ступень множителя). */
  play(sfx: Sfx, pan?: number, pitch?: number): void;
  /** Какие слои музыки звучат. */
  layers(on: Record<MusicLayer, boolean>): void;
  pause(paused: boolean): void;
  dispose(): void;
}

const PERCENT = 100;
const SILENCE = 0.0001;
const SECONDS_PER_MINUTE = 60;
const BEATS_PER_BAR = 4;
const NOISE_S = 1;
const MS_PER_S = 1000;
const VOICE_TAIL_MS = 50;

/** Ля минор: Am → F → C → G, по два такта. Корни баса, Гц. */
const ROOTS = [55, 43.65, 65.41, 49];
/** Трезвучия октавой выше — для пэда и арпеджио. */
const TRIADS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [261.63, 329.63, 392],
  [196, 246.94, 293.66],
];

/** Тишина, если браузер без Web Audio или звук хаба ещё не создан. */
const SILENT: GameAudio = { play: () => undefined, layers: () => undefined, pause: () => undefined, dispose: () => undefined };

export function createGameAudio(settings: HubSettings): GameAudio {
  const ctx = Howler.ctx;
  const master = Howler.masterGain;
  if (!ctx || !master) return SILENT;

  const sfxBus = ctx.createGain();
  sfxBus.gain.value = (SFX_VOLUME * settings.effects) / PERCENT;
  sfxBus.connect(master);
  const musicBus = ctx.createGain();
  const musicLevel = (MUSIC_VOLUME * settings.music) / PERCENT;
  musicBus.gain.value = musicLevel;
  musicBus.connect(master);

  // Белый шум для взрывов и ударов — из своего генератора (Math.random запрещён).
  const rng = createRng(AUDIO_NOISE_SEED);
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_S), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rng.range(-1, 1);

  let voices = 0;
  const lastAt = new Map<Sfx, number>();
  let disposed = false;

  /** Выход одного звука: громкость с огибающей и панорама. */
  const out = (pan: number, t: number, peak: number, attack: number, decay: number): GainNode => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(SILENCE, t + attack + decay);
    const panner = ctx.createStereoPanner();
    panner.pan.value = (pan * 2 - 1) * SFX_PAN;
    gain.connect(panner).connect(sfxBus);
    voices++;
    setTimeout(() => voices--, (attack + decay) * MS_PER_S + VOICE_TAIL_MS);
    return gain;
  };

  const tone = (type: OscillatorType, f0: number, f1: number, dur: number, peak: number, pan: number, delay = 0): void => {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    osc.connect(out(pan, t, peak, 0.005, dur));
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  const hiss = (dur: number, peak: number, pan: number, filter: BiquadFilterType, f0: number, f1: number, delay = 0): void => {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    src.connect(bq).connect(out(pan, t, peak, 0.005, dur));
    src.start(t);
    src.stop(t + dur + 0.05);
  };

  const RECIPES: Record<Sfx, (pan: number, pitch: number) => void> = {
    shot: (p, k) => tone('square', 1400 * k, 420 * k, 0.08, 0.12, p),
    chip: (p) => tone('triangle', 2200, 1600, 0.04, 0.08, p),
    breakSmall: (p) => hiss(0.18, 0.25, p, 'bandpass', 3000, 900),
    breakMedium: (p) => {
      hiss(0.3, 0.35, p, 'lowpass', 2400, 300);
      tone('sine', 160, 60, 0.25, 0.25, p);
    },
    breakLarge: (p) => {
      hiss(0.55, 0.5, p, 'lowpass', 1800, 120);
      tone('sine', 110, 35, 0.5, 0.45, p);
    },
    // Сближение: короткий свист, выше с каждой ступенью множителя.
    near: (p, k) => tone('sine', 700 * k, 1100 * k, 0.09, 0.1, p),
    hit: (p) => {
      tone('sawtooth', 180, 50, 0.3, 0.35, p);
      hiss(0.25, 0.3, p, 'lowpass', 1200, 200);
    },
    explode: (p) => {
      hiss(1.1, 0.7, p, 'lowpass', 2600, 60);
      tone('sine', 90, 25, 0.9, 0.6, p);
    },
    ram: (p) => {
      tone('square', 320, 140, 0.18, 0.2, p);
      tone('square', 480, 200, 0.18, 0.15, p);
    },
    bump: (p) => tone('triangle', 260, 180, 0.08, 0.12, p),
    // Подбор — два коротких тона вверх (как два импульса вибрации).
    pickup: (p) => {
      tone('triangle', 660, 700, 0.1, 0.22, p);
      tone('triangle', 990, 1050, 0.14, 0.22, p, 0.09);
    },
    overload: (p) => {
      tone('sawtooth', 200, 1600, 0.5, 0.2, p);
      tone('square', 400, 3200, 0.5, 0.08, p);
    },
    jam: (p) => tone('square', 120, 90, 0.35, 0.15, p),
    blast: (p) => {
      hiss(0.8, 0.6, p, 'lowpass', 3000, 80);
      tone('sine', 70, 30, 0.7, 0.5, p);
    },
    bossDown: (p) => {
      hiss(2.2, 0.8, p, 'lowpass', 3000, 40);
      tone('sine', 60, 20, 2, 0.7, p);
      tone('sawtooth', 220, 55, 1.4, 0.2, p);
    },
    waveStart: () => {
      tone('triangle', 440, 440, 0.25, 0.18, 0.5);
      tone('triangle', 660, 660, 0.35, 0.18, 0.5, 0.12);
    },
    waveClear: () => {
      tone('triangle', 523, 523, 0.2, 0.18, 0.5);
      tone('triangle', 659, 659, 0.2, 0.18, 0.5, 0.1);
      tone('triangle', 784, 784, 0.4, 0.18, 0.5, 0.2);
    },
    revive: (p) => {
      for (let i = 0; i < 4; i++) tone('sine', 440 * 2 ** (i / 4), 440 * 2 ** (i / 4), 0.18, 0.18, p, i * 0.07);
    },
    ghost: (p) => tone('sine', 520, 180, 0.8, 0.18, p),
    sabLaunch: (p) => hiss(0.35, 0.18, p, 'bandpass', 600, 2400),
  };

  // ─── Музыка: три слоя одной длины, запущены вместе и зациклены — входят и уходят громкостью ───
  const layerGains = new Map<MusicLayer, GainNode>();
  const sources: AudioBufferSourceNode[] = [];
  let wanted: Record<MusicLayer, boolean> = { wave: true, boss: false, low: false };
  const fade = (g: GainNode, to: number): void => {
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(to, t + MUSIC_FADE_S);
  };
  void renderLayers()
    .then((buffers) => {
      if (disposed || !buffers) return;
      const start = ctx.currentTime + 0.05;
      for (const [layer, buffer] of buffers) {
        const g = ctx.createGain();
        g.gain.value = 0;
        g.connect(musicBus);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(g);
        src.start(start);
        sources.push(src);
        layerGains.set(layer, g);
        fade(g, wanted[layer] ? 1 : 0);
      }
    })
    .catch(() => undefined);

  return {
    play(sfx, pan = 0.5, pitch = 1) {
      if (disposed || voices >= SFX_VOICES_MAX) return;
      const now = ctx.currentTime;
      if (now - (lastAt.get(sfx) ?? -Infinity) < SFX_MIN_GAP_S) return;
      lastAt.set(sfx, now);
      RECIPES[sfx](Math.min(1, Math.max(0, pan)), pitch);
    },
    layers(on) {
      if (on.wave === wanted.wave && on.boss === wanted.boss && on.low === wanted.low) return;
      wanted = { ...on };
      for (const [layer, g] of layerGains) fade(g, wanted[layer] ? 1 : 0);
    },
    pause(paused) {
      const t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(musicLevel * (paused ? MUSIC_PAUSE_K : 1), t + MUSIC_FADE_S / 2);
    },
    dispose() {
      disposed = true;
      const t = ctx.currentTime;
      musicBus.gain.cancelScheduledValues(t);
      musicBus.gain.setValueAtTime(musicBus.gain.value, t);
      musicBus.gain.linearRampToValueAtTime(0, t + MUSIC_FADE_S / 2);
      setTimeout(() => {
        for (const s of sources) s.stop();
        musicBus.disconnect();
        sfxBus.disconnect();
      }, (MUSIC_FADE_S / 2) * MS_PER_S + VOICE_TAIL_MS);
    },
  };
}

/** Три слоя по MUSIC_BARS тактов: волна (бас, пэд, хэт), босс (бочка, малый, стабы), мало жизней (сердце, тревожный тон). */
async function renderLayers(): Promise<Map<MusicLayer, AudioBuffer> | null> {
  const Offline = window.OfflineAudioContext;
  if (!Offline) return null;
  const beat = SECONDS_PER_MINUTE / MUSIC_BPM;
  const bar = beat * BEATS_PER_BAR;
  const length = bar * MUSIC_BARS;
  const rng = createRng(AUDIO_NOISE_SEED);

  const layer = async (draw: (c: OfflineAudioContext, noise: AudioBuffer) => void): Promise<AudioBuffer> => {
    const c = new Offline(1, Math.ceil(MUSIC_RATE * length), MUSIC_RATE);
    const noise = c.createBuffer(1, MUSIC_RATE, MUSIC_RATE);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = rng.range(-1, 1);
    draw(c, noise);
    return c.startRendering();
  };

  const note = (
    c: OfflineAudioContext,
    type: OscillatorType,
    f0: number,
    t: number,
    dur: number,
    peak: number,
    opts: { f1?: number; attack?: number; cutoff?: number } = {},
  ): void => {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (opts.f1) osc.frequency.exponentialRampToValueAtTime(opts.f1, t + dur);
    const g = c.createGain();
    const attack = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(SILENCE, t + dur);
    let node: AudioNode = osc;
    if (opts.cutoff) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.cutoff;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };
  const hit = (c: OfflineAudioContext, noise: AudioBuffer, t: number, dur: number, peak: number, type: BiquadFilterType, freq: number): void => {
    const src = c.createBufferSource();
    src.buffer = noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(SILENCE, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  };
  const chordAt = (b: number): number => Math.floor(b / 2) % ROOTS.length;

  const wave = await layer((c, noise) => {
    for (let b = 0; b < MUSIC_BARS; b++) {
      const i = chordAt(b);
      const t0 = b * bar;
      // Бас восьмыми, пэд на такт, хэт на каждую восьмую, арпеджио шестнадцатыми на втором такте аккорда.
      for (let e = 0; e < 8; e++) note(c, 'sawtooth', (ROOTS[i] as number) * (e % 2 ? 2 : 1), t0 + (e * beat) / 2, beat / 2, 0.22, { cutoff: 700 });
      for (const f of TRIADS[i] as number[]) note(c, 'triangle', f, t0, bar, 0.05, { attack: 0.4 });
      for (let e = 0; e < 8; e++) hit(c, noise, t0 + (e * beat) / 2, 0.05, e % 2 ? 0.08 : 0.04, 'highpass', 7000);
      if (b % 2 === 1) {
        for (let s = 0; s < 16; s++) {
          const tri = TRIADS[i] as number[];
          note(c, 'square', (tri[s % tri.length] as number) * 2, t0 + (s * beat) / 4, beat / 4, 0.035, { cutoff: 2500 });
        }
      }
    }
  });
  const boss = await layer((c, noise) => {
    for (let b = 0; b < MUSIC_BARS; b++) {
      const i = chordAt(b);
      const t0 = b * bar;
      for (let q = 0; q < BEATS_PER_BAR; q++) {
        const t = t0 + q * beat;
        note(c, 'sine', 150, t, 0.25, 0.7, { f1: 40 }); // бочка
        if (q % 2 === 1) hit(c, noise, t, 0.18, 0.35, 'bandpass', 1800); // малый
        note(c, 'sawtooth', (ROOTS[i] as number) * 4, t + beat / 2, beat / 3, 0.09, { cutoff: 1800 }); // стаб
      }
    }
  });
  const low = await layer((c) => {
    for (let b = 0; b < MUSIC_BARS; b++) {
      const t0 = b * bar;
      // Сердце: «тук-тук» на каждую половину такта; поверх — тонкий тревожный тон.
      for (let h = 0; h < 2; h++) {
        const t = t0 + h * (bar / 2);
        note(c, 'sine', 70, t, 0.18, 0.5, { f1: 45 });
        note(c, 'sine', 65, t + 0.22, 0.18, 0.35, { f1: 40 });
      }
      note(c, 'sine', 1244.5, t0, bar, 0.025, { attack: 1 });
    }
  });
  return new Map<MusicLayer, AudioBuffer>([
    ['wave', wave],
    ['boss', boss],
    ['low', low],
  ]);
}
