import express from 'express';
import { createApiRouter } from './api.js';

export function createApp(sessionManager = null) {
  const app = express();
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.locals.sessionManager = sessionManager;
  if (sessionManager) {
    app.use(createApiRouter(sessionManager));
  }
  return app;
}
