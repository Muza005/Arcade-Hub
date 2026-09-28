// Прямые каналы телефон ↔ экран (WebRTC DataChannel). Телефон предлагает, экран отвечает; сигналинг — через сервер.
// В одной Wi‑Fi сети ввод идёт напрямую, минуя сервер: задержка как у клавиатуры.
// Канала нет или он порвался — всё идёт через сервер, как раньше.
import { RTC_ICE_SERVERS } from '../shared/config';
import { PHONE_TO_SCREEN_TYPES, type PhoneToScreen, type RtcMsg, type ScreenToPhone } from '../shared/protocol';

interface Link {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  /** Шаги сигналинга по порядку: кандидаты не должны обогнать ответ. */
  queue: Promise<void>;
}

export interface DirectLinks {
  /** Сообщение `rtc` от телефона (id соединения на сервере). */
  signal(cid: string, msg: RtcMsg): void;
  /** Отправить напрямую; false — канала нет, отправлять через сервер. */
  send(cid: string, msg: ScreenToPhone): boolean;
  close(cid: string): void;
  closeAll(): void;
}

export interface DirectOptions {
  /** Ответ экрана телефону — через сервер. */
  signal(cid: string, msg: RtcMsg): void;
  /** Сообщение телефона, пришедшее напрямую. */
  receive(cid: string, msg: PhoneToScreen): void;
}

const supported = (): boolean => typeof RTCPeerConnection !== 'undefined';

function isLive(pc: RTCPeerConnection, channel: RTCDataChannel | null): channel is RTCDataChannel {
  return (
    channel?.readyState === 'open' && pc.iceConnectionState !== 'disconnected' && pc.iceConnectionState !== 'failed'
  );
}

export function createDirectLinks(options: DirectOptions): DirectLinks {
  const links = new Map<string, Link>();

  const close = (cid: string): void => {
    const link = links.get(cid);
    if (!link) return;
    links.delete(cid);
    link.channel?.close();
    link.pc.close();
  };

  const open = (cid: string): Link => {
    close(cid);
    const pc = new RTCPeerConnection({ iceServers: [...RTC_ICE_SERVERS] });
    const link: Link = { pc, channel: null, queue: Promise.resolve() };
    pc.addEventListener('icecandidate', (e) => {
      const c = e.candidate;
      if (c?.candidate) {
        options.signal(cid, {
          t: 'rtc',
          ice: { candidate: c.candidate, sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex, usernameFragment: c.usernameFragment },
        });
      }
    });
    pc.addEventListener('datachannel', (e) => {
      const channel = e.channel;
      link.channel = channel;
      channel.addEventListener('message', (m) => {
        let msg: PhoneToScreen;
        try {
          msg = JSON.parse(String(m.data)) as PhoneToScreen;
        } catch {
          return;
        }
        if (typeof msg === 'object' && msg !== null && msg.t !== 'rtc' && PHONE_TO_SCREEN_TYPES.has(msg.t)) {
          options.receive(cid, msg);
        }
      });
    });
    links.set(cid, link);
    return link;
  };

  return {
    signal(cid, msg) {
      if (!supported()) return;
      const link = msg.sdp?.type === 'offer' ? open(cid) : links.get(cid);
      if (!link) return;
      link.queue = link.queue
        .then(async () => {
          if (msg.sdp?.type === 'offer') {
            await link.pc.setRemoteDescription(msg.sdp);
            const answer = await link.pc.createAnswer();
            await link.pc.setLocalDescription(answer);
            options.signal(cid, { t: 'rtc', sdp: { type: 'answer', sdp: answer.sdp ?? '' } });
          }
          if (msg.ice) await link.pc.addIceCandidate(msg.ice);
        })
        .catch(() => undefined);
    },
    send(cid, msg) {
      const link = links.get(cid);
      if (!link || !isLive(link.pc, link.channel)) return false;
      try {
        link.channel.send(JSON.stringify(msg));
        return true;
      } catch {
        return false;
      }
    },
    close,
    closeAll() {
      for (const cid of [...links.keys()]) close(cid);
    },
  };
}
