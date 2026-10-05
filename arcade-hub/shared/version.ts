// Версия сборки (короткий коммит) — видна внизу настроек хаба и на /health: сразу ясно, свежий ли сайт открыт.
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
