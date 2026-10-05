// Генерирует звуки меню (ARCADE_HUB_SPEC §19) в hub/assets/sounds/*.wav.
// Запуск: node scripts/gen-ui-sounds.mjs. Файлы коммитятся; скрипт нужен, только чтобы их поменять.
import { writeFileSync } from 'node:fs';

const RATE = 22050;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // моно
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

function render(seconds, fn) {
  return Array.from({ length: Math.round(seconds * RATE) }, (_, i) => fn(i / RATE, seconds));
}

// Детерминированный шум (LCG) — чтобы файлы не менялись от запуска к запуску.
let seed = 12345;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 31 - 1;
};

const tone = (t, f) => Math.sin(2 * Math.PI * f * t);

const sounds = {
  // Тихий щелчок при смене фокуса.
  click: render(0.035, (t) => tone(t, 2200) * Math.exp(-t * 140) * 0.35),
  // Выбор: два коротких тона вверх.
  select: render(0.14, (t) => {
    const f = t < 0.06 ? 880 : 1320;
    const local = t < 0.06 ? t : t - 0.06;
    return tone(t, f) * Math.exp(-local * 45) * 0.35;
  }),
  // Звонкий сигнал входа нового игрока: три тона вверх.
  join: render(0.42, (t) => {
    const notes = [660, 880, 1320];
    const i = Math.min(Math.floor(t / 0.09), notes.length - 1);
    const local = t - i * 0.09;
    return (tone(t, notes[i]) + tone(t, notes[i] * 2) * 0.3) * Math.exp(-local * 9) * 0.28;
  }),
  // Мягкий «вжух» при открытии окна игры: шум с плавной огибающей и низкий тон.
  open: render(0.28, (t, d) => {
    const env = Math.sin((Math.PI * t) / d) ** 2;
    return (noise() * 0.18 + tone(t, 180 + 420 * (t / d)) * 0.12) * env;
  }),
};

for (const [name, samples] of Object.entries(sounds)) {
  writeFileSync(new URL(`../hub/assets/sounds/${name}.wav`, import.meta.url), wav(samples));
}
console.log('ok:', Object.keys(sounds).join(', '));
