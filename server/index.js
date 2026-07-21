import http from 'node:http';
import { createApp } from './app.js';
import { createSessionManager } from './sessionManager.js';
import { createBaileysConnection } from './whatsappService.js';
import { attachLiveSocket } from './liveSocket.js';
import { restoreExistingSessions } from './sessionStore.js';

const PORT = process.env.PORT || 3010;

const sessionManager = createSessionManager(createBaileysConnection);
const app = createApp(sessionManager);
const server = http.createServer(app);
attachLiveSocket(server, sessionManager);
restoreExistingSessions(sessionManager);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`WK WhatsApp server ouvindo na porta ${PORT}`);
});
