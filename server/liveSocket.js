import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';

export function attachLiveSocket(httpServer, sessionManager, opts = {}) {
  const intervalMs = opts.intervalMs ?? 1000;
  const wss = new WebSocketServer({ server: httpServer, path: '/live' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const sessionId = url.searchParams.get('session');
    if (!sessionId) {
      ws.close();
      return;
    }

    let lastStatusPayload = null;
    let lastContactsPayload = null;
    let running = true;

    const poll = async () => {
      while (running && ws.readyState === ws.OPEN) {
        const status = sessionManager.getStatus(sessionId);
        if (!status) {
          running = false;
          ws.close();
          break;
        }
        let payload;
        if (status.qr) {
          const dataUrl = await QRCode.toDataURL(status.qr);
          payload = { type: 'qr', dataUrl };
        } else {
          payload = { type: 'status', status: status.status };
        }
        const serialized = JSON.stringify(payload);
        if (serialized !== lastStatusPayload) {
          lastStatusPayload = serialized;
          ws.send(serialized);
        }

        // Push contacts if available and changed
        const contacts = sessionManager.getContacts?.(sessionId);
        if (contacts !== undefined && contacts !== null) {
          const contactsPayload = { type: 'contacts', contacts };
          const contactsSerialized = JSON.stringify(contactsPayload);
          if (contactsSerialized !== lastContactsPayload) {
            lastContactsPayload = contactsSerialized;
            ws.send(contactsSerialized);
          }
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };

    poll().catch((err) => {
      console.error('liveSocket: erro no loop de polling da sessão', sessionId, err);
      running = false;
      if (ws.readyState === ws.OPEN) ws.close();
    });

    ws.on('close', () => {
      running = false;
    });
  });

  return wss;
}
