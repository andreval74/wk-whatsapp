import test from 'node:test';
import assert from 'node:assert/strict';
import { createBaileysConnection } from '../whatsappService.js';

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function makeFakeSock() {
  const listeners = new Map();
  return {
    ev: {
      on: (event, cb) => listeners.set(event, cb),
      emit: (event, payload) => listeners.get(event)?.(payload),
    },
    end: () => {},
  };
}

function makeDeps() {
  const fakeSock = makeFakeSock();
  const deps = {
    makeSocket: () => fakeSock,
    authStateFactory: async () => ({ state: {}, saveCreds: () => {} }),
    disconnectReason: { loggedOut: 'LOGGED_OUT' },
  };
  return { deps, fakeSock };
}

test('encaminha o QR recebido em connection.update para handlers.onQR', async () => {
  const { deps, fakeSock } = makeDeps();
  const events = [];
  createBaileysConnection('s1', {
    onQR: (qr) => events.push(['qr', qr]),
    onOpen: () => events.push(['open']),
    onClose: (info) => events.push(['close', info]),
  }, deps);
  await flush();
  fakeSock.ev.emit('connection.update', { qr: '2@abcd' });
  assert.deepStrictEqual(events, [['qr', '2@abcd']]);
});

test('connection open chama handlers.onOpen', async () => {
  const { deps, fakeSock } = makeDeps();
  const events = [];
  createBaileysConnection('s1', {
    onQR: () => {},
    onOpen: () => events.push('open'),
    onClose: () => {},
  }, deps);
  await flush();
  fakeSock.ev.emit('connection.update', { connection: 'open' });
  assert.deepStrictEqual(events, ['open']);
});

test('connection close com statusCode de loggedOut repassa loggedOut:true', async () => {
  const { deps, fakeSock } = makeDeps();
  const events = [];
  createBaileysConnection('s1', {
    onQR: () => {},
    onOpen: () => {},
    onClose: (info) => events.push(info),
  }, deps);
  await flush();
  fakeSock.ev.emit('connection.update', {
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 'LOGGED_OUT' } } },
  });
  assert.deepStrictEqual(events, [{ loggedOut: true }]);
});

test('getContacts reflete contacts.upsert', async () => {
  const { deps, fakeSock } = makeDeps();
  const conn = createBaileysConnection('s1', { onQR() {}, onOpen() {}, onClose() {} }, deps);
  await flush();
  fakeSock.ev.emit('contacts.upsert', [{ id: 'a@s.whatsapp.net', name: 'Eliseu' }]);
  assert.deepStrictEqual(conn.getContacts(), [{ id: 'a@s.whatsapp.net', name: 'Eliseu' }]);
});

test('getMessages acumula mensagens de messages.upsert no formato do app.js', async () => {
  const { deps, fakeSock } = makeDeps();
  const conn = createBaileysConnection('s1', { onQR() {}, onOpen() {}, onClose() {} }, deps);
  await flush();
  fakeSock.ev.emit('contacts.upsert', [{ id: 'a@s.whatsapp.net', name: 'Eliseu' }]);
  fakeSock.ev.emit('messages.upsert', {
    messages: [{
      key: { fromMe: false, remoteJid: 'a@s.whatsapp.net' },
      messageTimestamp: 1700000000,
      message: { conversation: 'oi' },
    }],
  });
  const msgs = conn.getMessages('a@s.whatsapp.net');
  assert.strictEqual(msgs.length, 1);
  assert.strictEqual(msgs[0].sender, 'Eliseu');
  assert.strictEqual(msgs[0].text, 'oi');
});

test('close() chama sock.end()', async () => {
  const { deps, fakeSock } = makeDeps();
  let ended = false;
  fakeSock.end = () => { ended = true; };
  const conn = createBaileysConnection('s1', { onQR() {}, onOpen() {}, onClose() {} }, deps);
  await flush();
  conn.close();
  assert.strictEqual(ended, true);
});

test('logout apaga a pasta de credenciais salva em AUTH_ROOT/sessionId', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { AUTH_ROOT } = await import('../paths.js');
  const sessionId = 'sessao-logout-teste';
  const authDir = path.join(AUTH_ROOT, sessionId);
  fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(path.join(authDir, 'creds.json'), '{}');

  const { deps, fakeSock } = makeDeps();
  createBaileysConnection(sessionId, { onQR() {}, onOpen() {}, onClose() {} }, deps);
  await flush();
  fakeSock.ev.emit('connection.update', {
    connection: 'close',
    lastDisconnect: { error: { output: { statusCode: 'LOGGED_OUT' } } },
  });

  // Poll for the async deletion to complete
  const maxWaitMs = 500;
  const pollIntervalMs = 10;
  const startTime = Date.now();
  let deleted = false;
  while (Date.now() - startTime < maxWaitMs) {
    if (!fs.existsSync(authDir)) {
      deleted = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  assert.strictEqual(deleted, true);
});
