import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractText,
  tsToDateTime,
  mapBaileysMessage,
  dedupKey,
  mergeMessages,
} from '../messageAdapter.js';

test('extractText le texto simples (conversation)', () => {
  assert.strictEqual(extractText({ message: { conversation: 'oi' } }), 'oi');
});

test('extractText le extendedTextMessage', () => {
  assert.strictEqual(
    extractText({ message: { extendedTextMessage: { text: 'com link' } } }),
    'com link'
  );
});

test('extractText le legenda de imagem', () => {
  assert.strictEqual(
    extractText({ message: { imageMessage: { caption: 'foto da obra' } } }),
    'foto da obra'
  );
});

test('extractText usa marcador para midia sem legenda', () => {
  assert.strictEqual(
    extractText({ message: { imageMessage: {} } }),
    '[mídia sem legenda]'
  );
});

test('extractText retorna null para mensagem sem conteudo reconhecido', () => {
  assert.strictEqual(extractText({ message: { reactionMessage: {} } }), null);
  assert.strictEqual(extractText({}), null);
});

test('tsToDateTime formata data e hora locais a partir do timestamp em segundos', () => {
  const now = new Date();
  now.setMilliseconds(0);
  const ts = Math.floor(now.getTime() / 1000);
  const { date, time } = tsToDateTime(ts);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  assert.strictEqual(date, `${dd}/${mm}/${yyyy}`);
  assert.strictEqual(time, `${hh}:${min}`);
});

test('mapBaileysMessage usa o nome do contato quando a mensagem nao e minha', () => {
  const waMessage = {
    key: { fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' },
    messageTimestamp: 1700000000,
    message: { conversation: 'bom dia' },
  };
  const mapped = mapBaileysMessage(waMessage, { contactName: 'Eliseu' });
  assert.strictEqual(mapped.sender, 'Eliseu');
  assert.strictEqual(mapped.text, 'bom dia');
  assert.match(mapped.date, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.match(mapped.time, /^\d{2}:\d{2}$/);
});

test('mapBaileysMessage usa meName quando fromMe e true', () => {
  const waMessage = {
    key: { fromMe: true, remoteJid: '5511999999999@s.whatsapp.net' },
    messageTimestamp: 1700000000,
    message: { conversation: 'oi, tudo bem?' },
  };
  const mapped = mapBaileysMessage(waMessage, { contactName: 'Eliseu', meName: 'André' });
  assert.strictEqual(mapped.sender, 'André');
});

test('mapBaileysMessage retorna null quando nao ha texto extraivel', () => {
  const waMessage = {
    key: { fromMe: false, remoteJid: 'x@s.whatsapp.net' },
    messageTimestamp: 1700000000,
    message: { reactionMessage: {} },
  };
  assert.strictEqual(mapBaileysMessage(waMessage, { contactName: 'Eliseu' }), null);
});

test('dedupKey ignora acentos e maiusculas', () => {
  const a = { date: '04/09/2017', time: '11:57', sender: 'Eliseu', text: 'Bom dia!' };
  const b = { date: '04/09/2017', time: '11:57', sender: 'ELISEU', text: 'bom dia!' };
  assert.strictEqual(dedupKey(a), dedupKey(b));
});

test('mergeMessages remove duplicatas do export e ordena por data/hora', () => {
  const exportMessages = [
    { date: '04/09/2017', time: '11:57', sender: 'Eliseu', text: 'Bom dia!' },
    { date: '04/09/2017', time: '11:58', sender: 'Eliseu', text: 'Alguma novidade' },
  ];
  const liveMessages = [
    { date: '04/09/2017', time: '11:57', sender: 'Eliseu', text: 'Bom dia!' }, // duplicata
    { date: '20/07/2026', time: '09:00', sender: 'Eliseu', text: 'Mensagem nova ao vivo' },
  ];
  const merged = mergeMessages(exportMessages, liveMessages);
  assert.strictEqual(merged.length, 3);
  assert.strictEqual(merged[merged.length - 1].text, 'Mensagem nova ao vivo');
});
