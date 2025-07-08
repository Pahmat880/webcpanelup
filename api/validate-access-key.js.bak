// api/validate-access-key.js
// Serverless Function untuk memvalidasi Access Key

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ isValid: false, message: 'Method Not Allowed. Only GET is supported.' });
  }

  const { accessKey } = req.query;

  // --- KUNCI RAHASIA UNTUK VALIDASI ACCESS KEY ---
  // Anda HARUS mengatur variabel lingkungan ini di Vercel Dashboard Anda!
  // Nama variabelnya di Vercel Dashboard adalah API_KEY_FOR_ACCESS_KEY_VALIDATION
  const MASTER_ACCESS_KEY = process.env.API_KEY_FOR_ACCESS_KEY_VALIDATION; 

  if (!MASTER_ACCESS_KEY) {
    console.error('API_KEY_FOR_ACCESS_KEY_VALIDATION environment variable is not set!');
    return res.status(500).json({ isValid: false, message: 'Server configuration error: Missing validation key.' });
  }

  if (!accessKey) {
    return res.status(400).json({ isValid: false, message: 'Access Key is required.' });
  }

  // Lakukan validasi Access Key
  if (accessKey === MASTER_ACCESS_KEY) {
    return res.status(200).json({ isValid: true, message: 'Access Key Valid.' });
  } else {
    return res.status(401).json({ isValid: false, message: 'Access Key Tidak Valid.' });
  }
}