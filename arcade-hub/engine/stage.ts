// Сцена игры на PixiJS: мир фиксированного размера, вписанный в экран с полями.
// Игра рисует в координатах мира и не думает о размере окна.
import { Application, Container } from 'pixi.js';

export interface Stage {
  readonly app: Application;
  /** Корень мира: координаты от (0, 0) до (width, height). */
  readonly world: Container;
  readonly width: number;
  readonly height: number;
  render(): void;
  destroy(): void;
}

/** Значение CSS-переменной дизайн-токена, например cssVar('--bg'). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Образец текста: без него браузер грузит только латиницу, и кириллица на canvas уходит в запасной шрифт. */
const FONT_SAMPLE = 'AaZz09 АаЯяЁё';

/** Дождаться шрифтов, которыми игра пишет на canvas (CSS-шрифты подгружаются лениво, по наборам символов). */
export async function loadFonts(fonts: readonly string[], sample: string = FONT_SAMPLE): Promise<void> {
  await Promise.all(fonts.map((font) => document.fonts.load(font, sample)));
}

export interface StageOptions {
  /** Цвет всего экрана, включая поля вокруг мира: поле игры тогда уходит в край без видимой рамки. */
  background?: string;
}

export async function createStage(mount: HTMLElement, width: number, height: number, options: StageOptions = {}): Promise<Stage> {
  const app = new Application();
  await app.init({
    resizeTo: mount,
    ...(options.background ? { background: options.background } : { backgroundAlpha: 0 }),
    antialias: true,
    autoStart: false,
    autoDensity: true,
    resolution: window.devicePixelRatio,
  });
  app.ticker.stop();
  mount.append(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  const fit = (): void => {
    const { width: sw, height: sh } = app.screen;
    const scale = Math.min(sw / width, sh / height);
    world.scale.set(scale);
    world.position.set((sw - width * scale) / 2, (sh - height * scale) / 2);
  };
  fit();
  app.renderer.on('resize', fit);

  return {
    app,
    world,
    width,
    height,
    render: () => app.render(),
    destroy: () => {
      app.renderer.off('resize', fit);
      app.destroy(true, { children: true });
    },
  };
}
