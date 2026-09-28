// Прямой канал телефона к экрану (WebRTC DataChannel): телефон предлагает, экран отвечает, сигналинг — через сервер.
// Канал без повторов и без порядка: старый кадр ввода не нужен, новый важнее. Не открылся — ввод идёт через сервер.
import { RTC_ICE_SERVERS } from '../shared/config';
import type { PhoneToScreen, RtcMsg, ScreenToPhone } from '../shared/protocol';

export interface DirectLink {
  /** Канал открыт и путь жив. */
  readonly live: boolean;
  /** Начать заново (новое соединение с сервером — новый id у экрана). */
  start(): void;
  signal(msg: RtcMsg): void;
  /** Отправить напрямую; false — канала нет. */
  send(msg: PhoneToScreen): boolean;
  close(): void;
}

export interface DirectOptions {
  signal(msg: RtcMsg): void;
  receive(msg: ScreenToPhone): void;
}

export function createDirectLink(options: DirectOptions): DirectLink {
  let pc: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let queue: Promise<void> = Promise.resolve();

  const close = (): void => {
    channel?.close();
    pc?.close();
    channel = null;
    pc = null;
  };

  const live = (): boolean =>
    pc !== null &&
    channel?.readyState === 'open' &&
    pc.iceConnectionState !== 'disconnected' &&
    pc.iceConnectionState !== 'failed';

  return {
    get live() {
      return live();
    },
    start() {
      close();
      if (typeof RTCPeerConnection === 'undefined') return;
      const peer = new RTCPeerConnection({ iceServers: [...RTC_ICE_SERVERS] });
      pc = peer;
      queue = Promise.resolve();
      channel = peer.createDataChannel('fast', { ordered: false, maxRetransmits: 0 });
      channel.addEventListener('message', (m) => {
        try {
          const msg = JSON.parse(String(m.data)) as ScreenToPhone;
          if (msg.t === 'fx') options.receive(msg);
        } catch {
          // битое сообщение пропускаем
        }
      });
      peer.addEventListener('icecandidate', (e) => {
        const c = e.candidate;
        if (pc === peer && c?.candidate) {
          options.signal({
            t: 'rtc',
            ice: { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex, usernameFragment: c.usernameFragment },
          });
        }
      });
      queue = queue
        .then(async () => {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          if (pc === peer) options.signal({ t: 'rtc', sdp: { type: 'offer', sdp: offer.sdp ?? '' } });
        })
        .catch(() => undefined);
    },
    signal(msg) {
      const peer = pc;
      if (!peer) return;
      queue = queue
        .then(async () => {
          if (msg.sdp?.type === 'answer') await peer.setRemoteDescription(msg.sdp);
          if (msg.ice) await peer.addIceCandidate(msg.ice);
        })
        .catch(() => undefined);
    },
    send(msg) {
      if (!live() || !channel) return false;
      try {
        channel.send(JSON.stringify(msg));
        return true;
      } catch {
        return false;
      }
    },
    close,
  };
}
