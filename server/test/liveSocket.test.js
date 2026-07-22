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

test('fecha o socket quando getStatus lanca erro', async () => {
  const sm = {
    getStatus: (id) => {
      if (id === 's1') {
        throw new Error('Erro de teste no getStatus');
      }
      return null;
    },
  };
  const server = http.createServer();
  attachLiveSocket(server, sm, { intervalMs: 20 });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  const ws = new WebSocket(`ws://127.0.0.1:${port}/live?session=s1`);
  await new Promise((resolve, reject) => {
    ws.on('close', resolve);
    ws.on('error', reject);
    setTimeout(() => reject(new Error('timeout esperando close')), 2000);
  });

  await new Promise((resolve) => server.close(resolve));
});

test('empurra lista de contatos quando muda', async () => {
  let contactCallCount = 0;
  const sm = {
    getStatus: (id) => {
      if (id !== 's1') return null;
      return { status: 'conectado', qr: null };
    },
    getContacts: (id) => {
      if (id !== 's1') return null;
      contactCallCount++;
      if (contactCallCount === 1) {
        return [];
      }
      return [{ id: 'a@s.whatsapp.net', name: 'Eliseu' }];
    },
  };
  const server = http.createServer();
  attachLiveSocket(server, sm, { intervalMs: 20 });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  const received = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/live?session=s1`);
  await new Promise((resolve, reject) => {
    ws.on('message', (data) => {
      received.push(JSON.parse(data.toString()));
      if (received.some((m) => m.type === 'contacts' && m.contacts.length > 0)) {
        resolve();
      }
    });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('timeout esperando contacts')), 3000);
  });

  ws.close();
  await new Promise((resolve) => server.close(resolve));

  const contactsMsg = received.find((m) => m.type === 'contacts' && m.contacts.length > 0);
  assert(contactsMsg, 'deveria ter recebido mensagem de contatos');
  assert.deepStrictEqual(contactsMsg.contacts, [{ id: 'a@s.whatsapp.net', name: 'Eliseu' }]);
});
