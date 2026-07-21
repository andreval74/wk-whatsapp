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
