// Флаги фич Space War (SPACE_WAR_SPEC §0 п. 4): всё, что включается и выключается, — только здесь.
// Флаг говорит, есть ли фича в игре; работать она начинает на своём этапе (SPACE_WAR_STAGES.md).
export const FEATURES = {
  /** Power и патроны (Б3). */
  shooting: true,
  /** Усиления и Перегрузка (Б11). */
  powerups: true,
  /** Саботаж погибших (Б10). */
  sabotage: true,
  /** Столкновения и таран кораблей (Б7). */
  collisions: true,
} as const;

export type Feature = keyof typeof FEATURES;
