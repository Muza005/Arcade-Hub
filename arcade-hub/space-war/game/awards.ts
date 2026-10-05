// Именные награды из статистики матча (SPACE_WAR_SPEC §11): «Живой щит», «Ни царапины», «Самый безрассудный»,
// «Меткий», «Камикадзе» — и запасные, чтобы что-нибудь досталось каждому. У каждого игрока — ровно одна.
import type { PilotStats } from './pilot';

export type AwardKey =
  | 'livingShield'
  | 'untouched'
  | 'daredevil'
  | 'sharpshooter'
  | 'kamikaze'
  | 'multHunter'
  | 'collector'
  | 'saboteur'
  | 'survivor'
  | 'onDuty';

/** Что показать под наградой: число с подписью по виду («37 сближений») или время/множитель. */
export type AwardValue =
  | { kind: 'hits' | 'near' | 'rocks' | 'rams' | 'saves' | 'pickups' | 'throws' | 'points'; n: number }
  | { kind: 'mult'; n: number }
  | { kind: 'time'; s: number };

export interface AwardInput {
  id: string;
  stats: PilotStats;
  survivedS: number;
  score: number;
}

export interface AwardPick {
  id: string;
  key: AwardKey;
  value: AwardValue;
}

/** Сравнение по двум признакам: первый всегда важнее второго. */
const HITS_OUTWEIGH = 1e6; // удар весит больше любого времени матча, с
const RAMS_OUTWEIGH = 1e3; // таран весит больше любого числа ударов

interface Rule {
  key: AwardKey;
  /** Может ли игрок её получить. */
  ok(p: AwardInput): boolean;
  /** Больше — лучше. */
  rank(p: AwardInput): number;
  value(p: AwardInput): AwardValue;
}

/** Порядок — приоритет: сначала пять именных, потом запасные. */
const RULES: readonly Rule[] = [
  { key: 'livingShield', ok: (p) => p.stats.revives > 0, rank: (p) => p.stats.revives, value: (p) => ({ kind: 'saves', n: p.stats.revives }) },
  // Меньше ударов — лучше; при равенстве — кто дольше продержался.
  { key: 'untouched', ok: () => true, rank: (p) => -p.stats.hits * HITS_OUTWEIGH + p.survivedS, value: (p) => ({ kind: 'hits', n: p.stats.hits }) },
  { key: 'daredevil', ok: (p) => p.stats.near > 0, rank: (p) => p.stats.near, value: (p) => ({ kind: 'near', n: p.stats.near }) },
  { key: 'sharpshooter', ok: (p) => p.stats.kills > 0, rank: (p) => p.stats.kills, value: (p) => ({ kind: 'rocks', n: p.stats.kills }) },
  {
    key: 'kamikaze',
    ok: (p) => p.stats.rams > 0 || p.stats.hits > 0,
    rank: (p) => p.stats.rams * RAMS_OUTWEIGH + p.stats.hits,
    value: (p) => (p.stats.rams > 0 ? { kind: 'rams', n: p.stats.rams } : { kind: 'hits', n: p.stats.hits }),
  },
  { key: 'multHunter', ok: (p) => p.stats.maxMult >= 2, rank: (p) => p.stats.maxMult, value: (p) => ({ kind: 'mult', n: p.stats.maxMult }) },
  { key: 'collector', ok: (p) => p.stats.pickups > 0, rank: (p) => p.stats.pickups, value: (p) => ({ kind: 'pickups', n: p.stats.pickups }) },
  { key: 'saboteur', ok: (p) => p.stats.sabShots > 0, rank: (p) => p.stats.sabShots, value: (p) => ({ kind: 'throws', n: p.stats.sabShots }) },
  { key: 'survivor', ok: () => true, rank: (p) => p.survivedS, value: (p) => ({ kind: 'time', s: p.survivedS }) },
];

/** Каждой награде — лучший из ещё не награждённых; кому не хватило — «В строю» с очками. Порядок входа — при равенстве. */
export function pickAwards(players: readonly AwardInput[]): AwardPick[] {
  const out: AwardPick[] = [];
  const done = new Set<string>();
  for (const rule of RULES) {
    if (done.size === players.length) break;
    let best: AwardInput | null = null;
    for (const p of players) {
      if (done.has(p.id) || !rule.ok(p)) continue;
      if (!best || rule.rank(p) > rule.rank(best)) best = p;
    }
    if (!best) continue;
    done.add(best.id);
    out.push({ id: best.id, key: rule.key, value: rule.value(best) });
  }
  for (const p of players) {
    if (!done.has(p.id)) out.push({ id: p.id, key: 'onDuty', value: { kind: 'points', n: p.score } });
  }
  return out;
}
