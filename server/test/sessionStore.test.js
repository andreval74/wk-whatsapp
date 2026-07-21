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
