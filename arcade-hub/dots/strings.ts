// Словарь «Точек». Хаб берёт отсюда название, слоган, «Как играть» и режимы (через манифест).
import type { GameStrings } from '../shared/i18n';

export type DotsKey =
  | 'title'
  | 'tagline'
  | 'howTo1'
  | 'howTo2'
  | 'howTo3'
  | 'modeFfa'
  | 'modeFfaDesc'
  | 'timer'
  | 'status'
  | 'noticeStart'
  | 'noticeLeft'
  | 'plus'
  | 'setDuration'
  | 'dur30'
  | 'dur60'
  | 'dur90'
  | 'setDash'
  | 'setThrow'
  | 'setShape'
  | 'shapeCircle'
  | 'shapeSquare'
  | 'groupShapes'
  | 'awardStars'
  | 'colStars'
  | 'metaBest'
  | 'metaDaily'
  | 'metaLast';

export const strings: GameStrings<DotsKey> = {
  ru: {
    title: 'Точки',
    tagline: 'Собери больше звёзд за минуту',
    howTo1: 'Двигайся джойстиком',
    howTo2: 'Пролетай через звёзды',
    howTo3: 'Кнопка — рывок',
    modeFfa: 'Каждый за себя',
    modeFfaDesc: 'Больше звёзд — победа',
    timer: '{s}',
    status: 'Осталось {time}',
    noticeStart: 'Собирай звёзды!',
    noticeLeft: 'Осталось {s} с',
    plus: '+1',
    setDuration: 'Длительность',
    dur30: '30 с',
    dur60: '60 с',
    dur90: '90 с',
    setDash: 'Рывок',
    setThrow: 'Бросок звёзд с телефона',
    setShape: 'Форма',
    shapeCircle: 'Круг',
    shapeSquare: 'Квадрат',
    groupShapes: 'Формы',
    awardStars: 'Больше всех звёзд',
    colStars: 'Звёзды',
    metaBest: 'Лучший — {nick}, {score} ★',
    metaDaily: 'Рекорд дня — {nick}, {score} ★',
    metaLast: 'Последний матч: {nick}, {score} ★',
  },
  en: {
    title: 'Dots',
    tagline: 'Grab the most stars in a minute',
    howTo1: 'Move with the joystick',
    howTo2: 'Fly through the stars',
    howTo3: 'Button — dash',
    modeFfa: 'Free for all',
    modeFfaDesc: 'Most stars wins',
    timer: '{s}',
    status: '{time} left',
    noticeStart: 'Grab the stars!',
    noticeLeft: '{s} s left',
    plus: '+1',
    setDuration: 'Duration',
    dur30: '30 s',
    dur60: '60 s',
    dur90: '90 s',
    setDash: 'Dash',
    setThrow: 'Throw stars from phones',
    setShape: 'Shape',
    shapeCircle: 'Circle',
    shapeSquare: 'Square',
    groupShapes: 'Shapes',
    awardStars: 'Most stars',
    colStars: 'Stars',
    metaBest: 'Best — {nick}, {score} ★',
    metaDaily: 'Daily best — {nick}, {score} ★',
    metaLast: 'Last match: {nick}, {score} ★',
  },
};
