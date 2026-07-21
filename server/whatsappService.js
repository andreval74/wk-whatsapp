import path from 'node:path';
import fs from 'node:fs';
import makeWASocketReal, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { AUTH_ROOT } from './paths.js';
import { mapBaileysMessage } from './messageAdapter.js';

export function createBaileysConnection(sessionId, handlers, deps = {}) {
  const {
    makeSocket = makeWASocketReal,
    authStateFactory = useMultiFileAuthState,
    disconnectReason = DisconnectReason,
  } = deps;

  const contacts = new Map();
  const messagesByContact = new Map();
  let sock = null;

  function registerContact(c) {
    if (!c?.id) return;
    contacts.set(c.id, { id: c.id, name: c.name || c.notify || c.id });
  }

  function registerMessage(waMessage) {
    const jid = waMessage?.key?.remoteJid;
    if (!jid) return;
    const contactName = contacts.get(jid)?.name || jid;
    const mapped = mapBaileysMessage(waMessage, { contactName });
    if (!mapped) return;
    if (!messagesByContact.has(jid)) messagesByContact.set(jid, []);
    messagesByContact.get(jid).push(mapped);
  }

  async function start() {
    const { state, saveCreds } = await authStateFactory(path.join(AUTH_ROOT, sessionId));
    sock = makeSocket({ auth: state });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) handlers.onQR(qr);
      if (connection === 'open') handlers.onOpen();
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === disconnectReason.loggedOut;
        if (loggedOut) {
          try {
            fs.rmSync(path.join(AUTH_ROOT, sessionId), { recursive: true, force: true });
          } catch (e) {
            // ignore errors
          }
        }
        handlers.onClose({ loggedOut });
        if (!loggedOut) start();
      }
    });

    sock.ev.on('messaging-history.set', ({ chats = [], contacts: synced = [], messages = [] }) => {
      synced.forEach(registerContact);
      chats.forEach((c) => { if (!contacts.has(c.id)) registerContact({ id: c.id, name: c.name }); });
      messages.forEach(registerMessage);
    });

    sock.ev.on('contacts.upsert', (list) => list.forEach(registerContact));
    sock.ev.on('messages.upsert', ({ messages = [] }) => messages.forEach(registerMessage));
  }

  start();

  return {
    getContacts: () => Array.from(contacts.values()),
    getMessages: (contactId) => messagesByContact.get(contactId) || [],
    close: () => sock?.end(undefined),
  };
}
