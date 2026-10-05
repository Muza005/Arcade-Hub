// @vitest-environment node
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { createRelay, type Relay } from './relay';

let wss: WebSocketServer;
let relay: Relay;
let url: string;
const clients: WebSocket[] = [];

beforeEach(async () => {
  relay = createRelay();
  wss = new WebSocketServer({ port: 0 });
  wss.on('connection', (ws) => relay.accept(ws));
  await new Promise((r) => wss.once('listening', r));
  url = `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await new Promise((r) => wss.close(r));
});

/** Клиент с очередью входящих сообщений. */
async function client() {
  const ws = new WebSocket(url);
  clients.push(ws);
  const inbox: unknown[] = [];
  const waiters: Array<(m: unknown) => void> = [];
  ws.on('message', (d) => {
    const msg = JSON.parse(String(d));
    const w = waiters.shift();
    if (w) w(msg);
    else inbox.push(msg);
  });
  await new Promise((r) => ws.once('open', r));
  return {
    ws,
    send: (m: unknown) => ws.send(JSON.stringify(m)),
    next: () => (inbox.length ? Promise.resolve(inbox.shift()) : new Promise((r) => waiters.push(r))),
  };
}

describe('relay', () => {
  it('экран получает код, телефон входит, сообщения идут в обе стороны', async () => {
    const host = await client();
    host.send({ t: 'host' });
    const { code } = (await host.next()) as { code: string };
    expect(code).toMatch(/^[A-Z2-9]{4}$/);

    const phone = await client();
    phone.send({ t: 'join', room: code.toLowerCase() });
    const joined = (await host.next()) as { t: string; from: string; msg: unknown };
    expect(joined).toMatchObject({ t: 'from', msg: { t: 'join' } });

    host.send({ t: 'to', to: joined.from, msg: { t: 'fx', vib: 10 } });
    expect(await phone.next()).toEqual({ t: 'fx', vib: 10 });

    phone.send({ t: 'in', x: 1, y: 0, btn: false });
    expect(await host.next()).toEqual({ t: 'from', from: joined.from, msg: { t: 'in', x: 1, y: 0, btn: false } });

    phone.ws.close();
    expect(await host.next()).toEqual({ t: 'gone', from: joined.from });
  });

  it('несуществующая комната — отказ', async () => {
    const phone = await client();
    phone.send({ t: 'join', room: 'ZZZZ' });
    expect(await phone.next()).toEqual({ t: 'err', code: 'no-room' });
  });

  it('экран возвращается в свою комнату, телефоны получают rejoin', async () => {
    const host = await client();
    host.send({ t: 'host' });
    const { code } = (await host.next()) as { code: string };
    const phone = await client();
    phone.send({ t: 'join', room: code });
    await host.next();

    host.ws.close();
    await new Promise((r) => setTimeout(r, 50));
    const host2 = await client();
    host2.send({ t: 'host', code });
    expect(await host2.next()).toEqual({ t: 'room', code });
    expect(await phone.next()).toEqual({ t: 'rejoin' });
  });

  it('чужая занятая комната не отдаётся', async () => {
    const host = await client();
    host.send({ t: 'host' });
    const { code } = (await host.next()) as { code: string };
    const other = await client();
    other.send({ t: 'host', code });
    const got = (await other.next()) as { code: string };
    expect(got.code).not.toBe(code);
  });

  it('пустая комната удаляется', async () => {
    const host = await client();
    host.send({ t: 'host' });
    await host.next();
    expect(relay.roomCount()).toBe(1);
    host.ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(relay.roomCount()).toBe(0);
  });
});
