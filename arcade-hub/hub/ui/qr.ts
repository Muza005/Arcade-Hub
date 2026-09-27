// QR для входа с телефона: ведёт на страницу контроллера с кодом комнаты.
import QRCode from 'qrcode-svg';
import { CONTROLLER_PATH } from '../../shared/config';

export const joinUrl = (code: string): string => `${location.origin}${CONTROLLER_PATH}?room=${code}`;

/** SVG-разметка QR, растягивается по размеру контейнера. */
export function qrSvg(code: string, sizePx: number): string {
  return new QRCode({
    content: joinUrl(code),
    padding: 0,
    width: sizePx,
    height: sizePx,
    ecl: 'M',
    join: true,
    container: 'svg-viewbox',
  }).svg();
}
