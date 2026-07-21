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

test('GET /health inclui CORS headers', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
    assert.strictEqual(res.headers.get('access-control-allow-methods'), 'GET, POST, DELETE, OPTIONS');
    assert.strictEqual(res.headers.get('access-control-allow-headers'), 'Content-Type');
  } finally {
    server.close();
  }
});

test('OPTIONS /health retorna 204 com CORS headers', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { method: 'OPTIONS' });
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
    assert.strictEqual(res.headers.get('access-control-allow-methods'), 'GET, POST, DELETE, OPTIONS');
    assert.strictEqual(res.headers.get('access-control-allow-headers'), 'Content-Type');
  } finally {
    server.close();
  }
});
