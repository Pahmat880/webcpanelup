// api/send-telegram-notification.js
// Serverless Function untuk mengirim notifikasi ke Telegram

import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Hanya izinkan metode POST untuk mengirim notifikasi
  // Ini lebih aman karena data dikirim di body request
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed. Only POST is supported.' });
  }

  const { message } = req.body; // Ambil pesan dari body request

  // Ambil token bot dan chat ID dari Environment Variables Vercel
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram bot token or chat ID is not set in environment variables.');
    return res.status(500).json({ success: false, message: 'Server configuration error: Telegram credentials missing.' });
  }

  if (!message) {
    return res.status(400).json({ success: false, message: 'Message content is required.' });
  }

  const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const telegramResponse = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML', // Opsional: Untuk memungkinkan formatting HTML di pesan Telegram
      }),
    });

    const telegramData = await telegramResponse.json();

    if (telegramResponse.ok && telegramData.ok) {
      return res.status(200).json({ success: true, message: 'Notification sent successfully.' });
    } else {
      console.error('Failed to send Telegram notification:', telegramData);
      return res.status(500).json({ success: false, message: 'Failed to send Telegram notification.', telegramError: telegramData.description });
    }
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return res.status(500).json({ success: false, message: `Internal server error: ${error.message}` });
  }
}