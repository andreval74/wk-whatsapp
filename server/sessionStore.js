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
