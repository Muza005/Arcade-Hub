// Комната на уровне хаба. На этапе А2 — только данные для отрисовки; сервер и телефоны — этап А4.

export interface RoomPlayer {
  id: string;
  nick: string;
  color: string;
  leader: boolean;
  connected: boolean;
  /** Браузер телефона не подходит для игры (§15). */
  warning?: boolean;
}

export interface Room {
  /** Код комнаты; null — ещё не создана. */
  code: string | null;
  players: RoomPlayer[];
}

export const emptyRoom = (): Room => ({ code: null, players: [] });
