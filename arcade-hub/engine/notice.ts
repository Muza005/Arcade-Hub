// Уведомление в игре: короткая строка появляется на NOTICE_S и сама уходит.
// Время идёт от шагов симуляции — на паузе уведомление замирает вместе с игрой.
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js';
import { NOTICE_FADE_S, NOTICE_S } from '../shared/config';

export interface NoticeStyle {
  text: TextStyleOptions;
  /** Подложка: цвет и прозрачность. */
  fill: string;
  fillAlpha: number;
  padX: number;
  padY: number;
}

export interface Notice {
  readonly view: Container;
  show(text: string): void;
  update(dtS: number): void;
  hide(): void;
}

/** Центр уведомления — в (x, y) мира. */
export function createNotice(style: NoticeStyle, x: number, y: number): Notice {
  const view = new Container();
  const plate = new Graphics();
  const label = new Text({ text: '', style: style.text });
  label.anchor.set(0.5);
  view.addChild(plate, label);
  view.position.set(x, y);
  view.visible = false;
  let age = Infinity;
  const total = NOTICE_S + NOTICE_FADE_S * 2;

  return {
    view,
    show(text) {
      label.text = text;
      const w = label.width + style.padX * 2;
      const h = label.height + style.padY * 2;
      plate
        .clear()
        .roundRect(-w / 2, -h / 2, w, h, h / 2)
        .fill({ color: style.fill, alpha: style.fillAlpha });
      age = 0;
      view.alpha = 0;
      view.visible = true;
    },
    update(dtS) {
      if (!view.visible) return;
      age += dtS;
      if (age >= total) {
        view.visible = false;
        return;
      }
      view.alpha = Math.min(1, age / NOTICE_FADE_S, (total - age) / NOTICE_FADE_S);
    },
    hide() {
      age = Infinity;
      view.visible = false;
    },
  };
}
