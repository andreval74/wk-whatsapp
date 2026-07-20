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
