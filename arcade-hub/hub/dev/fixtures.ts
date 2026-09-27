// Только dev-сборка: игры-заглушки и тестовая комната, чтобы проверять меню с 1–6 играми и 0–10 игроками.
// Параметры адреса: ?games=1 — только настоящие игры; ?players=N — число тестовых игроков (по умолчанию 6).
import { MAX_PLAYERS, PLAYER_COLORS } from '../../shared/config';
import type { GameManifest } from '../../shared/game-manifest';
import type { GameStrings } from '../../shared/i18n';
import type { Room } from '../room';

const DEFAULT_TEST_PLAYERS = 6;
const TEST_ROOM_CODE = 'K7QX';
const TEST_NICKS = ['Мурад', 'Аня', 'Тимур', 'Лена', 'Олег', 'Дина', 'Саша', 'Катя', 'Рома', 'Женя'];
const OFFLINE_INDEX = 3;

interface Stub {
  id: string;
  accent: string;
  accentAlt: string;
  players: [number, number];
  minutes: [number, number];
  ru: [string, string];
  en: [string, string];
}

const STUBS: Stub[] = [
  { id: 'stub-drift', accent: '#FF5FD2', accentAlt: '#7A5CFF', players: [2, 8], minutes: [5, 10], ru: ['Неон-дрифт', 'Кто последний на трассе'], en: ['Neon Drift', 'Last one on the track'] },
  { id: 'stub-lava', accent: '#FF8A3D', accentAlt: '#FF3D5A', players: [2, 6], minutes: [3, 5], ru: ['Пол — это лава', 'Прыгай, пока горит'], en: ['Floor Is Lava', 'Jump while it burns'] },
  { id: 'stub-tower', accent: '#FFD84D', accentAlt: '#FF9F43', players: [1, 4], minutes: [10, 15], ru: ['Башня', 'Стройте выше всех'], en: ['Tower', 'Build the highest'] },
  { id: 'stub-snow', accent: '#7AD7FF', accentAlt: '#4D7CFF', players: [4, 10], minutes: [5, 8], ru: ['Снежки', 'Команда на команду'], en: ['Snowballs', 'Team against team'] },
  { id: 'stub-goal', accent: '#B8F04A', accentAlt: '#2EE6A6', players: [2, 4], minutes: [4, 6], ru: ['Космо-гол', 'Футбол в невесомости'], en: ['Cosmo Goal', 'Zero-g football'] },
];

function coverSvg(accent: string, alt: string, w: number, h: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${alt}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="#070912"/><rect width="${w}" height="${h}" fill="url(#g)" opacity="0.55"/><circle cx="${w * 0.72}" cy="${h * 0.38}" r="${h * 0.3}" fill="${accent}" opacity="0.8"/><circle cx="${w * 0.88}" cy="${h * 0.7}" r="${h * 0.14}" fill="${alt}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function stubManifest(stub: Stub): GameManifest {
  const strings: GameStrings = {
    ru: { title: stub.ru[0], tagline: stub.ru[1], s1: 'Шаг один', s2: 'Шаг два', s3: 'Шаг три', mode: 'Обычный', modeDesc: 'Для проверки меню' },
    en: { title: stub.en[0], tagline: stub.en[1], s1: 'Step one', s2: 'Step two', s3: 'Step three', mode: 'Classic', modeDesc: 'Menu check' },
  };
  const cover = coverSvg(stub.accent, stub.accentAlt, 1920, 1080);
  return {
    id: stub.id,
    title: 'title',
    tagline: 'tagline',
    howToPlay: ['s1', 's2', 's3'],
    accent: stub.accent,
    accentAlt: stub.accentAlt,
    cover,
    cardArt: coverSvg(stub.accent, stub.accentAlt, 640, 840),
    logo: cover,
    players: { min: stub.players[0], max: stub.players[1], keyboardMax: 2 },
    sessionMinutes: stub.minutes,
    controls: ['keyboard', 'phone-joystick'],
    modes: [{ id: 'classic', title: 'mode', description: 'modeDesc', icon: cover }],
    status: 'available',
    version: '0',
    load: () => Promise.reject(new Error(`${stub.id}: заглушка для проверки меню`)),
    strings,
  };
}

const params = new URLSearchParams(location.search);

export function devGames(real: readonly GameManifest[]): GameManifest[] {
  return params.get('games') === '1' ? [...real] : [...real, ...STUBS.map(stubManifest)];
}

export function devRoom(): Room {
  const requested = Number(params.get('players') ?? DEFAULT_TEST_PLAYERS);
  const count = Number.isFinite(requested) ? Math.min(Math.max(requested, 0), MAX_PLAYERS) : DEFAULT_TEST_PLAYERS;
  return {
    code: TEST_ROOM_CODE,
    players: TEST_NICKS.slice(0, count).map((nick, i) => ({
      id: `test-${i}`,
      nick,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length] as string,
      leader: i === 0,
      connected: i !== OFFLINE_INDEX,
    })),
  };
}
