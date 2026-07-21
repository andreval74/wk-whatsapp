import express from 'express';
import { createApiRouter } from './api.js';

export function createApp(sessionManager = null) {
  const app = express();

  // CORS middleware - restrict to known local origins only
  const allowlist = ['http://localhost', 'http://127.0.0.1'];
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowlist.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
    } else {
      next();
    }
  });

  app.get('/health', (req, res) => res.json({ ok: true }));
  app.locals.sessionManager = sessionManager;
  if (sessionManager) {
    app.use(createApiRouter(sessionManager));
  }
  return app;
}
