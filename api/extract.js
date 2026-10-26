export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType, customApiKey } = req.body;
    const apiKey = customApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'NO_API_KEY',
        message: 'GEMINI_API_KEY belum diatur di Vercel atau menu Pengaturan.'
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'Data gambar tidak ditemukan.' });
    }

    const prompt = `Anda adalah sistem ekstraksi data dokumen PLN dari screenshot tabel "Daftar Monitoring Status PRR Dan Penghapusan".
Tugas Anda adalah membaca gambar ini dengan sangat teliti dan mengekstrak informasi berikut:
1. "idpel": Nomor ID Pelanggan (12 digit angka di kotak input "ID Pelanggan", contoh: "544103597107" atau "544101471444"). Jika tidak terlihat di gambar, kembalikan string kosong "".
2. Ambil nilai pada kolom "No. Dokumen" untuk masing-masing baris "Status" berikut:
   - Status "DUPR" (baris nomor 1) -> masukkan ke field "dupr"
   - Status "BAPR" (baris nomor 3) -> masukkan ke field "bapr"
   - Status "DPR" (baris nomor 5) -> masukkan ke field "dpr"
   - Status "ENTRI DUPPR" (baris nomor 6) -> masukkan ke field "duppr"
   - Status "TERBIT SUPPR-UP" (baris nomor 8, atau TERBIT SUPPR-AP / TERBIT SUPPR-UPI jika ada) -> masukkan ke field "suppr"

ATURAN PENTING:
- Jika kolom "No. Dokumen" pada baris status tersebut kosong / tidak ada nomor dokumennya di foto, WAJIB isi nilainya dengan kata "kosong" (huruf kecil semua).
- Pastikan penulisan nomor dokumen persis sesuai gambar (contoh: "002/54410/DUPR/V/2016" atau "0003/54410/DUPR/X/2017").`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                idpel: { type: 'STRING' },
                dupr: { type: 'STRING' },
                bapr: { type: 'STRING' },
                dpr: { type: 'STRING' },
                duppr: { type: 'STRING' },
                suppr: { type: 'STRING' }
              },
              required: ['idpel', 'dupr', 'bapr', 'dpr', 'duppr', 'suppr']
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const result = await response.json();
    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(rawText);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Gagal mengekstrak gambar' });
  }
}