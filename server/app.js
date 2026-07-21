import express from 'express';
import { createApiRouter } from './api.js';

export function createApp(sessionManager = null) {
  const app = express();

  // CORS middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
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
