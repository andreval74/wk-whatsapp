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
