// api/manage-access-keys.js
import { connectToDatabase } from '../utils/db';
import crypto from 'crypto'; // Untuk generate key acak

export default async function handler(req, res) {
  const db = await connectToDatabase();
  const collection = db.collection('accessKeys'); // Nama koleksi untuk access keys

  // Owner ID Telegram dari environment variable untuk otorisasi
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  // Middleware sederhana untuk otorisasi owner (hanya untuk panggilan internal dari webhook)
  // Owner akan diverifikasi di webhook, jadi ini lebih untuk memastikan panggilan dari sumber yang benar
  const authorizeOwner = (ownerId) => {
    return ownerId && ownerId.toString() === TELEGRAM_CHAT_ID.toString();
  };

  if (req.method === 'POST') {
    // Menambah Access Key baru
    const { key, createdByTelegramId } = req.body;

    if (!authorizeOwner(createdByTelegramId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access. Only owner can add keys.' });
    }

    const newKey = key || crypto.randomBytes(16).toString('hex'); // Generate random key jika tidak diberikan
    
    try {
      // Pastikan key belum ada
      const existingKey = await collection.findOne({ key: newKey });
      if (existingKey) {
        return res.status(409).json({ success: false, message: 'Access Key already exists. Try another one or generate.' });
      }

      const result = await collection.insertOne({
        key: newKey,
        isActive: true,
        createdAt: new Date(),
        createdByTelegramId: createdByTelegramId,
        usageCount: 0,
        lastUsed: null,
      });

      return res.status(201).json({ success: true, message: 'Access Key added successfully.', key: newKey, id: result.insertedId });
    } catch (error) {
      console.error('Error adding access key:', error);
      return res.status(500).json({ success: false, message: 'Failed to add access key.', error: error.message });
    }
  } else if (req.method === 'GET') {
    // Melihat daftar Access Key
    const { requestedByTelegramId } = req.query; // Ambil dari query untuk GET

    if (!authorizeOwner(requestedByTelegramId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access. Only owner can list keys.' });
    }

    try {
      const keys = await collection.find({}).toArray();
      // Jangan kirim semua detail sensitif jika tidak diperlukan oleh owner
      const simplifiedKeys = keys.map(k => ({
        key: k.key,
        isActive: k.isActive,
        createdAt: k.createdAt.toISOString().split('T')[0], // Format tanggal lebih rapi
        usageCount: k.usageCount,
      }));
      return res.status(200).json({ success: true, keys: simplifiedKeys });
    } catch (error) {
      console.error('Error listing access keys:', error);
      return res.status(500).json({ success: false, message: 'Failed to list access keys.', error: error.message });
    }
  } else if (req.method === 'DELETE') {
    // Menghapus Access Key
    const { key, deletedByTelegramId } = req.body;

    if (!authorizeOwner(deletedByTelegramId)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access. Only owner can delete keys.' });
    }

    if (!key) {
      return res.status(400).json({ success: false, message: 'Access Key to delete is required.' });
    }

    try {
      const result = await collection.deleteOne({ key: key });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Access Key not found.' });
      }
      return res.status(200).json({ success: true, message: 'Access Key deleted successfully.' });
    } catch (error) {
      console.error('Error deleting access key:', error);
      return res.status(500).json({ success: false, message: 'Failed to delete access key.', error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, message: 'Method Not Allowed.' });
  }
}