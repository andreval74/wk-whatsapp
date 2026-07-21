import http from 'node:http';
import { createApp } from './app.js';
import { createSessionManager } from './sessionManager.js';
import { createBaileysConnection } from './whatsappService.js';
import { attachLiveSocket } from './liveSocket.js';

const PORT = process.env.PORT || 3010;

const sessionManager = createSessionManager(createBaileysConnection);
const app = createApp(sessionManager);
const server = http.createServer(app);
attachLiveSocket(server, sessionManager);

server.listen(PORT, () => {
  console.log(`WK WhatsApp server ouvindo na porta ${PORT}`);
});
