import http from 'node:http';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3010;

const app = createApp();
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`WK WhatsApp server ouvindo na porta ${PORT}`);
});
