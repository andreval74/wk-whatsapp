/* WK WhatsApp — conexão real com o WhatsApp (Baileys) via server/ local.
   Reaproveita groupIntoDayBlocks/autoCategorize/loadDataset de app.js. */

const LIVE_API = 'http://localhost:3010';

let liveSessionId = null;
let liveSocket = null;

const liveBtn = document.getElementById('liveBtn');
const liveModal = document.getElementById('liveModal');
const liveQrImg = document.getElementById('liveQrImg');
const liveStatusEl = document.getElementById('liveStatus');
const liveContactList = document.getElementById('liveContactList');
const liveCloseBtn = document.getElementById('liveCloseBtn');

liveBtn.addEventListener('click', startLiveSession);
liveCloseBtn.addEventListener('click', closeLiveModal);

function closeLiveModal() {
  liveModal.style.display = 'none';
  if (liveSocket) {
    liveSocket.close();
    liveSocket = null;
  }
}

async function startLiveSession() {
  liveModal.style.display = 'flex';
  liveQrImg.style.display = 'none';
  liveContactList.innerHTML = '';
  liveStatusEl.textContent = 'Conectando ao servidor local...';
  try {
    const res = await fetch(`${LIVE_API}/session/new`, { method: 'POST' });
    if (!res.ok) throw new Error('resposta ' + res.status);
    const data = await res.json();
    liveSessionId = data.sessionId;
    openLiveSocket(liveSessionId);
  } catch (e) {
    liveStatusEl.textContent = 'Não foi possível conectar ao servidor local. Rode "npm start" dentro da pasta server/ primeiro.';
  }
}

const QR_TIMEOUT_MS = 120000;

function openLiveSocket(sessionId) {
  liveSocket = new WebSocket(`ws://localhost:3010/live?session=${sessionId}`);
  let connected = false;
  const qrTimeout = setTimeout(() => {
    if (!connected) {
      liveStatusEl.textContent = 'Tempo esgotado para escanear o QR code. Feche e clique em "Conectar WhatsApp" para tentar novamente.';
      liveQrImg.style.display = 'none';
      liveSocket.close();
    }
  }, QR_TIMEOUT_MS);
  liveSocket.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'qr') {
      liveQrImg.src = msg.dataUrl;
      liveQrImg.style.display = 'block';
      liveStatusEl.textContent = 'Escaneie o QR code no WhatsApp do seu celular (Aparelhos conectados > Conectar um aparelho).';
    } else if (msg.type === 'status') {
      if (msg.status === 'conectado') {
        connected = true;
        clearTimeout(qrTimeout);
        liveQrImg.style.display = 'none';
        liveStatusEl.textContent = 'Conectado! Carregando contatos...';
        loadLiveContacts(sessionId);
      } else if (msg.status === 'desconectado') {
        clearTimeout(qrTimeout);
        liveStatusEl.textContent = 'Sessão desconectada.';
      }
    }
  };
  liveSocket.onerror = () => {
    clearTimeout(qrTimeout);
    liveStatusEl.textContent = 'Erro na conexão em tempo real com o servidor local.';
  };
}

async function loadLiveContacts(sessionId) {
  const res = await fetch(`${LIVE_API}/session/${sessionId}/contacts`);
  const data = await res.json();
  liveStatusEl.textContent = `${data.contacts.length} contatos encontrados. Clique em um para gerar o relatório.`;
  liveContactList.innerHTML = data.contacts
    .map((c) => `<div class="live-contact" data-id="${encodeURIComponent(c.id)}" data-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`)
    .join('');
  liveContactList.querySelectorAll('.live-contact').forEach((el) => {
    el.addEventListener('click', () => openLiveContact(sessionId, decodeURIComponent(el.dataset.id), el.dataset.name));
  });
}

async function openLiveContact(sessionId, contactId, contactName) {
  liveStatusEl.textContent = `Buscando mensagens de ${contactName}...`;
  const res = await fetch(`${LIVE_API}/session/${sessionId}/messages/${encodeURIComponent(contactId)}?name=${encodeURIComponent(contactName)}`);
  const data = await res.json();
  const blocks = groupIntoDayBlocks(data.messages);
  const catMeta = autoCategorize(blocks);
  loadDataset(blocks, catMeta, `WhatsApp ao vivo — ${contactName}`);
  restoreBtn.style.display = 'block';
  closeLiveModal();
}
