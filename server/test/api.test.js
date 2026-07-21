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
