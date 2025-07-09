// api/telegram-webhook.js

import fetch from 'node-fetch';
import { connectToDatabase } from '../utils/db.js'; // Pastikan ada .js

// Fungsi Helper untuk Escape HTML
function escapeHTML(str) {
  return str.replace(/[&<>"']/g, function(tag) {
    var charsToReplace = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return charsToReplace[tag] || tag;
  });
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const VERCEL_BASE_URL = process.env.VERCEL_BASE_URL; // <--- BACA DARI ENVIRONMENT VARIABLE

// Pastikan VERCEL_BASE_URL ada dan memiliki protokol
if (!VERCEL_BASE_URL || !VERCEL_BASE_URL.startsWith('http')) {
    console.error("VERCEL_BASE_URL environment variable is missing or invalid. Please set it in Vercel Dashboard (e.g., https://your-project.vercel.app)");
    // Ini penting agar fungsi tidak crash jika variabel tidak diatur
    // atau jika ada error, set ke nilai default sementara jika perlu,
    // atau return error response untuk menandakan masalah konfigurasi.
    // Untuk deployment Vercel, ini akan crash jika tidak diset, yang diinginkan
    // agar Anda tahu ada masalah konfigurasi.
}


export default async function handler(req, res) {
  console.log(`[Webhook] Received ${req.method} request.`); // Log permintaan masuk

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed. Only POST is supported.' });
  }

  const { message } = req.body;

  if (!message || !message.text) {
    console.log("[Webhook] No message text or invalid update. Ignoring.");
    return res.status(200).json({ success: true, message: 'No message text or invalid update.' });
  }

  const chatId = message.chat.id;
  const text = message.text;
  const fromId = message.from.id;

  // --- Verifikasi Owner ---
  if (fromId.toString() !== TELEGRAM_CHAT_ID.toString()) {
    console.warn(`[Webhook] Unauthorized access attempt from chatId: ${chatId}, text: ${text}`);
    await sendTelegramMessage(chatId, 'Maaf, Anda tidak memiliki izin untuk menggunakan perintah ini.');
    return res.status(200).json({ success: false, message: 'Unauthorized user.' });
  }
  // --- Akhir Verifikasi Owner ---

  console.log(`[Webhook] Processing command from owner (${chatId}): ${text}`);

  let responseMessage = 'Perintah tidak dikenal. Gunakan /addkey, /listkeys, atau /removekey [key].';

  if (text.startsWith('/addkey')) {
    const customKey = text.substring('/addkey'.length).trim();
    try {
      console.log(`[Webhook] Calling /api/manage-access-keys (POST) for /addkey. Key: ${customKey || 'random'}`);
      const addKeyResponse = await fetch(`${VERCEL_BASE_URL}/api/manage-access-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: customKey || undefined, createdByTelegramId: fromId }),
      });
      const addKeyData = await addKeyResponse.json(); // Mencoba parse JSON

      if (addKeyData.success) {
        responseMessage = `✅ Access Key baru berhasil ditambahkan:\n<code>${escapeHTML(addKeyData.key)}</code>`;
      } else {
        responseMessage = `❌ Gagal menambahkan Access Key: ${escapeHTML(addKeyData.message || 'Respons API tidak sukses')}`;
        console.error("[Webhook] Add Key API returned error:", addKeyData);
      }
    } catch (error) {
      console.error('[Webhook] Error calling add-key API:', error); // Log error spesifik fetch/JSON parse
      responseMessage = `Terjadi kesalahan internal saat menambahkan Access Key: ${escapeHTML(error.message)}`;
    }
  } else if (text.startsWith('/listkeys')) {
    try {
      console.log("[Webhook] Calling /api/manage-access-keys (GET) for /listkeys.");
      const listKeysResponse = await fetch(`${VERCEL_BASE_URL}/api/manage-access-keys?requestedByTelegramId=${fromId}`, {
        method: 'GET',
      });
      const listKeysData = await listKeysResponse.json(); // Mencoba parse JSON

      if (listKeysData.success && listKeysData.keys.length > 0) {
        let keysList = '🔑 <b>Daftar Access Keys:</b>\n\n';
        listKeysData.keys.forEach(k => {
          keysList += `<code>${escapeHTML(k.key)}</code> [${k.isActive ? 'Aktif' : 'Nonaktif'}] (Dibuat: ${escapeHTML(k.createdAt)}, Digunakan: ${k.usageCount})\\n`;
        });
        responseMessage = keysList;
      } else if (listKeysData.success && listKeysData.keys.length === 0) {
        responseMessage = 'Tidak ada Access Key yang terdaftar.';
      } else {
        responseMessage = `❌ Gagal mengambil daftar Access Key: ${escapeHTML(listKeysData.message || 'Respons API tidak sukses')}`;
        console.error("[Webhook] List Keys API returned error:", listKeysData);
      }
    } catch (error) {
      console.error('[Webhook] Error calling list-keys API:', error); // Log error spesifik fetch/JSON parse
      responseMessage = `Terjadi kesalahan internal saat mengambil daftar Access Key: ${escapeHTML(error.message)}`;
    }
  } else if (text.startsWith('/removekey')) {
    const keyToRemove = text.substring('/removekey'.length).trim();
    if (!keyToRemove) {
      responseMessage = 'Mohon sertakan Access Key yang ingin dihapus. Contoh: /removekey 123abc456def';
    } else {
      try {
        console.log(`[Webhook] Calling /api/manage-access-keys (DELETE) for /removekey. Key: ${keyToRemove}`);
        const removeKeyResponse = await fetch(`${VERCEL_BASE_URL}/api/manage-access-keys`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: keyToRemove, deletedByTelegramId: fromId }),
        });
        const removeKeyData = await removeKeyResponse.json(); // Mencoba parse JSON

        if (removeKeyData.success) {
          responseMessage = `🗑️ Access Key <code>${escapeHTML(keyToRemove)}</code> berhasil dihapus.`;
        } else {
          responseMessage = `❌ Gagal menghapus Access Key: ${escapeHTML(removeKeyData.message || 'Respons API tidak sukses')}`;
          console.error("[Webhook] Remove Key API returned error:", removeKeyData);
        }
      } catch (error) {
        console.error('[Webhook] Error calling remove-key API:', error); // Log error spesifik fetch/JSON parse
        responseMessage = `Terjadi kesalahan internal saat menghapus Access Key: ${escapeHTML(error.message)}`;
      }
    }
  } else {
      console.log(`[Webhook] Unrecognized command: ${text}`);
  }

  await sendTelegramMessage(chatId, responseMessage);
  console.log("[Webhook] Response sent to Telegram.");

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
