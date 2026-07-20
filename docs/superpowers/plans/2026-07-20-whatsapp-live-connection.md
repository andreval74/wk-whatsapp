# WhatsApp Live Connection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real, read-only WhatsApp connection (QR-code login via Baileys) to WK WhatsApp, so a contact's live messages can be fetched, merged with previously-imported export data, and run through the existing day-grouping/auto-categorization pipeline.

**Architecture:** A new standalone Node.js backend (`wk-whatsapp/server/`) runs alongside the existing static site served by XAMPP. It manages one or more independent WhatsApp sessions via Baileys (WebSocket protocol, no browser), exposes a small HTTP API + a WebSocket endpoint for QR/status, and the existing frontend (`assets/js/app.js`) gains a new script (`assets/js/live.js`) that talks to this backend and reuses `groupIntoDayBlocks()` / `autoCategorize()` / `loadDataset()` unchanged.

**Tech Stack:** Node.js 20+ (ESM), Express 5, `@whiskeysockets/baileys` 6.7.23, `ws` (WebSocket server), `qrcode` (QR → PNG data URL). No frontend build tooling — `live.js` is a classic `<script>`, same as `app.js`.

## Global Constraints

- Read-only: the system must never send messages, mark as read, or otherwise mutate the user's WhatsApp — only reads contacts and messages.
- The backend is a separate Node.js process (`server/`), independent of the existing XAMPP/PHP static hosting — it does not touch `index.html`'s hosting mechanism.
- WhatsApp library: `@whiskeysockets/baileys`, pinned to the stable `6.7.23` release (not the `7.0.0-rc*` prerelease line).
- Must support multiple simultaneous sessions, isolated by `sessionId` — one crashing/disconnecting session must not affect others.
- Must reuse the existing grouping/categorization logic in `assets/js/app.js` (`groupIntoDayBlocks`, `autoCategorize`, `loadDataset`) unchanged — no duplicate implementation on the frontend.
- Merging live messages with previously-imported export data must deduplicate by `(date, time, normalized sender, normalized text)`.
- No new frontend build/bundler — `live.js` stays a plain classic script sharing the same global scope as `app.js`.

---

### Task 1: Backend scaffold (Express app + health check)

**Files:**
- Create: `server/package.json`
- Create: `server/paths.js`
- Create: `server/app.js`
- Create: `server/index.js`
- Create: `server/.gitignore`
- Test: `server/test/app.test.js`

**Interfaces:**
- Produces: `createApp(sessionManager = null)` → Express app instance, with `GET /health` always present. Later tasks mount more routes on it when `sessionManager` is truthy.
- Produces: `AUTH_ROOT`, `DATA_DIR` path constants from `paths.js`, used by later tasks.

- [ ] **Step 1: Create the backend folder and package.json**

```bash
mkdir -p server/test server/auth
```

Create `server/package.json`:

```json
{
  "name": "wk-whatsapp-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "test": "node --test"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "6.7.23",
    "express": "^5.2.1",
    "qrcode": "^1.5.4",
    "ws": "^8.21.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd server && npm install
```

Expected: `node_modules/` created, no error output, `package-lock.json` generated.

- [ ] **Step 3: Create `server/.gitignore`**

```
node_modules/
auth/
```

- [ ] **Step 4: Create `server/paths.js`**

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AUTH_ROOT = path.join(__dirname, 'auth');
export const DATA_DIR = path.join(__dirname, '..', 'data');
```

- [ ] **Step 5: Write the failing test for the health check**

Create `server/test/app.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';

test('GET /health responde ok:true', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(body, { ok: true });
  } finally {
    server.close();
  }
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd server && node --test`
Expected: FAIL — `Cannot find module '../app.js'`

- [ ] **Step 7: Create `server/app.js`**

```js
import express from 'express';

export function createApp(sessionManager = null) {
  const app = express();
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.locals.sessionManager = sessionManager;
  return app;
}
```

- [ ] **Step 8: Create `server/index.js`**

```js
import http from 'node:http';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3010;

const app = createApp();
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`WK WhatsApp server ouvindo na porta ${PORT}`);
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd server && node --test`
Expected: PASS — 1 test passed

- [ ] **Step 10: Commit**

```bash
git add server/package.json server/paths.js server/app.js server/index.js server/.gitignore server/test/app.test.js
git commit -m "feat(server): scaffold backend with health check endpoint"
```

---

### Task 2: `messageAdapter.js` — Baileys message → app.js format + merge/dedup

**Files:**
- Create: `server/textUtils.js`
- Create: `server/messageAdapter.js`
- Test: `server/test/messageAdapter.test.js`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure module).
- Produces: `norm(s)`, `stripAccents(s)` from `textUtils.js`. `extractText(waMessage)`, `tsToDateTime(tsSeconds)`, `mapBaileysMessage(waMessage, {contactName, meName})`, `dedupKey(msg)`, `mergeMessages(exportMessages, liveMessages)` from `messageAdapter.js` — all consumed by Task 4 (`whatsappService.js`) and Task 5 (`api.js`).
- Message shape produced by `mapBaileysMessage`: `{ date: 'DD/MM/YYYY', time: 'HH:MM', sender: string, text: string }` — matches the shape `groupIntoDayBlocks()` in `assets/js/app.js` already expects.

- [ ] **Step 1: Create `server/textUtils.js`**

```js
export function stripAccents(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function norm(s) {
  return stripAccents((s || '').toLowerCase());
}
```

- [ ] **Step 2: Write the failing tests**

Create `server/test/messageAdapter.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractText,
  tsToDateTime,
  mapBaileysMessage,
  dedupKey,
  mergeMessages,
} from '../messageAdapter.js';

test('extractText le texto simples (conversation)', () => {
  assert.strictEqual(extractText({ message: { conversation: 'oi' } }), 'oi');
});

test('extractText le extendedTextMessage', () => {
  assert.strictEqual(
    extractText({ message: { extendedTextMessage: { text: 'com link' } } }),
    'com link'
  );
});

test('extractText le legenda de imagem', () => {
  assert.strictEqual(
    extractText({ message: { imageMessage: { caption: 'foto da obra' } } }),
    'foto da obra'
  );
});

test('extractText usa marcador para midia sem legenda', () => {
  assert.strictEqual(
    extractText({ message: { imageMessage: {} } }),
    '[mídia sem legenda]'
  );
});

test('extractText retorna null para mensagem sem conteudo reconhecido', () => {
  assert.strictEqual(extractText({ message: { reactionMessage: {} } }), null);
  assert.strictEqual(extractText({}), null);
});

test('tsToDateTime formata data e hora locais a partir do timestamp em segundos', () => {
  const now = new Date();
  now.setMilliseconds(0);
  const ts = Math.floor(now.getTime() / 1000);
  const { date, time } = tsToDateTime(ts);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  assert.strictEqual(date, `${dd}/${mm}/${yyyy}`);
  assert.strictEqual(time, `${hh}:${min}`);
});

test('mapBaileysMessage usa o nome do contato quando a mensagem nao e minha', () => {
  const waMessage = {
    key: { fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' },
    messageTimestamp: 1700000000,
    message: { conversation: 'bom dia' },
  };
  const mapped = mapBaileysMessage(waMessage, { contactName: 'Eliseu' });
  assert.strictEqual(mapped.sender, 'Eliseu');
  assert.strictEqual(mapped.text, 'bom dia');
  assert.match(mapped.date, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.match(mapped.time, /^\d{2}:\d{2}$/);
});

test('mapBaileysMessage usa meName quando fromMe e true', () => {
  const waMessage = {
    key: { fromMe: true, remoteJid: '5511999999999@s.whatsapp.net' },
    messageTimestamp: 1700000000,
    message: { conversation: 'oi, tudo bem?' },
  };
  const mapped = mapBaileysMessage(waMessage, { contactName: 'Eliseu', meName: 'André' });
  assert.strictEqual(mapped.sender, 'André');
});

test('mapBaileysMessage retorna null quando nao ha texto extraivel', () => {
  const waMessage = {
    key: { fromMe: false, remoteJid: 'x@s.whatsapp.net' },
    messageTimestamp: 1700000000,
    message: { reactionMessage: {} },
  };
  assert.strictEqual(mapBaileysMessage(waMessage, { contactName: 'Eliseu' }), null);
});

test('dedupKey ignora acentos e maiusculas', () => {
  const a = { date: '04/09/2017', time: '11:57', sender: 'Eliseu', text: 'Bom dia!' };
  const b = { date: '04/09/2017', time: '11:57', sender: 'ELISEU', text: 'bom dia!' };
  assert.strictEqual(dedupKey(a), dedupKey(b));
});

test('mergeMessages remove duplicatas do export e ordena por data/hora', () => {
  const exportMessages = [
    { date: '04/09/2017', time: '11:57', sender: 'Eliseu', text: 'Bom dia!' },
    { date: '04/09/2017', time: '11:58', sender: 'Eliseu', text: 'Alguma novidade' },
  ];
  const liveMessages = [
    { date: '04/09/2017', time: '11:57', sender: 'Eliseu', text: 'Bom dia!' }, // duplicata
    { date: '20/07/2026', time: '09:00', sender: 'Eliseu', text: 'Mensagem nova ao vivo' },
  ];
  const merged = mergeMessages(exportMessages, liveMessages);
  assert.strictEqual(merged.length, 3);
  assert.strictEqual(merged[merged.length - 1].text, 'Mensagem nova ao vivo');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd server && node --test`
Expected: FAIL — `Cannot find module '../messageAdapter.js'`

- [ ] **Step 4: Create `server/messageAdapter.js`**

```js
import { norm } from './textUtils.js';

export function extractText(waMessage) {
  const m = waMessage?.message;
  if (!m) return null;
  if (typeof m.conversation === 'string') return m.conversation;
  if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
  if (m.imageMessage?.caption) return m.imageMessage.caption;
  if (m.videoMessage?.caption) return m.videoMessage.caption;
  if (m.documentMessage?.caption) return m.documentMessage.caption;
  if (m.imageMessage) return '[mídia sem legenda]';
  if (m.videoMessage) return '[mídia sem legenda]';
  if (m.audioMessage) return '[áudio]';
  if (m.stickerMessage) return '[figurinha]';
  return null;
}

export function tsToDateTime(tsSeconds) {
  const d = new Date(Number(tsSeconds) * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${dd}/${mm}/${yyyy}`, time: `${hh}:${min}` };
}

export function mapBaileysMessage(waMessage, { contactName, meName = 'Você' } = {}) {
  const text = extractText(waMessage);
  if (text === null) return null;
  const { date, time } = tsToDateTime(waMessage.messageTimestamp);
  const sender = waMessage.key?.fromMe
    ? meName
    : (contactName || waMessage.key?.remoteJid || 'desconhecido');
  return { date, time, sender, text };
}

export function dedupKey(msg) {
  return `${msg.date}|${msg.time}|${norm(msg.sender)}|${norm(msg.text)}`;
}

function sortKey(msg) {
  const [dd, mm, yyyy] = msg.date.split('/');
  return `${yyyy}${mm}${dd}${msg.time.replace(':', '')}`;
}

export function mergeMessages(exportMessages, liveMessages) {
  const seen = new Set(exportMessages.map(dedupKey));
  const merged = exportMessages.slice();
  for (const m of liveMessages) {
    const key = dedupKey(m);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(m);
    }
  }
  return merged.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && node --test`
Expected: PASS — 11 tests passed (1 from Task 1 + 10 here)

- [ ] **Step 6: Commit**

```bash
git add server/textUtils.js server/messageAdapter.js server/test/messageAdapter.test.js
git commit -m "feat(server): add message format adapter with export/live merge and dedup"
```

---

### Task 3: `sessionManager.js` — multi-session lifecycle (testable without Baileys)

**Files:**
- Create: `server/sessionManager.js`
- Test: `server/test/sessionManager.test.js`

**Interfaces:**
- Consumes: nothing concrete — takes an injected `connectionFactory(sessionId, handlers) → conn` where `conn = { getContacts(), getMessages(contactId), close() }` and `handlers = { onQR(qr), onOpen(), onClose({loggedOut}) }`. Task 4's `createBaileysConnection` implements this exact contract for production use; this task's tests use a fake factory.
- Produces: `createSessionManager(connectionFactory)` → `{ createSession, restoreSession, getStatus, getContacts, getMessages, removeSession, listSessionIds }`, consumed by Task 5 (`api.js`), Task 6 (`liveSocket.js`), Task 7 (`sessionStore.js`), and `server/index.js`.
- `getStatus(sessionId)` returns `{ status: 'conectando'|'aguardando_qr'|'conectado'|'desconectado', qr: string|null }` or `null` if the session doesn't exist.

- [ ] **Step 1: Write the failing tests**

Create `server/test/sessionManager.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionManager } from '../sessionManager.js';

function makeFakeFactory() {
  const created = [];
  const factory = (sessionId, handlers) => {
    const contacts = [{ id: 'a@s.whatsapp.net', name: 'Eliseu' }];
    const messages = { 'a@s.whatsapp.net': [{ date: '20/07/2026', time: '10:00', sender: 'Eliseu', text: 'oi' }] };
    const conn = {
      handlers,
      closed: false,
      getContacts: () => contacts,
      getMessages: (contactId) => messages[contactId] || [],
      close: () => { conn.closed = true; },
    };
    created.push({ sessionId, conn });
    return conn;
  };
  return { factory, created };
}

test('createSession gera um id e comeca no status conectando', () => {
  const { factory } = makeFakeFactory();
  const sm = createSessionManager(factory);
  const id = sm.createSession();
  assert.strictEqual(typeof id, 'string');
  assert.deepStrictEqual(sm.getStatus(id), { status: 'conectando', qr: null });
});

test('onQR muda o status para aguardando_qr e guarda o qr', () => {
  const { factory, created } = makeFakeFactory();
  const sm = createSessionManager(factory);
  const id = sm.createSession();
  created[0].conn.handlers.onQR('2@abcd');
  assert.deepStrictEqual(sm.getStatus(id), { status: 'aguardando_qr', qr: '2@abcd' });
});

test('onOpen muda o status para conectado e limpa o qr', () => {
  const { factory, created } = makeFakeFactory();
  const sm = createSessionManager(factory);
  const id = sm.createSession();
  created[0].conn.handlers.onQR('2@abcd');
  created[0].conn.handlers.onOpen();
  assert.deepStrictEqual(sm.getStatus(id), { status: 'conectado', qr: null });
});

test('onClose com loggedOut remove a sessao; sem loggedOut so marca desconectado', () => {
  const { factory, created } = makeFakeFactory();
  const sm = createSessionManager(factory);
  const id1 = sm.createSession();
  created[0].conn.handlers.onClose({ loggedOut: false });
  assert.deepStrictEqual(sm.getStatus(id1), { status: 'desconectado', qr: null });

  const id2 = sm.createSession();
  created[1].conn.handlers.onClose({ loggedOut: true });
  assert.strictEqual(sm.getStatus(id2), null);
});

test('getContacts e getMessages delegam para a conexao', () => {
  const { factory } = makeFakeFactory();
  const sm = createSessionManager(factory);
  const id = sm.createSession();
  assert.deepStrictEqual(sm.getContacts(id), [{ id: 'a@s.whatsapp.net', name: 'Eliseu' }]);
  assert.deepStrictEqual(sm.getMessages(id, 'a@s.whatsapp.net'), [
    { date: '20/07/2026', time: '10:00', sender: 'Eliseu', text: 'oi' },
  ]);
  assert.strictEqual(sm.getContacts('inexistente'), null);
  assert.strictEqual(sm.getMessages('inexistente', 'x'), null);
});

test('removeSession fecha a conexao e some da lista', () => {
  const { factory, created } = makeFakeFactory();
  const sm = createSessionManager(factory);
  const id = sm.createSession();
  assert.strictEqual(sm.removeSession(id), true);
  assert.strictEqual(created[0].conn.closed, true);
  assert.strictEqual(sm.getStatus(id), null);
  assert.strictEqual(sm.removeSession('inexistente'), false);
});

test('restoreSession registra uma sessao com um id ja existente (sem gerar novo)', () => {
  const { factory } = makeFakeFactory();
  const sm = createSessionManager(factory);
  sm.restoreSession('sessao-salva-123');
  assert.deepStrictEqual(sm.getStatus('sessao-salva-123'), { status: 'conectando', qr: null });
});

test('listSessionIds retorna todos os ids ativos', () => {
  const { factory } = makeFakeFactory();
  const sm = createSessionManager(factory);
  const id1 = sm.createSession();
  const id2 = sm.createSession();
  assert.deepStrictEqual(new Set(sm.listSessionIds()), new Set([id1, id2]));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test`
Expected: FAIL — `Cannot find module '../sessionManager.js'`

- [ ] **Step 3: Create `server/sessionManager.js`**

```js
import crypto from 'node:crypto';

export function createSessionManager(connectionFactory) {
  const sessions = new Map();

  function attach(sessionId) {
    const entry = { id: sessionId, status: 'conectando', qr: null, conn: null };
    sessions.set(sessionId, entry);
    entry.conn = connectionFactory(sessionId, {
      onQR: (qr) => {
        entry.status = 'aguardando_qr';
        entry.qr = qr;
      },
      onOpen: () => {
        entry.status = 'conectado';
        entry.qr = null;
      },
      onClose: ({ loggedOut }) => {
        entry.status = 'desconectado';
        if (loggedOut) sessions.delete(sessionId);
      },
    });
    return sessionId;
  }

  function createSession() {
    return attach(crypto.randomUUID());
  }

  function restoreSession(sessionId) {
    attach(sessionId);
  }

  function getStatus(sessionId) {
    const entry = sessions.get(sessionId);
    return entry ? { status: entry.status, qr: entry.qr } : null;
  }

  function getContacts(sessionId) {
    const entry = sessions.get(sessionId);
    return entry ? entry.conn.getContacts() : null;
  }

  function getMessages(sessionId, contactId) {
    const entry = sessions.get(sessionId);
    return entry ? entry.conn.getMessages(contactId) : null;
  }

  function removeSession(sessionId) {
    const entry = sessions.get(sessionId);
    if (!entry) return false;
    entry.conn.close();
    sessions.delete(sessionId);
    return true;
  }

  function listSessionIds() {
    return Array.from(sessions.keys());
  }

  return {
    createSession,
    restoreSession,
    getStatus,
    getContacts,
    getMessages,
    removeSession,
    listSessionIds,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test`
Expected: PASS — 19 tests passed (11 from before + 8 here)

- [ ] **Step 5: Commit**

```bash
git add server/sessionManager.js server/test/sessionManager.test.js
git commit -m "feat(server): add multi-session lifecycle manager"
```

---

### Task 4: `whatsappService.js` — real Baileys connection factory

**Files:**
- Create: `server/whatsappService.js`
- Test: `server/test/whatsappService.test.js`

**Interfaces:**
- Consumes: `AUTH_ROOT` from `server/paths.js` (Task 1), `mapBaileysMessage` from `server/messageAdapter.js` (Task 2).
- Produces: `createBaileysConnection(sessionId, handlers, deps = {})` implementing the exact `connectionFactory` contract from Task 3 (`{ getContacts(), getMessages(contactId), close() }`, driven by `handlers.onQR/onOpen/onClose`). `deps` allows injecting `{ makeSocket, authStateFactory, disconnectReason }` for testing; production code (`server/index.js`) calls it with no `deps`, using real Baileys.

- [ ] **Step 1: Write the failing tests (with a fake Baileys socket, no real connection)**

Create `server/test/whatsappService.test.js`:

```js
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
  await flush();

  assert.strictEqual(fs.existsSync(authDir), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test`
Expected: FAIL — `Cannot find module '../whatsappService.js'`

- [ ] **Step 3: Create `server/whatsappService.js`**

```js
import path from 'node:path';
import fsPromises from 'node:fs/promises';
import makeWASocketReal, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { AUTH_ROOT } from './paths.js';
import { mapBaileysMessage } from './messageAdapter.js';

export function createBaileysConnection(sessionId, handlers, deps = {}) {
  const {
    makeSocket = makeWASocketReal,
    authStateFactory = useMultiFileAuthState,
    disconnectReason = DisconnectReason,
  } = deps;

  const contacts = new Map();
  const messagesByContact = new Map();
  let sock = null;

  function registerContact(c) {
    if (!c?.id) return;
    contacts.set(c.id, { id: c.id, name: c.name || c.notify || c.id });
  }

  function registerMessage(waMessage) {
    const jid = waMessage?.key?.remoteJid;
    if (!jid) return;
    const contactName = contacts.get(jid)?.name || jid;
    const mapped = mapBaileysMessage(waMessage, { contactName });
    if (!mapped) return;
    if (!messagesByContact.has(jid)) messagesByContact.set(jid, []);
    messagesByContact.get(jid).push(mapped);
  }

  async function start() {
    const { state, saveCreds } = await authStateFactory(path.join(AUTH_ROOT, sessionId));
    sock = makeSocket({ auth: state });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) handlers.onQR(qr);
      if (connection === 'open') handlers.onOpen();
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === disconnectReason.loggedOut;
        if (loggedOut) {
          fsPromises.rm(path.join(AUTH_ROOT, sessionId), { recursive: true, force: true }).catch(() => {});
        }
        handlers.onClose({ loggedOut });
        if (!loggedOut) start();
      }
    });

    sock.ev.on('messaging-history.set', ({ chats = [], contacts: synced = [], messages = [] }) => {
      synced.forEach(registerContact);
      chats.forEach((c) => { if (!contacts.has(c.id)) registerContact({ id: c.id, name: c.name }); });
      messages.forEach(registerMessage);
    });

    sock.ev.on('contacts.upsert', (list) => list.forEach(registerContact));
    sock.ev.on('messages.upsert', ({ messages = [] }) => messages.forEach(registerMessage));
  }

  start();

  return {
    getContacts: () => Array.from(contacts.values()),
    getMessages: (contactId) => messagesByContact.get(contactId) || [],
    close: () => sock?.end(undefined),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test`
Expected: PASS — 26 tests passed (19 from before + 7 here)

- [ ] **Step 5: Commit**

```bash
git add server/whatsappService.js server/test/whatsappService.test.js
git commit -m "feat(server): wire real Baileys connection behind the sessionManager contract"
```

---

### Task 5: HTTP API (`api.js` + `exportData.js`) mounted on `app.js`

**Files:**
- Create: `server/exportData.js`
- Create: `server/api.js`
- Modify: `server/app.js`
- Test: `server/test/api.test.js`

**Interfaces:**
- Consumes: `DATA_DIR` (`paths.js`, Task 1), `norm` (`textUtils.js`, Task 2), `mergeMessages` (`messageAdapter.js`, Task 2), session manager interface (Task 3).
- Produces: `findExportMessagesForContact(contactName)` from `exportData.js`. `createApiRouter(sessionManager)` from `api.js`, mounted inside `createApp()`.
- Routes: `POST /session/new` → `{sessionId}`; `GET /session/:id/status` → `{status, qr}` or 404; `GET /session/:id/contacts` → `{contacts}` or 404; `GET /session/:id/messages/:contactId?name=...` → `{messages}` or 404; `DELETE /session/:id` → `{removed}`.

- [ ] **Step 1: Create `server/exportData.js`**

```js
import fs from 'node:fs';
import path from 'node:path';
import { norm } from './textUtils.js';
import { DATA_DIR } from './paths.js';

export function findExportMessagesForContact(contactName) {
  if (!contactName) return [];
  const blocksPath = path.join(DATA_DIR, 'blocks.json');
  let blocks;
  try {
    blocks = JSON.parse(fs.readFileSync(blocksPath, 'utf8'));
  } catch {
    return [];
  }
  const target = norm(contactName);
  const allMessages = blocks.flatMap((b) => b.messages || []);
  return allMessages.filter((m) => {
    if (m.sender === 'sistema') return false;
    const s = norm(m.sender);
    return s.includes(target) || target.includes(s);
  });
}
```

- [ ] **Step 2: Write the failing API tests**

Create `server/test/api.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { createSessionManager } from '../sessionManager.js';

function makeFakeFactory() {
  const contacts = [{ id: 'a@s.whatsapp.net', name: 'Eliseu' }];
  const messages = { 'a@s.whatsapp.net': [{ date: '20/07/2026', time: '09:00', sender: 'Eliseu', text: 'Mensagem nova ao vivo' }] };
  return (sessionId, handlers) => ({
    handlers,
    getContacts: () => contacts,
    getMessages: (contactId) => messages[contactId] || [],
    close: () => {},
  });
}

async function withServer(sessionManager, run) {
  const app = createApp(sessionManager);
  const server = app.listen(0);
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('POST /session/new cria uma sessao e devolve sessionId', async () => {
  const sm = createSessionManager(makeFakeFactory());
  await withServer(sm, async (base) => {
    const res = await fetch(`${base}/session/new`, { method: 'POST' });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof body.sessionId, 'string');
  });
});

test('GET /session/:id/status devolve o status atual', async () => {
  const sm = createSessionManager(makeFakeFactory());
  await withServer(sm, async (base) => {
    const id = sm.createSession();
    const res = await fetch(`${base}/session/${id}/status`);
    const body = await res.json();
    assert.deepStrictEqual(body, { status: 'conectando', qr: null });
  });
});

test('GET /session/:id/status para sessao inexistente devolve 404', async () => {
  const sm = createSessionManager(makeFakeFactory());
  await withServer(sm, async (base) => {
    const res = await fetch(`${base}/session/nao-existe/status`);
    assert.strictEqual(res.status, 404);
  });
});

test('GET /session/:id/contacts devolve os contatos da sessao', async () => {
  const sm = createSessionManager(makeFakeFactory());
  await withServer(sm, async (base) => {
    const id = sm.createSession();
    const res = await fetch(`${base}/session/${id}/contacts`);
    const body = await res.json();
    assert.deepStrictEqual(body.contacts, [{ id: 'a@s.whatsapp.net', name: 'Eliseu' }]);
  });
});

test('GET /session/:id/messages/:contactId combina export + ao vivo sem duplicar', async () => {
  const sm = createSessionManager(makeFakeFactory());
  await withServer(sm, async (base) => {
    const id = sm.createSession();
    const res = await fetch(`${base}/session/${id}/messages/${encodeURIComponent('a@s.whatsapp.net')}?name=Eliseu`);
    const body = await res.json();
    assert.ok(Array.isArray(body.messages));
    assert.ok(body.messages.some((m) => m.text === 'Mensagem nova ao vivo'));
    assert.ok(body.messages.some((m) => m.sender === 'Eliseu' && m.text === 'Bom dia!'));
  });
});

test('DELETE /session/:id remove a sessao', async () => {
  const sm = createSessionManager(makeFakeFactory());
  await withServer(sm, async (base) => {
    const id = sm.createSession();
    const res = await fetch(`${base}/session/${id}`, { method: 'DELETE' });
    const body = await res.json();
    assert.deepStrictEqual(body, { removed: true });
    assert.strictEqual(sm.getStatus(id), null);
  });
});
```

Note: the "combina export + ao vivo" test relies on `data/blocks.json` already containing a `04/09/2017 11:57 Eliseu "Bom dia!"` message (confirmed present in the existing dataset).

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd server && node --test`
Expected: FAIL — all 6 new tests fail because `/session/*` routes don't exist yet (404 from Express's default handler, but body won't match `{sessionId}` etc.)

- [ ] **Step 4: Create `server/api.js`**

```js
import { Router } from 'express';
import { mergeMessages } from './messageAdapter.js';
import { findExportMessagesForContact } from './exportData.js';

export function createApiRouter(sessionManager) {
  const router = Router();

  router.post('/session/new', (req, res) => {
    const sessionId = sessionManager.createSession();
    res.json({ sessionId });
  });

  router.get('/session/:id/status', (req, res) => {
    const status = sessionManager.getStatus(req.params.id);
    if (!status) return res.status(404).json({ error: 'sessão não encontrada' });
    res.json(status);
  });

  router.get('/session/:id/contacts', (req, res) => {
    const contacts = sessionManager.getContacts(req.params.id);
    if (contacts === null) return res.status(404).json({ error: 'sessão não encontrada' });
    res.json({ contacts });
  });

  router.get('/session/:id/messages/:contactId', (req, res) => {
    const live = sessionManager.getMessages(req.params.id, req.params.contactId);
    if (live === null) return res.status(404).json({ error: 'sessão não encontrada' });
    const exportMessages = findExportMessagesForContact(req.query.name || '');
    res.json({ messages: mergeMessages(exportMessages, live) });
  });

  router.delete('/session/:id', (req, res) => {
    const removed = sessionManager.removeSession(req.params.id);
    res.json({ removed });
  });

  return router;
}
```

- [ ] **Step 5: Modify `server/app.js` to mount the router**

Replace the full contents of `server/app.js` with:

```js
import express from 'express';
import { createApiRouter } from './api.js';

export function createApp(sessionManager = null) {
  const app = express();
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.locals.sessionManager = sessionManager;
  if (sessionManager) {
    app.use(createApiRouter(sessionManager));
  }
  return app;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd server && node --test`
Expected: PASS — 32 tests passed (26 from before + 6 here)

- [ ] **Step 7: Commit**

```bash
git add server/exportData.js server/api.js server/app.js server/test/api.test.js
git commit -m "feat(server): add HTTP API for sessions, contacts and merged messages"
```

---

### Task 6: WebSocket for QR code + status push

**Files:**
- Create: `server/liveSocket.js`
- Modify: `server/index.js`
- Test: `server/test/liveSocket.test.js`

**Interfaces:**
- Consumes: `getStatus(sessionId)` from the session manager (Task 3).
- Produces: `attachLiveSocket(httpServer, sessionManager, opts = {})` — attaches a `WebSocketServer` at path `/live`, reading `?session=<id>` from the connection URL. Pushes `{type:'qr', dataUrl}` while a QR is pending, or `{type:'status', status}` otherwise, every `opts.intervalMs` (default 1000ms — overridable in tests for speed).

- [ ] **Step 1: Write the failing test**

Create `server/test/liveSocket.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';
import { attachLiveSocket } from '../liveSocket.js';

function makeFakeSessionManager(sequence) {
  let i = 0;
  return {
    getStatus: (id) => {
      if (id !== 's1') return null;
      const value = sequence[Math.min(i, sequence.length - 1)];
      i++;
      return value;
    },
  };
}

test('empurra qr enquanto pendente e depois status conectado', async () => {
  const sequence = [
    { status: 'aguardando_qr', qr: '2@abcd' },
    { status: 'conectado', qr: null },
  ];
  const sm = makeFakeSessionManager(sequence);
  const server = http.createServer();
  attachLiveSocket(server, sm, { intervalMs: 20 });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  const received = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/live?session=s1`);
  await new Promise((resolve, reject) => {
    ws.on('message', (data) => {
      received.push(JSON.parse(data.toString()));
      if (received.length >= 2) resolve();
    });
    ws.on('error', reject);
  });

  ws.close();
  await new Promise((resolve) => server.close(resolve));

  assert.strictEqual(received[0].type, 'qr');
  assert.strictEqual(received[0].dataUrl.startsWith('data:image/png;base64,'), true);
  assert.deepStrictEqual(received[1], { type: 'status', status: 'conectado' });
});

test('fecha o socket quando a sessao nao existe', async () => {
  const sm = makeFakeSessionManager([]);
  const server = http.createServer();
  attachLiveSocket(server, sm, { intervalMs: 20 });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  const ws = new WebSocket(`ws://127.0.0.1:${port}/live?session=inexistente`);
  await new Promise((resolve, reject) => {
    ws.on('close', resolve);
    ws.on('error', reject);
    setTimeout(() => reject(new Error('timeout esperando close')), 2000);
  });

  await new Promise((resolve) => server.close(resolve));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && node --test`
Expected: FAIL — `Cannot find module '../liveSocket.js'`

- [ ] **Step 3: Create `server/liveSocket.js`**

```js
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';

export function attachLiveSocket(httpServer, sessionManager, opts = {}) {
  const intervalMs = opts.intervalMs ?? 1000;
  const wss = new WebSocketServer({ server: httpServer, path: '/live' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const sessionId = url.searchParams.get('session');
    if (!sessionId) {
      ws.close();
      return;
    }

    let lastPayload = null;
    const timer = setInterval(async () => {
      const status = sessionManager.getStatus(sessionId);
      if (!status) {
        clearInterval(timer);
        ws.close();
        return;
      }
      let payload;
      if (status.qr) {
        const dataUrl = await QRCode.toDataURL(status.qr);
        payload = { type: 'qr', dataUrl };
      } else {
        payload = { type: 'status', status: status.status };
      }
      const serialized = JSON.stringify(payload);
      if (serialized !== lastPayload) {
        lastPayload = serialized;
        ws.send(serialized);
      }
    }, intervalMs);

    ws.on('close', () => clearInterval(timer));
  });

  return wss;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && node --test`
Expected: PASS — 34 tests passed (32 from before + 2 here)

- [ ] **Step 5: Modify `server/index.js`**

Replace the full contents of `server/index.js` with:

```js
import http from 'node:http';
import { createApp } from './app.js';
import { createSessionManager } from './sessionManager.js';
import { createBaileysConnection } from './whatsappService.js';
import { attachLiveSocket } from './liveSocket.js';

const PORT = process.env.PORT || 3010;

const sessionManager = createSessionManager(createBaileysConnection);
const app = createApp(sessionManager);
const server = http.createServer(app);
attachLiveSocket(server, sessionManager);

server.listen(PORT, () => {
  console.log(`WK WhatsApp server ouvindo na porta ${PORT}`);
});
```

- [ ] **Step 6: Commit**

```bash
git add server/liveSocket.js server/index.js server/test/liveSocket.test.js
git commit -m "feat(server): push QR code and status updates over WebSocket"
```

---

### Task 7: Auto-restore sessions on server boot

**Files:**
- Create: `server/sessionStore.js`
- Modify: `server/index.js`
- Test: `server/test/sessionStore.test.js`

**Interfaces:**
- Consumes: `AUTH_ROOT` (`paths.js`, Task 1), `restoreSession(sessionId)` from the session manager (Task 3).
- Produces: `listSavedSessionIds()`, `restoreExistingSessions(sessionManager)` — called once at boot in `index.js` so previously-authenticated sessions reconnect without a new QR.

- [ ] **Step 1: Write the failing tests**

Create `server/test/sessionStore.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AUTH_ROOT } from '../paths.js';
import { listSavedSessionIds, restoreExistingSessions } from '../sessionStore.js';

test('listSavedSessionIds le as pastas de auth existentes', () => {
  fs.mkdirSync(path.join(AUTH_ROOT, 'sessao-teste-1'), { recursive: true });
  fs.mkdirSync(path.join(AUTH_ROOT, 'sessao-teste-2'), { recursive: true });
  try {
    const ids = listSavedSessionIds();
    assert.ok(ids.includes('sessao-teste-1'));
    assert.ok(ids.includes('sessao-teste-2'));
  } finally {
    fs.rmSync(path.join(AUTH_ROOT, 'sessao-teste-1'), { recursive: true, force: true });
    fs.rmSync(path.join(AUTH_ROOT, 'sessao-teste-2'), { recursive: true, force: true });
  }
});

test('restoreExistingSessions chama restoreSession para cada pasta salva', () => {
  fs.mkdirSync(path.join(AUTH_ROOT, 'sessao-boot-1'), { recursive: true });
  try {
    const restored = [];
    const fakeSessionManager = { restoreSession: (id) => restored.push(id) };
    restoreExistingSessions(fakeSessionManager);
    assert.ok(restored.includes('sessao-boot-1'));
  } finally {
    fs.rmSync(path.join(AUTH_ROOT, 'sessao-boot-1'), { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && node --test`
Expected: FAIL — `Cannot find module '../sessionStore.js'`

- [ ] **Step 3: Create `server/sessionStore.js`**

```js
import fs from 'node:fs';
import { AUTH_ROOT } from './paths.js';

export function listSavedSessionIds() {
  if (!fs.existsSync(AUTH_ROOT)) return [];
  return fs
    .readdirSync(AUTH_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function restoreExistingSessions(sessionManager) {
  listSavedSessionIds().forEach((id) => sessionManager.restoreSession(id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && node --test`
Expected: PASS — 36 tests passed (34 from before + 2 here)

- [ ] **Step 5: Modify `server/index.js`**

Replace the full contents of `server/index.js` with:

```js
import http from 'node:http';
import { createApp } from './app.js';
import { createSessionManager } from './sessionManager.js';
import { createBaileysConnection } from './whatsappService.js';
import { attachLiveSocket } from './liveSocket.js';
import { restoreExistingSessions } from './sessionStore.js';

const PORT = process.env.PORT || 3010;

const sessionManager = createSessionManager(createBaileysConnection);
const app = createApp(sessionManager);
const server = http.createServer(app);
attachLiveSocket(server, sessionManager);
restoreExistingSessions(sessionManager);

server.listen(PORT, () => {
  console.log(`WK WhatsApp server ouvindo na porta ${PORT}`);
});
```

- [ ] **Step 6: Commit**

```bash
git add server/sessionStore.js server/index.js server/test/sessionStore.test.js
git commit -m "feat(server): auto-restore previously authenticated sessions on boot"
```

---

### Task 8: Frontend — `assets/js/live.js` (QR modal, contact list, load conversation)

**Files:**
- Create: `assets/js/live.js`

**Interfaces:**
- Consumes (globals already defined by `assets/js/app.js`, loaded first — classic scripts share the same top-level `let`/`const`/function scope): `groupIntoDayBlocks(messages)`, `autoCategorize(blocks)`, `loadDataset(blocks, catMeta, title)`, `escapeHtml(s)`, `restoreBtn` (DOM element).
- Consumes (DOM elements added in Task 9): `#liveBtn`, `#liveModal`, `#liveQrImg`, `#liveStatus`, `#liveContactList`, `#liveCloseBtn`.
- No exports — this is a classic script that wires event listeners directly, same pattern as `app.js`.

This task has no automated tests: `app.js` itself has none, and DOM/fetch/WebSocket wiring is verified manually in the browser in Task 9's verification step, consistent with the project's existing testing convention (manual browser verification for UI, automated tests only for pure logic).

- [ ] **Step 1: Create `assets/js/live.js`**

```js
/* WK WhatsApp — conexão real com o WhatsApp (Baileys) via server/ local.
   Reaproveita groupIntoDayBlocks/autoCategorize/loadDataset de app.js. */

const LIVE_API = 'http://localhost:3010';

let liveSessionId = null;
let liveSocket = null;

const liveBtn = document.getElementById('liveBtn');
const liveModal = document.getElementById('liveModal');
const liveQrImg = document.getElementById('liveQrImg');
const liveStatusEl = document.getElementById('liveStatus');
const liveContactList = document.getElementById('liveContactList');
const liveCloseBtn = document.getElementById('liveCloseBtn');

liveBtn.addEventListener('click', startLiveSession);
liveCloseBtn.addEventListener('click', closeLiveModal);

function closeLiveModal() {
  liveModal.style.display = 'none';
  if (liveSocket) {
    liveSocket.close();
    liveSocket = null;
  }
}

async function startLiveSession() {
  liveModal.style.display = 'flex';
  liveQrImg.style.display = 'none';
  liveContactList.innerHTML = '';
  liveStatusEl.textContent = 'Conectando ao servidor local...';
  try {
    const res = await fetch(`${LIVE_API}/session/new`, { method: 'POST' });
    if (!res.ok) throw new Error('resposta ' + res.status);
    const data = await res.json();
    liveSessionId = data.sessionId;
    openLiveSocket(liveSessionId);
  } catch (e) {
    liveStatusEl.textContent = 'Não foi possível conectar ao servidor local. Rode "npm start" dentro da pasta server/ primeiro.';
  }
}

const QR_TIMEOUT_MS = 120000;

function openLiveSocket(sessionId) {
  liveSocket = new WebSocket(`ws://localhost:3010/live?session=${sessionId}`);
  let connected = false;
  const qrTimeout = setTimeout(() => {
    if (!connected) {
      liveStatusEl.textContent = 'Tempo esgotado para escanear o QR code. Feche e clique em "Conectar WhatsApp" para tentar novamente.';
      liveQrImg.style.display = 'none';
      liveSocket.close();
    }
  }, QR_TIMEOUT_MS);
  liveSocket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'qr') {
      liveQrImg.src = msg.dataUrl;
      liveQrImg.style.display = 'block';
      liveStatusEl.textContent = 'Escaneie o QR code no WhatsApp do seu celular (Aparelhos conectados > Conectar um aparelho).';
    } else if (msg.type === 'status') {
      if (msg.status === 'conectado') {
        connected = true;
        clearTimeout(qrTimeout);
        liveQrImg.style.display = 'none';
        liveStatusEl.textContent = 'Conectado! Carregando contatos...';
        loadLiveContacts(sessionId);
      } else if (msg.status === 'desconectado') {
        clearTimeout(qrTimeout);
        liveStatusEl.textContent = 'Sessão desconectada.';
      }
    }
  };
  liveSocket.onerror = () => {
    clearTimeout(qrTimeout);
    liveStatusEl.textContent = 'Erro na conexão em tempo real com o servidor local.';
  };
}

async function loadLiveContacts(sessionId) {
  const res = await fetch(`${LIVE_API}/session/${sessionId}/contacts`);
  const data = await res.json();
  liveStatusEl.textContent = `${data.contacts.length} contatos encontrados. Clique em um para gerar o relatório.`;
  liveContactList.innerHTML = data.contacts
    .map((c) => `<div class="live-contact" data-id="${encodeURIComponent(c.id)}" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`)
    .join('');
  liveContactList.querySelectorAll('.live-contact').forEach((el) => {
    el.addEventListener('click', () => openLiveContact(sessionId, decodeURIComponent(el.dataset.id), el.dataset.name));
  });
}

async function openLiveContact(sessionId, contactId, contactName) {
  liveStatusEl.textContent = `Buscando mensagens de ${contactName}...`;
  const res = await fetch(`${LIVE_API}/session/${sessionId}/messages/${encodeURIComponent(contactId)}?name=${encodeURIComponent(contactName)}`);
  const data = await res.json();
  const blocks = groupIntoDayBlocks(data.messages);
  const catMeta = autoCategorize(blocks);
  loadDataset(blocks, catMeta, `WhatsApp ao vivo — ${contactName}`);
  restoreBtn.style.display = 'block';
  closeLiveModal();
}
```

- [ ] **Step 2: Commit**

```bash
git add assets/js/live.js
git commit -m "feat(frontend): add live WhatsApp connection client (QR, contacts, load conversation)"
```

---

### Task 9: Frontend markup — `index.html` + `assets/css/style.css`

**Files:**
- Modify: `index.html`
- Modify: `assets/css/style.css`

**Interfaces:**
- Consumes: element IDs `liveBtn`, `liveModal`, `liveQrImg`, `liveStatus`, `liveContactList`, `liveCloseBtn` wired by `assets/js/live.js` (Task 8).

- [ ] **Step 1: Modify `index.html`** — add the "Conectar WhatsApp" button inside `#uploadPanel`, the modal markup, and the new script tag.

In `index.html`, inside `<div id="uploadPanel">`, right after the closing `</div>` of `#dropzone` (after line 18, before the `<input id="fileInput" ...>` line), add:

```html
      <button id="liveBtn" type="button">📶 Conectar WhatsApp (ao vivo)</button>
```

So that block reads:

```html
      <div id="dropzone">
        <div class="dzIcon">📎</div>
        <div class="dzText">Anexe um export do WhatsApp<br>(.zip ou .txt) — clique ou arraste aqui</div>
      </div>
      <button id="liveBtn" type="button">📶 Conectar WhatsApp (ao vivo)</button>
      <input id="fileInput" type="file" accept=".zip,.txt,.json">
```

Right before the closing `</div>` of `<div id="app" ...>` (currently the line right after `</div>` that closes `#main`, before the final `</div>` at line 53), add the modal markup:

```html
  <div id="liveModal" class="live-modal">
    <div class="live-modal-content">
      <button id="liveCloseBtn" class="live-close" type="button">✕</button>
      <h2>Conectar WhatsApp</h2>
      <div id="liveStatus" class="live-status"></div>
      <img id="liveQrImg" class="live-qr" alt="QR code do WhatsApp">
      <div id="liveContactList" class="live-contact-list"></div>
    </div>
  </div>
```

Right before the closing `</body>` tag, after the `<script src="assets/js/app.js"></script>` line, add:

```html
<script src="assets/js/live.js"></script>
```

The final `index.html` body section (from `#app` closing div to `</body>`) should read:

```html
    <div id="chips"></div>
    <div id="resultInfo"></div>
    <div id="feed"></div>
  </div>
</div>

<div id="liveModal" class="live-modal">
  <div class="live-modal-content">
    <button id="liveCloseBtn" class="live-close" type="button">✕</button>
    <h2>Conectar WhatsApp</h2>
    <div id="liveStatus" class="live-status"></div>
    <img id="liveQrImg" class="live-qr" alt="QR code do WhatsApp">
    <div id="liveContactList" class="live-contact-list"></div>
  </div>
</div>

<script src="assets/js/fflate.js"></script>
<script src="assets/js/app.js"></script>
<script src="assets/js/live.js"></script>
</body>
</html>
```

- [ ] **Step 2: Modify `assets/css/style.css`** — append the modal/contact-list styles

Append to the end of `assets/css/style.css`:

```css
/* ---------- WhatsApp ao vivo (modal + QR + contatos) ---------- */
.live-modal {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.live-modal-content {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 360px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
}
.live-close {
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
}
.live-status {
  margin: 12px 0;
  font-size: 14px;
  color: #333;
}
.live-qr {
  display: none;
  width: 220px;
  height: 220px;
  margin: 0 auto 12px;
}
.live-contact-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.live-contact {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  background: #f4f4f4;
}
.live-contact:hover {
  background: #e0e0e0;
}
#liveBtn {
  width: 100%;
  margin: 8px 0;
}
```

- [ ] **Step 3: Verify manually in the browser**

1. In one terminal: `cd server && npm start` — confirm it logs `WK WhatsApp server ouvindo na porta 3010` with no errors.
2. Open `http://localhost/wk-whatsapp/` in the browser (XAMPP already serves it).
3. Click "📶 Conectar WhatsApp (ao vivo)" — the modal should open and show "Conectando ao servidor local...", then a QR code image should appear.
4. Scan the QR with a real WhatsApp (phone: Configurações > Aparelhos conectados > Conectar um aparelho).
5. Confirm the modal updates to "Conectado! Carregando contatos..." and then shows a clickable contact list.
6. Click a contact — confirm the modal closes, the main view now shows "WhatsApp ao vivo — <nome>" as the title, and messages render grouped by day with categories, same as an uploaded export.
7. Stop the server (`Ctrl+C`) and run `npm start` again — confirm the same session reconnects without asking for a new QR (auto-restore from `server/auth/`).

- [ ] **Step 4: Commit**

```bash
git add index.html assets/css/style.css
git commit -m "feat(frontend): add live WhatsApp connection UI (button, QR modal, contact list)"
```

---

### Task 10: Manual end-to-end verification checklist

**Files:** none — verification only.

- [ ] Connect a real WhatsApp account via QR and confirm the session survives a server restart without a new scan (Task 7).
- [ ] Open a contact that also has messages in the existing `data/blocks.json` export (e.g. "Eliseu") and confirm no duplicate messages appear in the merged result.
- [ ] Open a contact that has no matching export data and confirm only live messages show up (no crash from `findExportMessagesForContact` returning an empty array).
- [ ] Send yourself (or have someone send) a new WhatsApp message to the connected number while the app is open, then re-open that contact and confirm the new message appears (via `messages.upsert` → live pipeline).
- [ ] Disconnect the session from the phone (WhatsApp > Aparelhos conectados > remove this session) and confirm the backend detects the logout, clears `server/auth/<sessionId>/`, and does not attempt to reconnect indefinitely.
- [ ] Confirm that at no point does the app send a message, mark a chat as read, or otherwise write to WhatsApp — this build is read-only end to end.
