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
const VERCEL_BASE_URL = process.env.VERCEL_BASE_URL;

if (!VERCEL_BASE_URL || !VERCEL_BASE_URL.startsWith('http')) {
    console.error("VERCEL_BASE_URL environment variable is missing or invalid. Please set it in Vercel Dashboard (e.g., https://your-project.vercel.app)");
}

export default async function handler(req, res) {
  console.log(`[Webhook] Received ${req.method} request.`);

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

  let responseMessage = 'Perintah tidak dikenal.'; // Default pesan jika tidak ada perintah yang cocok

  if (text === '/start') {
    responseMessage = `
👋 Halo, Owner! Selamat datang di bot Panel Creator.
------------------------------------------------
Berikut adalah daftar perintah yang bisa Anda gunakan:

🔑 <b>Manajemen Access Key:</b>
• /addkey [key_opsional] [public|private|both]
  - Menambahkan Access Key baru. Jika [key_opsional] tidak diberikan, akan di-generate otomatis.
  - [public|private|both]: Batasan tipe panel untuk key ini (default: both).
  - Contoh: <code>/addkey</code>
  - Contoh: <code>/addkey myCustomKey private</code>
  - Contoh: <code>/addkey public</code>

• /listkeys
  - Menampilkan semua Access Key yang terdaftar beserta status dan batasannya.

• /removekey [key_yang_ingin_dihapus]
  - Menghapus Access Key tertentu dari database.
  - Contoh: <code>/removekey myCustomKey</code>

------------------------------------------------
Panel Creator Anda: ${VERCEL_BASE_URL}
`;
  } else if (text.startsWith('/addkey')) {
    const args = text.substring('/addkey'.length).trim().split(/\s+/).filter(arg => arg !== ''); // Filter arg kosong
    let customKey = undefined;
    let panelTypeRestriction = 'both'; // Default restriction

    if (args.length > 0) {
        const lastArg = args[args.length - 1].toLowerCase();
        const validRestrictions = ['public', 'private', 'both'];
        if (validRestrictions.includes(lastArg)) {
            panelTypeRestriction = lastArg;
            if (args.length > 1) { // Jika ada arg lain sebelum restriction
                customKey = args.slice(0, args.length - 1).join(' '); // Gabungkan sisa arg sebagai key
            }
        } else {
            customKey = args.join(' '); // Jika tidak ada restriction, semua arg adalah custom key
        }
    }
    
    // Perbaikan: Jika customKey adalah string kosong setelah trim, jadikan undefined
    if (typeof customKey === 'string' && customKey.trim() === '') {
        customKey = undefined;
    }

    try {
      console.log(`[Webhook] Calling /api/manage-access-keys (POST) for /addkey. Key: ${customKey || 'random'}, Restriction: ${panelTypeRestriction}`);
      const addKeyResponse = await fetch(`${VERCEL_BASE_URL}/api/manage-access-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            key: customKey,
            createdByTelegramId: fromId,
            panelTypeRestriction: panelTypeRestriction
        }),
      });
      const addKeyData = await addKeyResponse.json();

      if (addKeyData.success) {
        responseMessage = `
✅ <b>Access Key Berhasil Dibuat!</b>
------------------------------------
🔑 Key: <code>${escapeHTML(addKeyData.key)}</code>
⚙️ Batasan Panel: <b>${escapeHTML(addKeyData.panelTypeRestriction || 'both')}</b>
------------------------------------
`;
      } else {
        responseMessage = `❌ Gagal menambahkan Access Key: ${escapeHTML(addKeyData.message || 'Respons API tidak sukses')}`;
        console.error("[Webhook] Add Key API returned error:", addKeyData);
      }
    } catch (error) {
      console.error('[Webhook] Error calling add-key API:', error);
      responseMessage = `Terjadi kesalahan internal saat menambahkan Access Key: ${escapeHTML(error.message)}`;
    }
  } else if (text.startsWith('/listkeys')) {
    try {
      console.log("[Webhook] Calling /api/manage-access-keys (GET) for /listkeys.");
      const listKeysResponse = await fetch(`${VERCEL_BASE_URL}/api/manage-access-keys?requestedByTelegramId=${fromId}`, {
        method: 'GET',
      });
      const listKeysData = await listKeysResponse.json();

      if (listKeysData.success && listKeysData.keys.length > 0) {
        responseMessage = '🔑 <b>Daftar Access Keys:</b>\n------------------------------------\n';
        listKeysData.keys.forEach((k, index) => {
          responseMessage += `<b>${index + 1}.</b> <code>${escapeHTML(k.key)}</code>\n`;
          responseMessage += `   Status: <b>${k.isActive ? 'Aktif ✅' : 'Nonaktif ❌'}</b>\n`;
          responseMessage += `   Batasan: <b>${escapeHTML(k.panelTypeRestriction || 'both')}</b>\n`;
          responseMessage += `   Dibuat: ${escapeHTML(k.createdAt.split('T')[0])}\n`; // Ambil hanya tanggal
          responseMessage += `   Digunakan: ${k.usageCount} kali\n`;
          if (index < listKeysData.keys.length - 1) {
            responseMessage += `------------------------------------\n`;
          }
        });
        responseMessage += `------------------------------------`;
      } else if (listKeysData.success && listKeysData.keys.length === 0) {
        responseMessage = 'Tidak ada Access Key yang terdaftar. Gunakan /addkey untuk membuat yang baru.';
      } else {
        responseMessage = `❌ Gagal mengambil daftar Access Key: ${escapeHTML(listKeysData.message || 'Respons API tidak sukses')}`;
        console.error("[Webhook] List Keys API returned error:", listKeysData);
      }
    } catch (error) {
      console.error('[Webhook] Error calling list-keys API:', error);
      responseMessage = `Terjadi kesalahan internal saat mengambil daftar Access Key: ${escapeHTML(error.message)}`;
    }
  } else if (text.startsWith('/removekey')) {
    const keyToRemove = text.substring('/removekey'.length).trim();
    if (!keyToRemove) {
      responseMessage = 'Mohon sertakan Access Key yang ingin dihapus. Contoh: /removekey <code>myCustomKey</code>';
    } else {
      try {
        console.log(`[Webhook] Calling /api/manage-access-keys (DELETE) for /removekey. Key: ${keyToRemove}`);
        const removeKeyResponse = await fetch(`${VERCEL_BASE_URL}/api/manage-access-keys`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: keyToRemove, deletedByTelegramId: fromId }),
        });
        const removeKeyData = await removeKeyResponse.json();

        if (removeKeyData.success) {
          responseMessage = `🗑️ Access Key <code>${escapeHTML(keyToRemove)}</code> berhasil dihapus.`;
        } else {
          responseMessage = `❌ Gagal menghapus Access Key: ${escapeHTML(removeKeyData.message || 'Respons API tidak sukses')}`;
          console.error("[Webhook] Remove Key API returned error:", removeKeyData);
        }
      } catch (error) {
        console.error('Error calling remove-key API:', error);
        responseMessage = `Terjadi kesalahan internal saat menghapus Access Key: ${escapeHTML(error.message)}`;
      }
    }
  } else {
      console.log(`[Webhook] Unrecognized command: ${text}`);
      responseMessage = 'Perintah tidak dikenal. Ketik /start untuk melihat daftar perintah.';
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