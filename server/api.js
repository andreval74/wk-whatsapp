import { Router } from 'express';
import { mergeMessages } from './messageAdapter.js';
import { findExportMessagesForContact } from './exportData.js';

export function createApiRouter(sessionManager) {
  const router = Router();

  router.post('/session/new', (req, res) => {
    const sessionId = sessionManager.createSession();
    res.json({ sessionId });
  });

  router.get('/session/:id/status', (req, res) => {
    const status = sessionManager.getStatus(req.params.id);
    if (!status) return res.status(404).json({ error: 'sessão não encontrada' });
    res.json(status);
  });

  router.get('/session/:id/contacts', (req, res) => {
    const contacts = sessionManager.getContacts(req.params.id);
    if (contacts === null) return res.status(404).json({ error: 'sessão não encontrada' });
    res.json({ contacts });
  });

  router.get('/session/:id/messages/:contactId', (req, res) => {
    const live = sessionManager.getMessages(req.params.id, req.params.contactId);
    if (live === null) return res.status(404).json({ error: 'sessão não encontrada' });
    const exportMessages = findExportMessagesForContact(req.query.name || '');
    res.json({ messages: mergeMessages(exportMessages, live) });
  });

  router.delete('/session/:id', (req, res) => {
    const removed = sessionManager.removeSession(req.params.id);
    res.json({ removed });
  });

  return router;
}
