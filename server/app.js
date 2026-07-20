import express from 'express';

export function createApp(sessionManager = null) {
  const app = express();
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.locals.sessionManager = sessionManager;
  return app;
}
