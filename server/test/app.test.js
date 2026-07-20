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
