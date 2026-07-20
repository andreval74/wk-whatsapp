import crypto from 'node:crypto';

export function createSessionManager(connectionFactory) {
  const sessions = new Map();

  function attach(sessionId) {
    const entry = { id: sessionId, status: 'conectando', qr: null, conn: null };
    sessions.set(sessionId, entry);
    entry.conn = connectionFactory(sessionId, {
      onQR: (qr) => {
        entry.status = 'aguardando_qr';
        entry.qr = qr;
      },
      onOpen: () => {
        entry.status = 'conectado';
        entry.qr = null;
      },
      onClose: ({ loggedOut }) => {
        entry.status = 'desconectado';
        if (loggedOut) sessions.delete(sessionId);
      },
    });
    return sessionId;
  }

  function createSession() {
    return attach(crypto.randomUUID());
  }

  function restoreSession(sessionId) {
    attach(sessionId);
  }

  function getStatus(sessionId) {
    const entry = sessions.get(sessionId);
    return entry ? { status: entry.status, qr: entry.qr } : null;
  }

  function getContacts(sessionId) {
    const entry = sessions.get(sessionId);
    return entry ? entry.conn.getContacts() : null;
  }

  function getMessages(sessionId, contactId) {
    const entry = sessions.get(sessionId);
    return entry ? entry.conn.getMessages(contactId) : null;
  }

  function removeSession(sessionId) {
    const entry = sessions.get(sessionId);
    if (!entry) return false;
    entry.conn.close();
    sessions.delete(sessionId);
    return true;
  }

  function listSessionIds() {
    return Array.from(sessions.keys());
  }

  return {
    createSession,
    restoreSession,
    getStatus,
    getContacts,
    getMessages,
    removeSession,
    listSessionIds,
  };
}
