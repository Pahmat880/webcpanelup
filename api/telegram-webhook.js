// api/telegram-webhook.js
import fetch from 'node-fetch';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Ambil VERCEL_URL dari environment variable
// Ini adalah URL deployment Anda, contoh: https://nama-proyek-anda.vercel.app
const VERCEL_BASE_URL = process.env.VERCEL_URL; 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed. Only POST is supported.' });
  }

  const { message } = req.body;

  if (!message || !message.text) {
    return res.status(200).json({ success: true, message: 'No message text or invalid update.' });
  }

  const chatId = message.chat.id;
  const text = message.text;
  const fromId = message.from.id;

  if (fromId.toString() !== TELEGRAM_CHAT_ID.toString()) {
    await sendTelegramMessage(chatId, 'Maaf, Anda tidak memiliki izin untuk menggunakan perintah ini.');
    return res.status(200).json({ success: false, message: 'Unauthorized user.' });
  }

  console.log(`Received message from ${chatId}: ${text}`);

  let responseMessage = 'Perintah tidak dikenal. Gunakan /addkey, /listkeys, atau /removekey [key].';

  if (text.startsWith('/addkey')) {
    const customKey = text.substring('/addkey'.length).trim();
    try {
      // Panggil Serverless Function manage-access-keys untuk menambah key
      // GUNAKAN VERCEL_BASE_URL DI SINI
      const addKeyResponse = await fetch(`${VERCEL_BASE_URL}/api/manage-access-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: customKey || undefined, createdByTelegramId: fromId }),
      });
      const addKeyData = await addKeyResponse.json();

      if (addKeyData.success) {
        responseMessage = `✅ Access Key baru berhasil ditambahkan:\n<code>${addKeyData.key}</code>`;
      } else {
        responseMessage = `❌ Gagal menambahkan Access Key: ${addKeyData.message}`;
      }
    } catch (error) {
      console.error('Error calling add-key API:', error);
      responseMessage = `Terjadi kesalahan internal saat menambahkan Access Key: ${error.message}`;
    }
  } else if (text.startsWith('/listkeys')) {
    try {
      // Panggil Serverless Function manage-access-keys untuk melihat daftar key
      // GUNAKAN VERCEL_BASE_URL DI SINI
      const listKeysResponse = await fetch(`${VERCEL_BASE_URL}/api/manage-access-keys?requestedByTelegramId=${fromId}`, {
        method: 'GET',
      });
      const listKeysData = await listKeysResponse.json();

      if (listKeysData.success && listKeysData.keys.length > 0) {
        let keysList = '🔑 <b>Daftar Access Keys:</b>\n\n';
        listKeysData.keys.forEach(k => {
          keysList += `<code>${k.key}</code> [${k.isActive ? 'Aktif' : 'Nonaktif'}] (Dibuat: ${k.createdAt}, Digunakan: ${k.usageCount})\n`;
        });
        responseMessage = keysList;
      } else if (listKeysData.success && listKeysData.keys.length === 0) {
        responseMessage = 'Tidak ada Access Key yang terdaftar.';
      } else {
        responseMessage = `❌ Gagal mengambil daftar Access Key: ${listKeysData.message}`;
      }
    } catch (error) {
      console.error('Error calling list-keys API:', error);
      responseMessage = `Terjadi kesalahan internal saat mengambil daftar Access Key: ${error.message}`;
    }
  } else if (text.startsWith('/removekey')) {
    const keyToRemove = text.substring('/removekey'.length).trim();
    if (!keyToRemove) {
      responseMessage = 'Mohon sertakan Access Key yang ingin dihapus. Contoh: /removekey 123abc456def';
    } else {
      try {
        // Panggil Serverless Function manage-access-keys untuk menghapus key
        // GUNAKAN VERCEL_BASE_URL DI SINI
        const removeKeyResponse = await fetch(`${VERCEL_BASE_URL}/api/manage-access-keys`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: keyToRemove, deletedByTelegramId: fromId }),
        });
        const removeKeyData = await removeKeyResponse.json();

        if (removeKeyData.success) {
          responseMessage = `🗑️ Access Key <code>${keyToRemove}</code> berhasil dihapus.`;
        } else {
          responseMessage = `❌ Gagal menghapus Access Key: ${removeKeyData.message}`;
        }
      } catch (error) {
        console.error('Error calling remove-key API:', error);
        responseMessage = `Terjadi kesalahan internal saat menghapus Access Key: ${error.message}`;
      }
    }
  }

  await sendTelegramMessage(chatId, responseMessage);

  return res.status(200).json({ success: true, message: 'Webhook processed.' });
}

async function sendTelegramMessage(chatId, messageText) {
  const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error('Failed to send message to Telegram:', data);
    }
  } catch (error) {
    console.error('Error sending message via Telegram API:', error);
  }
}