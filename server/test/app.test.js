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

test('GET /health reflete origin permitido no CORS header', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { 'Origin': 'http://localhost' },
    });
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://localhost');
    assert.strictEqual(res.headers.get('access-control-allow-methods'), 'GET, POST, DELETE, OPTIONS');
    assert.strictEqual(res.headers.get('access-control-allow-headers'), 'Content-Type');
  } finally {
    server.close();
  }
});

test('OPTIONS /health retorna 204 com CORS headers refletindo origin', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      method: 'OPTIONS',
      headers: { 'Origin': 'http://127.0.0.1' },
    });
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), 'http://127.0.0.1');
    assert.strictEqual(res.headers.get('access-control-allow-methods'), 'GET, POST, DELETE, OPTIONS');
    assert.strictEqual(res.headers.get('access-control-allow-headers'), 'Content-Type');
  } finally {
    server.close();
  }
});

test('GET /health rejeita origin não permitido', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      headers: { 'Origin': 'http://evil.example.com' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), null);
  } finally {
    server.close();
  }
});
